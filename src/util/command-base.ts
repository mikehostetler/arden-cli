import { Command, Option } from 'commander';
import { z } from 'zod';

import { output } from './logging';
import { getHost, getUserId } from './settings';
import { ValidationError } from './validation';

/**
 * Common options that should be available on all commands
 */
export interface GlobalOptions {
  host?: string | undefined;
  user?: string | undefined;
  yes?: boolean | undefined;
}

/**
 * Base command builder with consistent global options
 */
export function createCommand(name: string, description: string): Command {
  return new Command(name)
    .description(description)
    .addOption(new Option('-H, --host <url>', 'API host URL').env('ARDEN_HOST'))
    .addOption(new Option('-u, --user <user-id>', 'User ID').env('ARDEN_USER_ID'))
    .addOption(new Option('-y, --yes', 'Assume yes for prompts'));
}

/**
 * Get resolved configuration values from CLI options and config
 */
export function getResolvedConfig(options: GlobalOptions) {
  return {
    host: getHost(options.host),
    userId: getUserId(options.user),
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


      output.error(message);
      process.exit(exitCode);
    }
  };
}

/**
 * Validate required configuration
 * Note: Authentication is handled differently - tokens are not part of global options
 */

export function requireHost(config: ReturnType<typeof getResolvedConfig>): void {
  if (!config.host) {
    output.error(
      'Host required. Use --host flag, set ARDEN_HOST environment variable, or edit ~/.arden/settings.json'
    );
    process.exit(1);
  }
}
