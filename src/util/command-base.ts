import { Command, Option } from 'commander';
import { getSettingValue, getHost, getApiToken, getUserId } from './settings';
import { logger, output, withErrorHandling } from './output';

/**
 * Common options that should be available on all commands
 */
export interface GlobalOptions {
  host?: string;
  token?: string;
  user?: string;
  format?: 'json' | 'table' | 'yaml';
  verbose?: boolean;
  quiet?: boolean;
  yes?: boolean;
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
    .addOption(new Option('-f, --format <format>', 'Output format').choices(['json', 'table', 'yaml']).default('table'))
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
 * Standard command action wrapper with error handling and config resolution
 */
export function createCommandAction<T extends GlobalOptions>(
  handler: (options: T, config: ReturnType<typeof getResolvedConfig>) => Promise<void>
) {
  return withErrorHandling(async (options: T) => {
    const config = getResolvedConfig(options);
    
    // Set log level based on verbose/quiet flags
    if (options.verbose) {
      logger.level = 'debug';
    } else if (options.quiet) {
      logger.level = 'error';
    }
    
    logger.debug('Command options:', options);
    logger.debug('Resolved config:', config);
    
    await handler(options, config);
  });
}

/**
 * Validate required configuration
 */
export function requireAuth(config: ReturnType<typeof getResolvedConfig>): void {
  if (!config.token) {
    output.error('API token required. Use --token flag, set ARDEN_API_TOKEN environment variable, or run "arden config --set api_token=<token>"');
    process.exit(1);
  }
}

export function requireHost(config: ReturnType<typeof getResolvedConfig>): void {
  if (!config.host) {
    output.error('Host required. Use --host flag, set ARDEN_HOST environment variable, or run "arden config --set host=<url>"');
    process.exit(1);
  }
}

/**
 * Common API request helper with authentication
 */
export async function apiRequest(
  url: string,
  config: ReturnType<typeof getResolvedConfig>,
  options: RequestInit = {}
): Promise<Response> {
  requireAuth(config);
  requireHost(config);
  
  const fullUrl = url.startsWith('http') ? url : `${config.host}${url}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': config.token!,
    ...options.headers,
  };
  
  logger.debug(`API request: ${options.method || 'GET'} ${fullUrl}`);
  
  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed (${response.status}): ${errorText}`);
  }
  
  return response;
}

/**
 * Standard API request with JSON response parsing
 */
export async function apiRequestJson<T = any>(
  url: string,
  config: ReturnType<typeof getResolvedConfig>,
  options: RequestInit = {}
): Promise<T> {
  const response = await apiRequest(url, config, options);
  return response.json();
}
