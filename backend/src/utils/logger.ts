/* Minimal structured logger. Swap for pino/winston later if needed. */
import { env } from '../config/env';

type Level = 'info' | 'warn' | 'error' | 'debug';

function log(level: Level, message: string, meta?: unknown) {
  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...(meta !== undefined ? { meta } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else if (level === 'debug') {
    if (env.NODE_ENV !== 'production') console.debug(line);
  } else console.log(line);
}

export const logger = {
  info: (m: string, meta?: unknown) => log('info', m, meta),
  warn: (m: string, meta?: unknown) => log('warn', m, meta),
  error: (m: string, meta?: unknown) => log('error', m, meta),
  debug: (m: string, meta?: unknown) => log('debug', m, meta),
};
