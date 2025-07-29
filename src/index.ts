import { Command } from 'commander';

import { ampCommand } from './commands/amp';
import { authCommand } from './commands/auth';
import { claudeCommand } from './commands/claude';
import { configCommand } from './commands/config';
import { eventCommand } from './commands/events';
import { initCommand } from './commands/setup';
import { logger } from './util/logging';
import { getHost } from './util/settings';
import { initTelemetry, reportError, stopTelemetry } from './util/telemetry';
import { checkAndDisplayUpdate } from './util/update-checker';

// Version is injected at build time by tsup
declare const __VERSION__: string;
const version = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'unknown';

// Initialize telemetry
initTelemetry();

const program = new Command();

program
  .name('arden')
  .description('Arden CLI tool')
  .version(version)
  .option('-H, --host <url>', 'API host URL', getHost())
  .option('--insecure', 'Allow connections to untrusted hosts (development only)', false);

program.addCommand(initCommand);
program.addCommand(authCommand);
program.addCommand(ampCommand);
program.addCommand(claudeCommand);
program.addCommand(eventCommand);
program.addCommand(configCommand);

// Run update check in background (don't await to avoid blocking CLI)
checkAndDisplayUpdate().catch(() => {
  // Silently ignore update check failures
});

// Global error handlers for uncaught errors
process.on('uncaughtException', error => {
  reportError(error, { context: 'uncaught_exception' });
  logger.error(`[Uncaught Exception] ${error.message}`);
  stopTelemetry();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  reportError(error, { context: 'unhandled_rejection', promise: String(promise) });
  logger.error(`[Unhandled Rejection] ${error.message}`);
  stopTelemetry();
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  stopTelemetry();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopTelemetry();
  process.exit(0);
});

// CLI parsing with error handling
program.parseAsync(process.argv).catch(error => {
  reportError(error, { context: 'cli_parse' });
  logger.error(`[CLI Error] ${error.message}`);
  stopTelemetry();
  process.exit(1);
});
