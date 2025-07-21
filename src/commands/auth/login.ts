import { Command } from "commander";
import { 
  ArdenAuthClient, 
  promptForEmail, 
  promptForPassword,
  saveUserToken
} from "../../util/auth";
import logger from "../../util/logger";

interface LoginOptions {
  email?: string;
  password?: string;
  host?: string;
}

export function buildLoginCommand(): Command {
  return new Command("login")
    .description("Sign in to your Arden account")
    .option("--email <email>", "Email address")
    .option("--password <password>", "Password")
    .option("--host <url>", "Override Arden API host")
    .action(runLogin);
}

async function runLogin(options: LoginOptions) {
  try {
    console.log("Signing in to Arden...\n");

    // Collect login credentials
    const email = options.email || await promptForEmail();
    const password = options.password || await promptForPassword();

    if (!email || !password) {
      console.log("Email and password are required");
      process.exit(1);
    }

    // Authenticate user
    const client = new ArdenAuthClient(options.host);
    console.log("Authenticating...");
    
    const authResponse = await client.login({ email, password });
    
    // Save token
    await saveUserToken(authResponse.token);
    
    console.log("Successfully logged in!");
    console.log("Authentication token saved locally.");

    console.log("\nNext steps:");
    console.log("• Run 'arden setup' to configure your AI agents");
    console.log("• Visit https://ardenstats.com to view your dashboard");

  } catch (error) {
    logger.error(`Login failed: ${(error as Error).message}`);
    process.exit(1);
  }
}
