import { Command } from 'commander';
import { isClaudeHook } from './hooks';
import { handleClaudeHook } from './handler';

export const claudeCommand = new Command('claude')
  .arguments('<hook>')
  .description('Internal command used by Claude Code hooks')
  .option('--dry-run', 'validate payload and skip API call', false)
  .option('--print', 'print enriched payload to stdout', false)
  .action(async (hook: string, options) => {
    if (!isClaudeHook(hook)) {
      console.error(`Unknown Claude Code hook: ${hook}`);
      console.error(`Available hooks: ${['PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SubagentStop'].join(', ')}`);
      process.exit(1);
    }
    
    await handleClaudeHook(hook, options);
  });
