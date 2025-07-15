import { Command } from "commander";
import logger from "../../util/logger";
import { createClient } from "../../util/client";

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
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(`Found ${data.total_count} agents (showing ${data.agents.length}):\n`);
          
          data.agents.forEach((agent, index) => {
            console.log(`${index + 1 + data.offset}. ${agent.name}`);
            console.log(`   ID: ${agent.agent_id}`);
            console.log(`   Slug: ${agent.slug}`);
            console.log(`   Active: ${agent.is_active ? "Yes" : "No"}`);
            if (agent.website_url) {
              console.log(`   Website: ${agent.website_url}`);
            }
            console.log(`   Created: ${new Date(agent.created_at).toLocaleDateString()}`);
            console.log("");
          });

          if (data.total_count > data.offset + data.limit) {
            console.log(`Use --offset ${data.offset + data.limit} to see more results.`);
          }
        }

        logger.info(`Successfully retrieved ${data.agents.length} agents`);
      } catch (error) {
        logger.error("Failed to fetch agents:", error);
        process.exit(1);
      }
    });
}
