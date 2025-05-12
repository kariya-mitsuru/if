import {LeveledLogMethod} from 'winston';

import {getStorage} from '../../common/util/storage';

/**
 * Keeps in memory logged messages. If called with redundant message, skips logging.
 */
export const memoizedLog = (
  logger: LeveledLogMethod | typeof console.debug,
  message: string
) => {
  getStorage().memoizedLog ||= [];
  const memory: string[] = getStorage().memoizedLog;

  if (memory.includes(message)) {
    return;
  }

  memory.push(message);
  logger(message);
};
