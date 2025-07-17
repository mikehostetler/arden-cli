import { Command } from 'commander';
import { isClaudeHook } from './hooks';
import { handleClaudeHook } from './handler';
import { buildInstallCommand } from './install';

export const claudeCommand = new Command('claude')
  .description('Claude Code integration');

// Add install subcommand
claudeCommand.addCommand(buildInstallCommand());

// Add hook subcommand for handling Claude Code hooks
const hookCommand = new Command('hook')
  .argument('<hook>')
  .description('(internal) invoked by Claude Code runtime')
  .option('--dry-run', 'validate payload and skip API call', false)
  .option('--print', 'print enriched payload to stdout', false)
  .action(async (hook: string, options, command) => {
    if (!isClaudeHook(hook)) {
      console.error(`Unknown Claude Code hook: ${hook}`);
      console.error(`Available hooks: ${['PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SubagentStop'].join(', ')}`);
      process.exit(1);
    }
    
    // Get host from parent command (global option)
    const parentOptions = command.parent?.opts() || {};
    const combinedOptions = { ...options, host: parentOptions.host };
    
    await handleClaudeHook(hook, combinedOptions);
  });

claudeCommand.addCommand(hookCommand);
