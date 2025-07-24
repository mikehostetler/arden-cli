export const CLAUDE_HOOKS = [
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'Stop',
  'SubagentStop',
] as const;

export type ClaudeHook = (typeof CLAUDE_HOOKS)[number];

export function isClaudeHook(x: string): x is ClaudeHook {
  return (CLAUDE_HOOKS as readonly string[]).includes(x);
}
