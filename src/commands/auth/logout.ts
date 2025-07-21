import { Command } from "commander";
import { clearUserToken, getUserToken } from "../../util/auth";
import { output } from "../../util/output";

interface LogoutOptions {}

export const logoutCommand = new Command("logout")
  .description("Sign out of your Arden account")
  .action(runLogout);

async function runLogout(_options: LogoutOptions, _command: Command) {
  const token = await getUserToken();
  
  if (!token) {
    output.info("Not currently logged in");
    return;
  }

  await clearUserToken();
  output.success("Successfully logged out");
  output.info("Your local authentication token has been removed");
}
