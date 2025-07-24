/**
 * Agent IDs for the Arden platform.
 * These correspond to the agent_id values in the production_agents.ex file.
 */

export const AGENTS = {
  AMP: 'A-AMP',
  CLAUDE: 'A-CLAUDECODE',
} as const;

export type AgentId = (typeof AGENTS)[keyof typeof AGENTS];
