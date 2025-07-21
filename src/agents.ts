/**
 * Production agents available in the Arden platform.
 * This is a simplified list containing only agent ID and name for CLI usage.
 */

export interface Agent {
  agent_id: string;
  name: string;
}

// Agent IDs as enum for type-safe usage across the codebase
export const AgentIds = {
  AMP: "A-AMP",
  CURSOR: "A-CURSOR",
  CLAUDE_CODE: "A-CLAUDECODE",
  COPILOT: "A-COPILOT",
  WINDSURF: "A-WINDSURF",
  REPLIT: "A-REPLIT",
  CLINE: "A-CLINE",
  AIDER: "A-AIDER",
  DEVIN: "A-DEVIN",
  CODEGPT: "A-CODEGPT",
  LINDY: "A-LINDY",
  BOLT: "A-BOLT",
  LOVABLE: "A-LOVABLE",
  QODO: "A-QODO",
  CONTINUE: "A-CONTINUE",
  TRAE: "A-TRAE",
  V0: "A-V0",
  ZENCODER: "A-ZENCODER",
  CODEWHISPERER: "A-CODEWISP",
  OPENDEVIN: "A-OPENDEV",
  INTELLICODE: "A-INTELLI",
  OPENCODE: "A-OPENCODE",
} as const;

export type AgentId = (typeof AgentIds)[keyof typeof AgentIds];

export const AGENTS: Agent[] = [
  { agent_id: AgentIds.AMP, name: "Amp" },
  { agent_id: AgentIds.CURSOR, name: "Cursor" },
  { agent_id: AgentIds.CLAUDE_CODE, name: "Claude Code" },
  { agent_id: AgentIds.COPILOT, name: "GitHub Copilot" },
  { agent_id: AgentIds.WINDSURF, name: "Windsurf" },
  { agent_id: AgentIds.REPLIT, name: "Replit Agent" },
  { agent_id: AgentIds.CLINE, name: "Cline" },
  { agent_id: AgentIds.AIDER, name: "Aider" },
  { agent_id: AgentIds.DEVIN, name: "Devin AI" },
  { agent_id: AgentIds.CODEGPT, name: "CodeGPT" },
  { agent_id: AgentIds.LINDY, name: "Lindy" },
  { agent_id: AgentIds.BOLT, name: "Bolt" },
  { agent_id: AgentIds.LOVABLE, name: "Lovable" },
  { agent_id: AgentIds.QODO, name: "Qodo" },
  { agent_id: AgentIds.CONTINUE, name: "Continue" },
  { agent_id: AgentIds.TRAE, name: "Trae" },
  { agent_id: AgentIds.V0, name: "v0 by Vercel" },
  { agent_id: AgentIds.ZENCODER, name: "Zencoder" },
  { agent_id: AgentIds.CODEWHISPERER, name: "Amazon CodeWhisperer" },
  { agent_id: AgentIds.OPENDEVIN, name: "OpenDevin" },
  { agent_id: AgentIds.INTELLICODE, name: "IntelliCode" },
  { agent_id: AgentIds.OPENCODE, name: "OpenCode" },
];

/**
 * Get agent by ID
 */
export function getAgentById(agentId: string): Agent | undefined {
  return AGENTS.find((agent) => agent.agent_id === agentId);
}

/**
 * Get agent by name
 */
export function getAgentByName(name: string): Agent | undefined {
  return AGENTS.find((agent) => agent.name === name);
}

/**
 * Get all agent IDs
 */
export function getAllAgentIds(): string[] {
  return AGENTS.map((agent) => agent.agent_id);
}

/**
 * Get all agent names
 */
export function getAllAgentNames(): string[] {
  return AGENTS.map((agent) => agent.name);
}

/**
 * Check if an agent ID is valid (exists in production agents list)
 */
export function isValidAgentId(agentId: string): boolean {
  return AGENTS.some((agent) => agent.agent_id === agentId);
}

/**
 * Get agent ID by enum key for type-safe access
 */
export function getAgentIdByKey(key: keyof typeof AgentIds): string {
  return AgentIds[key];
}
