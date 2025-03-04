#!/usr/bin/env node
import express from 'express';
import {dump, load} from 'js-yaml';

import {validateManifest} from '../common/util/validations';
import {logger} from '../common/util/logger';

import {aggregate} from '../if-run/lib/aggregate';
import {injectEnvironment} from '../if-run/lib/environment';
import {initialize} from '../if-run/lib/initialize';
import {compute} from '../if-run/lib/compute';
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
 * Determine response type.
 */

const determineResponseType = (req: express.Request) => {
  const acceptHeader = req.get('Accept');
  if (acceptHeader && acceptHeader !== '*/*') {
    // Determine based on request Accept header
    const responseType = req.accepts(['application/yaml', 'application/json']);
    if (responseType) {
      return responseType;
    }
  }

  // Determine based on request Content-Type
  const contentType = req.get('Content-Type');
  const isJsonRequest = contentType && contentType.includes('application/json');
  return isJsonRequest ? 'application/json' : 'application/yaml';
};

/**
 * Start the API server.
 */
const startServer = async () => {
  const options = parseIfApiProcessArgs();
  const app = express();

  // Middleware for JSON requests
  app.use(express.json());

  // Custom middleware for YAML requests
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
  app.post('/run', (req, res) => {
    (async () => {
      try {
        logger.info(PROCESSING_REQUEST);

        // Check if request body exists
        if (!req.body) {
          return res.status(400).json({error: MISSING_MANIFEST});
        }

        // Check request Content-Type
        if (!req.is('application/json') && !req.is('application/yaml')) {
          return res.status(415).json({error: UNSUPPORTED_CONTENT_TYPE});
        }

        const envManifest = await injectEnvironment(req.body);

        try {
          const {tree, ...context} = validateManifest(envManifest);

          const pluginStorage = await initialize(context);

          const computedTree = await compute(tree, {
            context,
            pluginStorage,
            observe: req.query.observe === 'true',
            regroup: req.query.regroup === 'true',
            compute: req.query.compute === 'true',
            append: false,
          });

          const aggregatedTree = aggregate(computedTree, context.aggregation);

          envManifest.explainer && (context.explain = explain());

          // Prepare response data
          const responseData = {tree: aggregatedTree, ...context};

          // Return response in the determined format
          const responseType = determineResponseType(req);
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
  });

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
