import { Command } from "commander";
import { 
  ArdenAuthClient, 
  promptForEmail, 
  promptForPassword, 
  promptForName, 
  confirmPassword,
  saveUserToken
} from "../../util/auth";
import logger from "../../util/logger";

interface RegisterOptions {
  email?: string;
  password?: string;
  name?: string;
  host?: string;
  yes: boolean;
}

export function buildRegisterCommand(): Command {
  return new Command("register")
    .description("Register a new Arden account")
    .option("--email <email>", "Email address")
    .option("--password <password>", "Password") 
    .option("--name <name>", "Full name")
    .option("--host <url>", "Override Arden API host")
    .option("-y, --yes", "Accept defaults without prompts", false)
    .action(runRegister);
}

async function runRegister(options: RegisterOptions) {
  try {
    console.log("Creating new Arden account...\n");

    // Collect registration data
    const email = options.email || await promptForEmail();
    const name = options.name || await promptForName();
    
    let password = options.password;
    if (!password) {
      password = await promptForPassword();
      if (!password || password.length < 6) {
        console.log("Password must be at least 6 characters long");
        process.exit(1);
      }

      if (!options.yes) {
        const isConfirmed = await confirmPassword(password);
        if (!isConfirmed) {
          console.log("Passwords do not match");
          process.exit(1);
        }
      }
    }

    // Validate required fields
    if (!email || !name || !password) {
      console.log("Email, name, and password are required");
      process.exit(1);
    }

    // Register user
    const client = new ArdenAuthClient(options.host);
    console.log("Registering account...");
    
    const user = await client.register({
      name,
      email,
      password
    });

    console.log(`Account created successfully for ${user.name} (${user.email})`);
    
    if (!user.is_confirmed) {
      console.log("\nA confirmation email has been sent to your email address.");
      console.log("Please check your email and click the confirmation link to activate your account.");
    }

    // Auto-login after registration
    console.log("\nLogging in...");
    const authResponse = await client.login({ email, password });
    
    await saveUserToken(authResponse.token, user.id);
    console.log("Successfully logged in and saved authentication token.");
    
    console.log("\nNext steps:");
    console.log("• Run 'arden setup' to configure your AI agents");
    console.log("• Visit https://ardenstats.com to view your dashboard");

  } catch (error) {
    logger.error(`Registration failed: ${(error as Error).message}`);
    process.exit(1);
  }
}
