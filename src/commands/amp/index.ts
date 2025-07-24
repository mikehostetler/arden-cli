import { Command } from 'commander';

import { buildSyncCommand } from './sync';

export const ampCommand = new Command('amp').description('Amp Code integration');

// Add sync subcommand
ampCommand.addCommand(buildSyncCommand());
