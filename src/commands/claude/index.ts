import { Command } from 'commander';

import logger from '../../util/logger';
import { handleClaudeHook } from './handler';
import { isClaudeHook } from './hooks';
import { buildInitCommand } from './init';
import { buildSyncCommand } from './sync';

export const claudeCommand = new Command('claude').description('Claude Code integration');

// Add init subcommand
claudeCommand.addCommand(buildInitCommand());

// Add sync subcommand
claudeCommand.addCommand(buildSyncCommand());

// Add hook subcommand for handling Claude Code hooks
const hookCommand = new Command('hook')
  .argument('<hook>')
  .description('(internal) invoked by Claude Code runtime')
  .option('--print', 'print enriched payload to stdout', false)
  .action(async (hook: string, options, command) => {
    if (!isClaudeHook(hook)) {
      logger.error(`Unknown Claude Code hook: ${hook}`);
      logger.error(
        `Available hooks: ${['PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SubagentStop'].join(', ')}`
      );
      process.exit(1);
    }

    // Get host from root command (global option)
    let rootCommand = command;
    while (rootCommand.parent) {
      rootCommand = rootCommand.parent;
    }
    // For hooks, use production host unless explicitly overridden
    const globalHost = rootCommand.getOptionValue('host');
    const host = globalHost || 'https://ardenstats.com';
    const combinedOptions = { ...options, host, dryRun: false };

    await handleClaudeHook(hook, combinedOptions);
  });

claudeCommand.addCommand(hookCommand);
