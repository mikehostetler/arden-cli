import pino from 'pino';

/**
 * Centralized output handling with clear separation between:
 * - User-facing output (console.log)
 * - Diagnostic logging (logger)
 * - Error handling (logger.error + process.exit)
 */

// Enhanced logger with dynamic level
export function createLogger(level?: string): pino.Logger {
  const logLevel = level || process.env.LOG_LEVEL || 'info';
  
  return pino({
    level: logLevel,
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
      }
    } : undefined,
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
   * JSON output
   */
  json: (data: any): void => {
    console.log(JSON.stringify(data, null, 2));
  },

  /**
   * Table output for arrays of objects
   */
  table: (data: any[]): void => {
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

/**
 * Error handling with consistent logging and exit
 */
export function handleError(error: Error | string, context?: string): never {
  const message = error instanceof Error ? error.message : error;
  const fullMessage = context ? `${context}: ${message}` : message;
  
  logger.error(fullMessage);
  output.error(fullMessage);
  process.exit(1);
}

/**
 * Async error wrapper for command actions
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error as Error, context);
    }
  };
}

/**
 * Format output based on format preference
 */
export function formatOutput(data: any, format: 'json' | 'table' | 'yaml' = 'table'): void {
  switch (format) {
    case 'json':
      output.json(data);
      break;
    case 'table':
      if (Array.isArray(data)) {
        output.table(data);
      } else {
        output.json(data);
      }
      break;
    case 'yaml':
      // Simple YAML-like output for objects
      if (typeof data === 'object' && !Array.isArray(data)) {
        Object.entries(data).forEach(([key, value]) => {
          console.log(`${key}: ${value}`);
        });
      } else {
        output.json(data);
      }
      break;
    default:
      output.json(data);
  }
}
