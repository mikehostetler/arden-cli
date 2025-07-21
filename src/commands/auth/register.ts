import { Command } from "commander";
import { 
  ArdenAuthClient, 
  promptForEmail, 
  promptForPassword, 
  promptForName, 
  confirmPassword,
  saveUserToken
} from "../../util/auth";
import { output } from "../../util/output";
import logger from "../../util/logger";

interface RegisterOptions {
  email?: string;
  password?: string;
  name?: string;
  yes: boolean;
}

export const registerCommand = new Command("register")
  .description("Register a new Arden account")
  .option("--email <email>", "Email address")
  .option("--password <password>", "Password") 
  .option("--name <n>", "Full name")
  .option("-y, --yes", "Accept defaults without prompts", false)
  .action(runRegister);

async function runRegister(options: RegisterOptions, command: Command) {
  try {
    output.info("Creating new Arden account...\n");

    // Get host from global options
    const host = command.parent?.getOptionValue('host');

    // Collect registration data
    const email = options.email || await promptForEmail();
    const name = options.name || await promptForName();
    
    let password = options.password;
    if (!password) {
      password = await promptForPassword();
      if (!password || password.length < 6) {
        output.error("Password must be at least 6 characters long");
        process.exit(1);
      }

      if (!options.yes) {
        const isConfirmed = await confirmPassword(password);
        if (!isConfirmed) {
          output.error("Passwords do not match");
          process.exit(1);
        }
      }
    }

    // Validate required fields
    if (!email || !name || !password) {
      output.error("Email, name, and password are required");
      process.exit(1);
    }

    // Register user
    const client = new ArdenAuthClient(host);
    output.info("Registering account...");
    
    const user = await client.register({
      name,
      email,
      password
    });

    output.success(`Account created successfully for ${user.name} (${user.email})`);
    
    if (!user.is_confirmed) {
      output.info("\nA confirmation email has been sent to your email address.");
      output.info("Please check your email and click the confirmation link to activate your account.");
    }

    // Auto-login after registration
    output.info("\nLogging in...");
    const authResponse = await client.login({ email, password });
    
    await saveUserToken(authResponse.token, user.id);
    output.success("Successfully logged in and saved authentication token.");
    
    output.message("\nNext steps:");
    output.message("• Run 'arden setup' to configure your AI agents");
    output.message("• Visit https://ardenstats.com to view your dashboard");

  } catch (error) {
    logger.error(`Registration failed: ${(error as Error).message}`);
    process.exit(1);
  }
}
