import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';

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

let version = 'unknown';
try {
  const pkgPath = join(__dirname, '..', 'package.json');
  const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  version = pkgJson.version || version;
} catch {
  logger.warn('Could not read version from package.json');
}

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
