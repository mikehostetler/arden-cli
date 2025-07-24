import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';

import { ampCommand } from './commands/amp';
import { claudeCommand } from './commands/claude';
import { configCommand } from './commands/config';
import { eventCommand } from './commands/events';
import { initCommand } from './commands/setup';
import logger from './util/logger';
import { getHost } from './util/settings';
import { checkAndDisplayUpdate } from './util/update-checker';

let version = 'unknown';
try {
  const pkgPath = join(__dirname, '..', 'package.json');
  const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  version = pkgJson.version || version;
} catch {
  logger.warn('Could not read version from package.json');
}

const program = new Command();

program
  .name('arden')
  .description('Arden CLI tool')
  .version(version)
  .option('-H, --host <url>', 'API host URL', getHost())
  .option('--insecure', 'Allow connections to untrusted hosts (development only)', false);

program.addCommand(initCommand);
program.addCommand(ampCommand);
program.addCommand(claudeCommand);
program.addCommand(eventCommand);
program.addCommand(configCommand);

// Run update check in background (don't await to avoid blocking CLI)
checkAndDisplayUpdate().catch(() => {
  // Silently ignore update check failures
});

// CLI parsing with error handling
program.parseAsync(process.argv).catch(error => {
  logger.error(`[CLI Error] ${error.message}`);
  process.exit(1);
});
