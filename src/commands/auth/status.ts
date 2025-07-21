import { Command } from "commander";
import { getUserToken } from "../../util/auth";
import { output } from "../../util/output";
import logger from "../../util/logger";

interface StatusOptions {}

export const statusCommand = new Command("status")
  .description("Show current authentication status")
  .action(runStatus);

async function runStatus(_options: StatusOptions, _command: Command) {
  try {
    const token = await getUserToken();
    
    if (!token) {
      output.info("Status: Not logged in");
      output.message("Run 'arden auth login' or 'arden auth register' to get started");
      return;
    }

    output.info("Status: Authenticated");
    output.info("Token found in local configuration");
    
    // TODO: Add user profile information once we resolve the user ID issue
    output.message("\nRun 'arden auth logout' to sign out");

  } catch (error) {
    logger.error(`Status check failed: ${(error as Error).message}`);
    process.exit(1);
  }
}
