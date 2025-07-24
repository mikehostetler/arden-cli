import { Command, Option } from 'commander';
import { z } from 'zod';

import { createLogger, output } from './output';
import { getApiToken, getHost, getLogLevel, getSettingValue, getUserId } from './settings';
import { ValidationError } from './validation';

/**
 * Common options that should be available on all commands
 */
export interface GlobalOptions {
  host?: string | undefined;
  token?: string | undefined;
  user?: string | undefined;
  format?: 'json' | 'table' | 'yaml' | undefined;
  verbose?: boolean | undefined;
  quiet?: boolean | undefined;
  yes?: boolean | undefined;
}

/**
 * Base command builder with consistent global options
 */
export function createCommand(name: string, description: string): Command {
  return new Command(name)
    .description(description)
    .addOption(new Option('-H, --host <url>', 'API host URL').env('ARDEN_HOST'))
    .addOption(new Option('-t, --token <token>', 'API authentication token').env('ARDEN_API_TOKEN'))
    .addOption(new Option('-u, --user <user-id>', 'User ID').env('ARDEN_USER_ID'))
    .addOption(
      new Option('-f, --format <format>', 'Output format')
        .choices(['json', 'table', 'yaml'])
        .default('table')
    )
    .addOption(new Option('-v, --verbose', 'Enable verbose logging'))
    .addOption(new Option('-q, --quiet', 'Suppress non-error output'))
    .addOption(new Option('-y, --yes', 'Assume yes for prompts'));
}

/**
 * Get resolved configuration values from CLI options and config
 */
export function getResolvedConfig(options: GlobalOptions) {
  return {
    host: getHost(options.host),
    token: getApiToken(options.token),
    userId: getUserId(options.user),
    format: getSettingValue('default_format', options.format) || 'table',
    verbose: options.verbose || false,
    quiet: options.quiet || false,
    yes: options.yes || false,
  };
}

/**
 * Error types with specific exit codes for Phase 2 error standardization
 */
export enum ErrorType {
  GENERIC = 1,
  CONFIG = 2,
  NETWORK = 3,
}

/**
 * Enhanced command action wrapper with automatic async error capture,
 * config injection, validation, and specific exit codes for different error types.
 *
 * This is the Phase 5 implementation with integrated validation infrastructure.
 */
export function createCommandAction<T extends GlobalOptions>(
  handler: (options: T, config: ReturnType<typeof getResolvedConfig>) => Promise<void>,
  validationSchema?: z.ZodSchema<T>
) {
  return async (options: T) => {
    try {
      // Validate command options if schema provided
      if (validationSchema) {
        const validatedOptions = validationSchema.parse(options);
        options = validatedOptions;
      }

      const config = getResolvedConfig(options);

      // Create logger with appropriate level based on verbose/quiet flags
      let logLevel = getLogLevel(); // Use settings-based default
      if (options.verbose) {
        logLevel = 'debug';
      } else if (options.quiet) {
        logLevel = 'error';
      }
      
      const logger = createLogger(logLevel);
      
      // Only log debug info if explicitly verbose
      if (options.verbose) {
        logger.debug('Command options:', options);
        logger.debug('Resolved config:', config);
      }

      await handler(options, config);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Determine error type and exit code based on error content
      let exitCode = ErrorType.GENERIC;

      // Validation errors are configuration-related
      if (error instanceof ValidationError || error instanceof z.ZodError) {
        exitCode = ErrorType.CONFIG;
      }
      // Configuration-related errors
      else if (
        message.includes('config') ||
        message.includes('token') ||
        message.includes('auth') ||
        message.includes('API token') ||
        message.includes('authentication') ||
        message.includes('settings')
      ) {
        exitCode = ErrorType.CONFIG;
      }
      // Network-related errors
      else if (
        message.includes('network') ||
        message.includes('fetch') ||
        message.includes('request') ||
        message.includes('connection') ||
        message.includes('API request') ||
        message.includes('response') ||
        message.includes('timeout') ||
        message.includes('ECONNREFUSED') ||
        message.includes('ENOTFOUND')
      ) {
        exitCode = ErrorType.NETWORK;
      }

      logger.error(`Command failed: ${message}`);
      output.error(message);
      process.exit(exitCode);
    }
  };
}

/**
 * Validate required configuration
 */
export function requireAuth(config: ReturnType<typeof getResolvedConfig>): void {
  if (!config.token) {
    output.error(
      'API token required. Use --token flag, set ARDEN_API_TOKEN environment variable, or edit ~/.arden/settings.json'
    );
    process.exit(1);
  }
}

export function requireHost(config: ReturnType<typeof getResolvedConfig>): void {
  if (!config.host) {
    output.error(
      'Host required. Use --host flag, set ARDEN_HOST environment variable, or edit ~/.arden/settings.json'
    );
    process.exit(1);
  }
}
