import { Signale } from 'signale';

import { sanitizeForJson } from './sanitize';
import { getLogLevel } from './settings';

/**
 * Centralized output handling with clear separation between:
 * - User-facing output (console.log)
 * - Diagnostic logging (logger)
 * - Error handling (logger.error + process.exit)
 */

// Enhanced logger with dynamic level
export function createLogger(level?: string): Signale {
  const logLevel = level || getLogLevel();

  return new Signale({
    disabled: false,
    interactive: false,
    logLevel,
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
}

// Default logger instance
export const logger = createLogger();

/**
 * User-facing output functions with consistent formatting
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
