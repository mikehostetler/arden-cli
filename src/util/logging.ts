import { Signale } from 'signale';

import { getEnvLogLevel } from './env.js';
import { sanitizeForDebug, sanitizeForJson } from './sanitize.js';

/**
 * Unified logging and output system for Arden CLI
 *
 * Provides two main interfaces:
 * - logger: For diagnostic/debug logging
 * - output: For user-facing messages and data display
 */

// Signale configuration used by both logger and output
const createSignaleConfig = (logLevel?: string) => {
  const level = logLevel || getEnvLogLevel() || 'info';
  return {
    disabled: false,
    interactive: false,
    logLevel: level,
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
  };
};

/**
 * Create a Signale logger instance with dynamic level support
 */
export function createLogger(level?: string): Signale {
  return new Signale(createSignaleConfig(level));
}

// Lazy logger that respects settings
let _baseLogger: Signale | null = null;
let _currentLogLevel: string | null = null;

function getCurrentLogLevel(): string {
  if (!_currentLogLevel) {
    try {
      const { getLogLevel } = require('./settings.js');
      _currentLogLevel = getLogLevel() || getEnvLogLevel() || 'info';
    } catch {
      _currentLogLevel = getEnvLogLevel() || 'info';
    }
  }
  return _currentLogLevel;
}

function getBaseLogger(): Signale {
  if (!_baseLogger) {
    // Try to import settings at runtime to avoid circular deps
    try {
      // Dynamic import to avoid circular dependency issues
      const { getLogLevel } = require('./settings.js');
      const settingsLogLevel = getLogLevel();
      _baseLogger = createLogger(settingsLogLevel);
      _currentLogLevel = settingsLogLevel;
    } catch {
      // Fallback if settings can't be loaded
      _baseLogger = createLogger();
      _currentLogLevel = getEnvLogLevel() || 'info';
    }
  }
  return _baseLogger;
}

/**
 * Diagnostic logger with pino-like interface and sanitization
 * Use this for internal debugging, error tracking, and diagnostic information
 */
export const logger = {
  debug: (obj: unknown, msg?: string, ...args: unknown[]) => {
    // Check if debug logging should be enabled
    const currentLevel = getCurrentLogLevel();
    if (currentLevel !== 'debug') {
      return; // Skip debug logs if level is not debug
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitizedObj = sanitizeForDebug(obj);
      getBaseLogger().debug(msg || '', sanitizedObj, ...args);
    } else {
      getBaseLogger().debug(obj, msg, ...args);
    }
  },
  info: (obj: unknown, msg?: string, ...args: unknown[]) => {
    if (typeof obj === 'string') {
      getBaseLogger().info(obj, msg, ...args);
    } else {
      getBaseLogger().info(msg || '', obj, ...args);
    }
  },
  warn: (obj: unknown, msg?: string, ...args: unknown[]) => {
    if (typeof obj === 'string') {
      getBaseLogger().warn(obj, msg, ...args);
    } else {
      getBaseLogger().warn(msg || '', obj, ...args);
    }
  },
  error: (obj: unknown, msg?: string, ...args: unknown[]) => {
    if (typeof obj === 'string') {
      getBaseLogger().error(obj, msg, ...args);
    } else {
      getBaseLogger().error(msg || '', obj, ...args);
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
