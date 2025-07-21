import { Command } from "commander";
import { 
  ArdenAuthClient, 
  promptForEmail, 
  promptForPassword,
  saveUserToken
} from "../../util/auth";
import { output } from "../../util/output";
import logger from "../../util/logger";

interface LoginOptions {
  email?: string;
  password?: string;
  host?: string;
}

export const loginCommand = new Command("login")
  .description("Sign in to your Arden account")
  .option("--email <email>", "Email address")
  .option("--password <password>", "Password")
  .action(runLogin);

async function runLogin(options: LoginOptions, command: Command) {
  try {
    output.info("Signing in to Arden...\n");

    // Get host from global options
    const host = command.parent?.getOptionValue('host') || options.host;

    // Collect login credentials
    const email = options.email || await promptForEmail();
    const password = options.password || await promptForPassword();

    if (!email || !password) {
      output.error("Email and password are required");
      process.exit(1);
    }

    // Authenticate user
    const client = new ArdenAuthClient(host);
    output.info("Authenticating...");
    
    const authResponse = await client.login({ email, password });
    
    // Save token
    await saveUserToken(authResponse.token);
    
    output.success("Successfully logged in!");
    output.info("Authentication token saved locally.");

    output.message("\nNext steps:");
    output.message("• Run 'arden setup' to configure your AI agents");
    output.message("• Visit https://ardenstats.com to view your dashboard");

  } catch (error) {
    logger.error(`Login failed: ${(error as Error).message}`);
    process.exit(1);
  }
}
