import { Command } from "commander";
import logger from "../../util/logger";
import { createClient } from "../../util/client";
import { output } from "../../util/output";

interface Agent {
  id: number;
  name: string;
  slug: string;
  agent_id: string;
  website_url: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AgentsResponse {
  agents: Agent[];
  total_count: number;
  limit: number;
  offset: number;
}

export function list(): Command {
  return new Command("list")
    .description("List all agents")
    .option("--json", "Output results as JSON")
    .option("--limit <number>", "Limit the number of results", "50")
    .option("--offset <number>", "Offset for pagination", "0")
    .action(async (options, command) => {
      try {
        const globalOptions = command.parent?.parent?.opts() || {};
        const host = globalOptions.host;
        
        if (!host) {
          logger.error("Host is required. Use --host flag or set HOST environment variable.");
          process.exit(1);
        }

        const client = await createClient(host);
        
        const searchParams = new URLSearchParams({
          limit: options.limit,
          offset: options.offset
        });

        const response = await client.get(`api/agents?${searchParams}`);
        const data = await response.json() as AgentsResponse;

        if (options.json) {
          output.json(data);
        } else {
          output.message(`Found ${data.total_count} agents (showing ${data.agents.length}):\n`);
          
          data.agents.forEach((agent, index) => {
            output.message(`${index + 1 + data.offset}. ${agent.name}`);
            output.message(`   ID: ${agent.agent_id}`);
            output.message(`   Slug: ${agent.slug}`);
            output.message(`   Active: ${agent.is_active ? "Yes" : "No"}`);
            if (agent.website_url) {
              output.message(`   Website: ${agent.website_url}`);
            }
            output.message(`   Created: ${new Date(agent.created_at).toLocaleDateString()}`);
            output.message("");
          });

          if (data.total_count > data.offset + data.limit) {
            output.info(`Use --offset ${data.offset + data.limit} to see more results.`);
          }
        }

        logger.info(`Successfully retrieved ${data.agents.length} agents`);
      } catch (error) {
        logger.error("Failed to fetch agents:", error);
        process.exit(1);
      }
    });
}
