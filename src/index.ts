import { Command } from "commander";
import { claudeCommand } from "./commands/claude";
import { eventsCommand } from "./commands/events";
import { agentsCommand } from "./commands/agents";
import { usersCommand } from "./commands/users";
import { configCommand } from "./commands/config";
import { buildSetupCommand } from "./commands/setup";
import logger from "./util/logger";
import env from "./util/env";
import { readFileSync } from "fs";
import { join } from "path";

let version = "unknown";
try {
  const pkgPath = join(__dirname, "..", "package.json");
  const pkgJson = JSON.parse(readFileSync(pkgPath, "utf-8"));
  version = pkgJson.version || version;
} catch (e) {
  logger.warn("Could not read version from package.json");
}

const program = new Command();

program
  .name("arden")
  .description("Arden CLI tool")
  .version(version)
  .option('-H, --host <url>', 'API host URL', env.HOST);

program.addCommand(buildSetupCommand());
program.addCommand(claudeCommand);
program.addCommand(eventsCommand);
program.addCommand(agentsCommand());
program.addCommand(usersCommand());
program.addCommand(configCommand);

// CLI parsing with error handling
program.parseAsync(process.argv).catch((error) => {
  logger.error(`[CLI Error] ${error.message}`);
  process.exit(1);
});
