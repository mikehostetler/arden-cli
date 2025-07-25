import { Signale } from 'signale';
import { sanitizeForDebug, sanitizeForJson } from './sanitize.js';
import { getEnvLogLevel } from './env.js';

/**
 * Unified logging and output system for Arden CLI
 *
 * Provides two main interfaces:
 * - logger: For diagnostic/debug logging
 * - output: For user-facing messages and data display
 */

// Signale configuration used by both logger and output
const createSignaleConfig = (logLevel?: string) => ({
  disabled: false,
  interactive: false,
  logLevel: logLevel || getEnvLogLevel() || 'info',
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

/**
 * Create a Signale logger instance with dynamic level support
 */
export function createLogger(level?: string): Signale {
  return new Signale(createSignaleConfig(level));
}

// Default logger instance for diagnostic logging
const baseLogger = createLogger();

/**
 * Diagnostic logger with pino-like interface and sanitization
 * Use this for internal debugging, error tracking, and diagnostic information
 */
export const logger = {
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

/**
 * User-facing output functions with consistent formatting
 * Use this for messages, data display, and user interaction feedback
 */
export const output = {
  /**
   * Success message (green checkmark)
   */
  success: (message: string): void => {
    console.log(`✓ ${message}`);
  },

  /**
   * Error message (red X)
   */
  error: (message: string): void => {
    console.log(`✗ ${message}`);
  },

  /**
   * Warning message (yellow triangle)
   */
  warn: (message: string): void => {
    console.log(`⚠ ${message}`);
  },

  /**
   * Info message (blue info)
   */
  info: (message: string): void => {
    console.log(`ℹ ${message}`);
  },

  /**
   * Plain message
   */
  message: (message: string): void => {
    console.log(message);
  },

  /**
   * JSON output with sensitive data sanitization
   */
  json: (data: unknown): void => {
    const sanitizedData = sanitizeForJson(data);
    console.log(JSON.stringify(sanitizedData, null, 2));
  },

  /**
   * Table output for arrays of objects
   */
  table: (data: unknown[]): void => {
    if (data.length === 0) {
      output.info('No data to display');
      return;
    }
    console.table(data);
  },

  /**
   * Progress indicator
   */
  progress: (message: string): void => {
    process.stdout.write(`${message}...`);
  },

  /**
   * Clear progress and show result
   */
  progressComplete: (result: string): void => {
    process.stdout.write(`\r${result}\n`);
  },
};

// Export default logger for backward compatibility
export default logger;
