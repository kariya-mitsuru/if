#!/usr/bin/env node
import express from 'express';
import multer from 'multer';
import {load} from 'js-yaml';
import {dump} from 'js-yaml';

import {validateManifest} from '../common/util/validations';
import {logger} from '../common/util/logger';

import {aggregate} from '../if-run/lib/aggregate';
import {injectEnvironment} from '../if-run/lib/environment';
import {initialize} from '../if-run/lib/initialize';
import {compute as compute_} from '../if-run/lib/compute';
import {explain} from '../if-run/lib/explain';

import {STRINGS} from './config';
import {parseIfApiProcessArgs} from './util/args';

const {
  DISCLAIMER_MESSAGE,
  INVALID_YAML,
  MISSING_MANIFEST,
  PROCESSING_REQUEST,
  SERVER_STARTED,
  UNSUPPORTED_CONTENT_TYPE,
} = STRINGS;

/**
 * Start the API server.
 */
const startServer = async () => {
  const options = parseIfApiProcessArgs();
  const app = express();

  // multerの設定
  const upload = multer();

  // JSONリクエスト用ミドルウェア
  app.use(express.json());

  // YAMLリクエスト用カスタムミドルウェア
  app.use(express.text({type: 'application/yaml'}), (req, res, next) => {
    if (req.is('application/yaml')) {
      try {
        req.body = load(req.body);
      } catch (error) {
        res.status(400).json({error: INVALID_YAML});
      }
    }
    next();
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).send('OK');
  });

  // Process manifest endpoint
  app.post(
    '/run',
    upload.fields([
      {name: 'manifest'},
      {name: 'observe'},
      {name: 'regroup'},
      {name: 'compute'},
    ]),
    (req, res) => {
      (async () => {
        try {
          logger.info(PROCESSING_REQUEST);

          // Check if request body exists
          if (!req.body) {
            return res.status(400).json({error: MISSING_MANIFEST});
          }

          let manifest;
          let observe = false;
          let regroup = false;
          let compute = false;

          // multipart/form-dataリクエストの処理
          if (req.is('multipart/form-data')) {
            const files = req.files as {
              [fieldname: string]: Express.Multer.File[];
            };

            if (!files.manifest || files.manifest.length === 0) {
              return res.status(400).json({error: MISSING_MANIFEST});
            }

            try {
              manifest = load(files.manifest[0].buffer.toString());
            } catch (error) {
              return res.status(400).json({error: INVALID_YAML});
            }

            observe = req.body.observe === 'true';
            regroup = req.body.regroup === 'true';
            compute = req.body.compute === 'true';
          } else if (req.is('application/json') || req.is('application/yaml')) {
            manifest = req.body;
          } else {
            return res.status(415).json({error: UNSUPPORTED_CONTENT_TYPE});
          }

          // Process manifest
          const envManifest = await injectEnvironment(manifest);

          try {
            const validatedManifest = validateManifest(envManifest);
            const {tree, ...context} = validatedManifest;

            const pluginStorage = await initialize(context);
            const computedTree = await compute_(tree, {
              context,
              pluginStorage,
              observe,
              regroup,
              compute,
              append: false,
            });

            const aggregatedTree = aggregate(computedTree, context.aggregation);
            envManifest.explainer && (context.explain = explain());

            const acceptHeader = req.get('Accept');
            let responseType: string | false = false;
            if (acceptHeader && acceptHeader !== '*/*') {
              // リクエストのAcceptヘッダーに基づいて決定
              responseType = req.accepts([
                'application/yaml',
                'application/json',
              ]);
            }

            if (responseType === false) {
              // リクエストのContent-Typeに基づいて決定
              const contentType = req.get('Content-Type') || '';
              const isJsonRequest = contentType.includes('application/json');

              if (isJsonRequest) {
                responseType = 'application/json';
              } else {
                responseType = 'application/yaml';
              }
            }

            // レスポンスデータを準備
            const responseData = {tree: aggregatedTree, ...context};

            // 決定した形式でレスポンスを返す
            if (responseType === 'application/yaml') {
              const yamlData = dump(responseData, {noRefs: true});
              res.set('Content-Type', 'application/yaml');
              return res.status(200).send(yamlData);
            } else {
              return res.status(200).json(responseData);
            }
          } catch (error) {
            if (error instanceof Error) {
              /** Execution block exists because manifest is already processed. Set's status to `fail`. */
              if (envManifest.execution) {
                envManifest.execution.status = 'fail';
                envManifest.execution.error = error.toString();
              }
              logger.error(error);

              return res.status(500).json({
                error: error.message,
                manifest: envManifest,
              });
            }
            return res.status(500).json({error: 'Unknown error'});
          }
        } catch (error) {
          if (error instanceof Error) {
            logger.error(error);
            return res.status(500).json({error: error.message});
          }
          return res.status(500).json({error: 'Unknown error'});
        }
      })();
    }
  );

  // Start the server
  const {port, host} = options;
  const server = app.listen(port, host, () => {
    logger.info(SERVER_STARTED(port));
  });

  // Handle Signal
  const handler = (error: NodeJS.Signals) => {
    logger.debug(`${error} signal received: closing HTTP server`);
    server.close(() => {
      logger.debug('HTTP server closed');
    });
  };
  process.once('SIGTERM', handler);
  process.once('SIGINT', handler);
};

// Start the server
logger.info(DISCLAIMER_MESSAGE);
startServer().catch(error => {
  logger.error(error);
  throw new Error(`Failed to start server: ${error}`);
});
