import {parse, ArgumentConfig, ParseOptions} from 'ts-command-line-args';

import {CONFIG} from '../config';
import {IfApiArgs, IfApiOptions} from '../types/process-args';

/**
 * Parse command line arguments for if-api.
 */
export const parseIfApiProcessArgs = (): IfApiOptions => {
  const args: ArgumentConfig<IfApiArgs> = {
    port: {
      type: Number,
      alias: 'p',
      description: 'Port to listen on',
      optional: true,
    },
    host: {
      type: String,
      alias: 'h',
      description: 'Host to listen on',
      optional: true,
    },
    help: {
      type: Boolean,
      alias: '?',
      description: 'Show help',
      optional: true,
    },
  };

  const helpSections: ParseOptions<IfApiArgs> = {
    helpArg: 'help',
    headerContentSections: [
      {
        header: 'if-api',
        content: 'Start a web API server for the Impact Framework',
      },
    ],
    footerContentSections: [
      {
        header: 'Example',
        content: 'if-api -p 3000',
      },
    ],
  };

  try {
    const options = parse<IfApiArgs>(args, helpSections);
    return {
      port: options.port || CONFIG.PORT,
      host: options.host || CONFIG.HOST,
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
      throw new Error(
        `Failed to parse command line arguments: ${error.message}`
      );
    }
    throw error;
  }
};
