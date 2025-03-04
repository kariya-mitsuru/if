/**
 * Strings for if-api.
 */
export const STRINGS = {
  SERVER_STARTED: (port: number) => `Server started on port ${port}`,
  PROCESSING_REQUEST: 'Processing request',
  INTERNAL_SERVER_ERROR: 'Internal Server Error',
  INVALID_JSON: 'Invalid JSON format',
  INVALID_YAML: 'Invalid YAML format',
  MISSING_MANIFEST: 'Missing manifest in request body',
  UNSUPPORTED_CONTENT_TYPE:
    'Unsupported content type. Supported types are: application/json, application/yaml',
  DISCLAIMER_MESSAGE: 'Impact Framework API - Green Software Foundation',
};
