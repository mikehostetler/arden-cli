import { Command } from "commander";
import logger from "../../util/logger";
import { createClient } from "../../util/client";

interface LeaderboardEntry {
  rank: number;
  agent_id: string;
  name: string;
  slug: string;
  runs: number;
  change: number;
  spark_data?: number[];
}

interface LeaderboardResponse {
  period: string;
  mode: string;
  data: LeaderboardEntry[];
}

export function leaderboard(): Command {
  return new Command("leaderboard")
    .description("Show top agents leaderboard")
    .option("-p, --period <period>", "Time period (today, 7d, 30d)", "7d")
    .option("-m, --mode <mode>", "Data mode (real, simulated)", "real")
    .option("--json", "Output results as JSON")
    .action(async (options, command) => {
      try {
        const globalOptions = command.parent?.parent?.opts() || {};
        const host = globalOptions.host;
        
        if (!host) {
          logger.error("Host is required. Use --host flag or set HOST environment variable.");
          process.exit(1);
        }

        // Map CLI period format to API format
        const periodMap: Record<string, string> = {
          "7d": "7_days",
          "30d": "30_days",
          "today": "today"
        };

        const period = periodMap[options.period] || "7_days";
        const mode = options.mode;

        // Validate mode
        if (!["real", "simulated", "both"].includes(mode)) {
          logger.error("Invalid mode. Must be one of: real, simulated, both");
          process.exit(1);
        }

        const client = await createClient(host);
        
        const searchParams = new URLSearchParams({
          period,
          mode
        });

        const response = await client.get(`api/leaderboards/agents?${searchParams}`);
        const data = await response.json() as LeaderboardResponse;

        if (options.json) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          const periodDisplay = options.period === "7d" ? "7 days" : 
                               options.period === "30d" ? "30 days" : 
                               "today";
          
          console.log(`🏆 Top Agents — ${periodDisplay} (${data.mode})\n`);
          
          if (data.data.length === 0) {
            console.log("No data available for the selected period.");
          } else {
            data.data.forEach((entry) => {
              const changeSymbol = entry.change >= 0 ? "+" : "";
              const changeColor = entry.change >= 0 ? "✅" : "❌";
              
              console.log(`${entry.rank}. ${entry.name}`);
              console.log(`   ${entry.runs} runs (${changeSymbol}${entry.change}) ${changeColor}`);
              console.log(`   Agent ID: ${entry.agent_id}`);
              console.log("");
            });
          }
        }

        logger.info(`Successfully retrieved leaderboard for ${data.period} (${data.mode})`);
      } catch (error) {
        logger.error("Failed to fetch agents leaderboard:", error);
        process.exit(1);
      }
    });
}
