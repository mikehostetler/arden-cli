import { Command } from "commander";
import { ArdenAuthClient, getUserToken } from "../../util/auth";
import logger from "../../util/logger";

interface StatusOptions {
  host?: string;
}

export function buildStatusCommand(): Command {
  return new Command("status")
    .description("Show current authentication status")
    .option("--host <url>", "Override Arden API host")
    .action(runStatus);
}

async function runStatus(options: StatusOptions) {
  try {
    const token = await getUserToken();
    
    if (!token) {
      console.log("Status: Not logged in");
      console.log("Run 'arden auth login' or 'arden auth register' to get started");
      return;
    }

    console.log("Status: Authenticated");
    console.log("Token found in local configuration");
    
    // TODO: Add user profile information once we resolve the user ID issue
    console.log("\nRun 'arden auth logout' to sign out");

  } catch (error) {
    logger.error(`Status check failed: ${(error as Error).message}`);
    process.exit(1);
  }
}
