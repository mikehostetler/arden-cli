import { Signale } from 'signale';

import { sanitizeForDebug } from './sanitize';
import { getLogLevel } from './settings';

// Create a Signale logger with appropriate configuration
const baseLogger = new Signale({
  disabled: false,
  interactive: false,
  logLevel: getLogLevel(),
  scope: 'arden-cli',
  types: {
    debug: {
      badge: '🐛',
      color: 'gray',
      label: 'debug',
      logLevel: 'debug',
    },
    info: {
      badge: 'ℹ',
      color: 'blue',
      label: 'info',
      logLevel: 'info',
    },
    warn: {
      badge: '⚠',
      color: 'yellow',
      label: 'warn',
      logLevel: 'warn',
    },
    error: {
      badge: '✖',
      color: 'red',
      label: 'error',
      logLevel: 'error',
    },
  },
});

// Wrap logger to sanitize debug calls and provide pino-like interface
const logger = {
  debug: (obj: unknown, msg?: string, ...args: unknown[]) => {
    if (typeof obj === 'object' && obj !== null) {
      const sanitizedObj = sanitizeForDebug(obj);
      baseLogger.debug(msg || '', sanitizedObj, ...args);
    } else {
      baseLogger.debug(obj, msg, ...args);
    }
  },
  info: (obj: unknown, msg?: string, ...args: unknown[]) => {
    if (typeof obj === 'string') {
      baseLogger.info(obj, msg, ...args);
    } else {
      baseLogger.info(msg || '', obj, ...args);
    }
  },
  warn: (obj: unknown, msg?: string, ...args: unknown[]) => {
    if (typeof obj === 'string') {
      baseLogger.warn(obj, msg, ...args);
    } else {
      baseLogger.warn(msg || '', obj, ...args);
    }
  },
  error: (obj: unknown, msg?: string, ...args: unknown[]) => {
    if (typeof obj === 'string') {
      baseLogger.error(obj, msg, ...args);
    } else {
      baseLogger.error(msg || '', obj, ...args);
    }
  },
};

export default logger;
