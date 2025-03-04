/**
 * Configuration for if-api.
 */
export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  HOST: process.env.HOST || 'localhost',
};
