#!/usr/bin/env node
import {open} from 'fs/promises';

import express from 'express';
import type {NextFunction, Request, Response} from 'express';

import {dump, load} from 'js-yaml';

import {ERRORS} from '@grnsft/if-core/utils';

import {validateManifest} from '../common/util/validations';
import {debugLogger} from '../common/util/debug-logger';
import {logger} from '../common/util/logger';

import {aggregate} from '../if-run/lib/aggregate';
import {executeWithContext} from '../common/util/storage';
import {getExecution} from '../if-run/lib/environment';
import {
  initialize,
  setExternalPluginWarning,
  setDisabledPlugins,
} from '../if-run/lib/initialize';
import {compute} from '../if-run/lib/compute';
import {explain} from '../if-run/lib/explain';
import type {Manifest} from '../common/types/manifest';

import {STRINGS} from './config';
import {parseIfApiProcessArgs} from './util/args';

const {
  DISCLAIMER_MESSAGE,
  INTERNAL_SERVER_ERROR,
  INVALID_JSON,
  INVALID_YAML,
  MISSING_MANIFEST,
  PROCESSING_REQUEST,
  SERVER_STARTED,
  UNSUPPORTED_CONTENT_TYPE,
} = STRINGS;

const CT_MANIFEST_YAML = 'application/vnd.if-manifest+yaml';
const CT_MANIFEST_JSON = 'application/vnd.if-manifest+json';
const CT_YAML = 'application/yaml';
const CT_JSON = 'application/json';
const CT_YAMLS = [CT_MANIFEST_YAML, CT_YAML];
const CT_JSONS = [CT_MANIFEST_JSON, CT_JSON];
const CT_VALID = [...CT_YAMLS, ...CT_JSONS];

const ERROR_LIST: readonly ErrorConstructor[] = Object.values(ERRORS);

/**
 * Determine response type.
 */
const determineResponseType = (req: express.Request) => {
  const acceptHeader = req.get('Accept');
  if (acceptHeader && acceptHeader !== '*/*') {
    // Determine based on request Accept header
    const responseType = req.accepts(CT_VALID);
    if (responseType) {
      return responseType;
    }
  }

  // Determine based on request Content-Type
  const contentType = req.get('Content-Type');
  const isJsonRequest =
    contentType && CT_JSONS.some(ct => contentType.includes(ct));
  return isJsonRequest ? CT_MANIFEST_JSON : CT_MANIFEST_YAML;
};

/**
 * Parse disabled plugins file
 * @param filename Filename that contains plugin names to be disabled
 * @returns Set of disabledPlugins
 */
const parseDisabledPlugins = async (filename: string | undefined) => {
  // If no filename is specified, disable builtin:Shell, builtin:CSVImport, builtin:CSVLookup by default.
  if (!filename) {
    return new Set<string>([
      'builtin:Shell',
      'builtin:CSVImport',
      'builtin:CSVLookup',
    ]);
  }

  const disabledPlugins = new Set<string>();
  const file = await open(filename);
  try {
    for await (const line of file.readLines()) {
      const words = line.split(/ *: */);
      switch (words.length) {
        case 1:
          disabledPlugins.add(`builtin:${words[0]}`);
          break;
        case 2:
          disabledPlugins.add(`${words[0]}:${words[1]}`);
          break;
        default:
          throw new Error(`Invalid DisabledPlugins settings:${line}`);
      }
    }
  } finally {
    await file.close();
  }
  return disabledPlugins;
};

/**
 * Start the API server.
 */
const startServer = async () => {
  const options = parseIfApiProcessArgs();
  debugLogger.overrideConsoleMethods(options.debug);

  setExternalPluginWarning(!options.disableExternalPluginWarning);

  const disabledPlugins = await parseDisabledPlugins(options.disabledPlugins);
  setDisabledPlugins(disabledPlugins);

  const app = express();

  const execution = await getExecution();

  // Middleware for JSON requests
  app.use(express.json({type: CT_JSONS}));

  // Custom middleware for YAML requests
  app.use(
    express.text({type: CT_YAMLS}),
    (req: Request, res: Response, next: NextFunction): void => {
      if (req.is(CT_YAMLS)) {
        try {
          req.body = load(req.body);
        } catch (err: any) {
          res.status(400).json({
            error: INVALID_YAML,
            detail: err.message,
          });
          return;
        }
      }
      next();
    }
  );

  // Add request context storage
  app.use((_req: Request, _res: Response, next: NextFunction): void =>
    executeWithContext(next)
  );

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).send('OK');
  });

  // Process manifest endpoint
  app.post('/v1/run', (req: Request, res: Response): void => {
    (async (): Promise<Response> => {
      logger.info(PROCESSING_REQUEST);

      // Check if request body exists
      if (!req.body) {
        return res.status(400).json({error: MISSING_MANIFEST});
      }

      // Check request Content-Type
      if (!req.is(CT_VALID)) {
        return res.status(415).json({error: UNSUPPORTED_CONTENT_TYPE});
      }

      const envManifest: Manifest = {
        ...req.body,
        execution: {
          command: execution.command,
          environment: {
            ...execution.environment,
            'date-time': `${new Date().toISOString()} (UTC)`,
          },
          status: execution.status,
        },
      };

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
        if (CT_YAMLS.includes(responseType)) {
          const yamlData = dump(responseData, {noRefs: true});
          res.set('Content-Type', responseType);
          return res.status(200).send(yamlData);
        } else {
          res.set('Content-Type', responseType);
          return res.status(200).json(responseData);
        }
      } catch (err) {
        // Set Content-Type to application/json
        res.set('Content-Type', CT_JSON);

        // If it's one of the errors in ERRORS, terminate with status code 400
        if (ERROR_LIST.some(val => err instanceof val)) {
          return res.status(400).json({
            error: (err as Error).message,
          });
        }

        // For all other cases, terminate with status code 500
        if (err instanceof Error) {
          return res.status(500).json({
            error: INTERNAL_SERVER_ERROR,
            detail: err.message,
          });
        }
        return res.status(500).json({error: INTERNAL_SERVER_ERROR});
      }
    })();
  });

  // Set up custom error handler
  app.use(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (err: any, _req: Request, res: Response, _next: NextFunction): void => {
      // Set Content-Type to application/json
      res.set('Content-Type', CT_JSON);

      // If SyntaxError (JSON parse error), terminate with status code 400
      if (err.status === 400 && err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({
          error: INVALID_JSON,
          detail: err.message,
        });
      } else if (err instanceof Error) {
        if ('status' in err) {
          res.status(err.status as number).json({
            error: err.message,
          });
        } else {
          res.status(500).json({
            error: INTERNAL_SERVER_ERROR,
            detail: err.message,
          });
        }
      } else {
        res.status(500).json({
          error: INTERNAL_SERVER_ERROR,
        });
      }
    }
  );

  // Start the server
  const {port, host} = options;
  const server = app.listen(port, host, () => {
    logger.info(SERVER_STARTED(port));
  });

  // Handle Signal
  const handler = (err: NodeJS.Signals) => {
    logger.debug(`${err} signal received: closing HTTP server`);
    server.close(() => {
      logger.debug('HTTP server closed');
    });
  };
  process.once('SIGTERM', handler);
  process.once('SIGINT', handler);
};

// Start the server
logger.info(DISCLAIMER_MESSAGE);
startServer().catch(err => {
  logger.error(err);
  throw new Error(`Failed to start server: ${err}`);
});
