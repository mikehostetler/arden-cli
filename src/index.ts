import { Command } from 'commander';
import { helloCommand } from './commands/hello';
import { claudeCommand } from './commands/claude';
import logger from './util/logger';

const program = new Command();

program
  .name('arden')
  .description('Arden CLI tool')
  .version('1.0.0');

program.addCommand(helloCommand);
program.addCommand(claudeCommand);

// CLI parsing with error handling
program.parseAsync(process.argv).catch((error) => {
  logger.error(`[CLI Error] ${error.message}`);
  process.exit(1);
});
