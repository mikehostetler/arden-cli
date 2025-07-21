import { Command } from "commander";
import { clearUserToken, getUserToken } from "../../util/auth";
import logger from "../../util/logger";

export function buildLogoutCommand(): Command {
  return new Command("logout")
    .description("Sign out of your Arden account")
    .action(runLogout);
}

async function runLogout() {
  try {
    const token = await getUserToken();
    
    if (!token) {
      console.log("Not currently logged in");
      return;
    }

    await clearUserToken();
    console.log("Successfully logged out");
    console.log("Your local authentication token has been removed");

  } catch (error) {
    logger.error(`Logout failed: ${(error as Error).message}`);
    process.exit(1);
  }
}
