import { Command } from "commander";
import { spawn } from "child_process";
import { createInterface } from "readline";
import { detectClaude, detectAmp } from "../util/detect";
import { checkClaudeHooks, expandTilde } from "./claude/install";
import { ensureApiToken } from "../util/config";
import { findAmpThreads, createAmpHistoryEvents, formatThreadSummary } from "../util/amp-history";
import { sendEvents } from "../util/client";
import { 
  isAuthenticated, 
  ArdenAuthClient, 
  promptForEmail, 
  promptForPassword, 
  promptForName, 
  confirmPassword,
  saveUserToken 
} from "../util/auth";
import logger from "../util/logger";

interface SetupOptions {
  yes: boolean;
  dryRun: boolean;
  nonInteractive: boolean;
  host?: string;
}

export function buildSetupCommand(): Command {
  return new Command("setup")
    .description("Set up Arden CLI for your AI agent environment")
    .option("-y, --yes", "Accept all suggested actions without prompts", false)
    .option("--dry-run", "Preview changes without making any modifications", false)
    .option("--non-interactive", "Fail if user input would be required", false)
    .option("--host <url>", "Override Arden API host")
    .action(runSetup);
}

async function runSetup(options: SetupOptions) {
  try {
    showBanner();
    
    // Environment checks
    checkNodeVersion();
    
    // Agent detection
    console.log("\nDetecting AI agents...");
    const claude = await detectClaude();
    const amp = await detectAmp();
    
    showDetectionSummary({ claude, amp });
    
    // Claude setup flow
    if (claude.present) {
      await handleClaudeSetup(claude, options);
    } else {
      console.log("Claude Code not found. Skip if you don't use Claude Code.");
    }
    
    // Amp detection and history upload
    if (amp.present) {
      console.log("Amp detected - built-in Arden support, no configuration needed");
      await handleAmpHistoryUpload(options);
    }
    
    // User authentication setup
    await handleUserAuthentication(options);
    
    // API token setup (legacy support)
    console.log("\nChecking API token...");
    await ensureApiToken(options);
    
    showSuccessMessage();
    
  } catch (error) {
    logger.error(`Setup failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

function showBanner() {
  console.log("Welcome to Arden CLI Setup!");
  console.log("This will configure your system to track AI agent usage.\n");
}

function checkNodeVersion() {
  const version = process.version;
  const majorVersion = parseInt(version.slice(1).split('.')[0]);
  
  if (majorVersion < 18) {
    console.log(`Warning: Node.js ${version} detected. Node.js 18+ recommended.`);
  } else {
    console.log(`Node.js ${version} detected`);
  }
}

function showDetectionSummary({ claude, amp }: { claude: any; amp: any }) {
  console.log("\nDetection Summary:");
  
  if (claude.present) {
    console.log(`[✓] Claude Code found at ${claude.bin}${claude.version ? ` (${claude.version})` : ''}`);
  } else {
    console.log(`[✗] Claude Code not found in PATH`);
  }
  
  if (amp.present) {
    console.log(`[✓] Amp found at ${amp.bin}${amp.version ? ` (${amp.version})` : ''}`);
  } else {
    console.log(`[✗] Amp not found in PATH`);
  }
}

async function handleClaudeSetup(claude: any, options: SetupOptions) {
  console.log("\nConfiguring Claude Code...");
  
  const settingsPath = expandTilde("~/.claude/settings.json");
  const needsInstall = await checkClaudeHooks(settingsPath, options.host);
  
  if (!needsInstall) {
    console.log("Arden hooks already installed in Claude settings");
    return;
  }
  
  console.log("Arden hooks not found in Claude settings");
  
  if (options.dryRun) {
    console.log("[DRY-RUN] Would install Claude hooks");
    return;
  }
  
  if (options.nonInteractive) {
    console.log("Claude hooks need installation but running in non-interactive mode");
    process.exit(2);
  }
  
  const shouldInstall = options.yes || await confirm("Install Arden hooks for Claude Code? (y/N)");
  
  if (!shouldInstall) {
    console.log("Skipping Claude hook installation");
    return;
  }
  
  // Run the claude install command
  console.log("Installing Claude hooks...");
  
  const args = [
    process.argv[0], // node executable
    process.argv[1], // arden script
    ...(options.host ? ["--host", options.host] : []),
    "claude",
    "install",
    "-s",
    settingsPath,
    ...(options.yes ? ["--yes"] : [])
  ];
  
  const result = await spawnProcess(process.execPath, args.slice(1));
  
  if (result.code === 0) {
    console.log("Claude hooks installed successfully");
  } else {
    throw new Error("Failed to install Claude hooks");
  }
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question + " ", (answer) => {
      rl.close();
      resolve(["y", "yes"].includes(answer.trim().toLowerCase()));
    });
  });
}

async function spawnProcess(command: string, args: string[]): Promise<{ code: number }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { 
      stdio: "inherit",
      env: process.env 
    });
    
    child.on("close", (code) => {
      resolve({ code: code || 0 });
    });
    
    child.on("error", (error) => {
      logger.error(`Failed to spawn process: ${error.message}`);
      resolve({ code: 1 });
    });
  });
}

async function handleUserAuthentication(options: SetupOptions) {
  console.log("\nChecking Arden account...");
  
  // Check if already authenticated
  if (await isAuthenticated()) {
    console.log("Already logged in to Arden");
    return;
  }

  if (options.dryRun) {
    console.log("[DRY-RUN] Would prompt for account setup");
    return;
  }

  if (options.nonInteractive) {
    console.log("Authentication required but running in non-interactive mode");
    console.log("Run 'arden auth login' or 'arden auth register' to authenticate");
    return;
  }

  // Ask if they have an account
  const hasAccount = options.yes ? false : await confirm("Do you already have an Arden account? (y/N)");

  if (hasAccount) {
    await handleLogin(options);
  } else {
    await handleRegistration(options);
  }
}

async function handleLogin(options: SetupOptions) {
  console.log("\nSigning in to your Arden account...");
  
  try {
    const email = await promptForEmail();
    const password = await promptForPassword();

    const client = new ArdenAuthClient(options.host);
    const authResponse = await client.login({ email, password });
    
    await saveUserToken(authResponse.token);
    
    console.log("Successfully logged in!");
  } catch (error) {
    logger.error(`Login failed: ${(error as Error).message}`);
    console.log("Setup will continue, but you may need to run 'arden auth login' later");
  }
}

async function handleRegistration(options: SetupOptions) {
  console.log("\nCreating new Arden account...");
  
  try {
    const name = await promptForName();
    const email = await promptForEmail();
    
    let password = await promptForPassword();
    if (password.length < 6) {
      console.log("Password must be at least 6 characters long");
      password = await promptForPassword();
    }

    const isConfirmed = await confirmPassword(password);
    if (!isConfirmed) {
      console.log("Passwords do not match, setup will continue without account creation");
      console.log("You can run 'arden auth register' later to create an account");
      return;
    }

    const client = new ArdenAuthClient(options.host);
    const user = await client.register({ name, email, password });
    
    console.log(`Account created successfully for ${user.name} (${user.email})`);
    
    if (!user.is_confirmed) {
      console.log("A confirmation email has been sent to your email address");
    }

    // Auto-login after registration
    const authResponse = await client.login({ email, password });
    await saveUserToken(authResponse.token, user.id);
    console.log("Successfully logged in");
    
  } catch (error) {
    logger.error(`Registration failed: ${(error as Error).message}`);
    console.log("Setup will continue, but you may need to run 'arden auth register' later");
  }
}

async function handleAmpHistoryUpload(options: SetupOptions) {
  console.log("\nChecking for existing Amp thread history...");
  
  const threads = await findAmpThreads();
  
  if (threads.length === 0) {
    console.log("No existing Amp threads found in ~/.amp/file-changes");
    return;
  }
  
  console.log(formatThreadSummary(threads));
  
  if (options.dryRun) {
    console.log("[DRY-RUN] Would upload thread history to A-AMP agent");
    return;
  }
  
  if (options.nonInteractive) {
    console.log("Amp thread history found but running in non-interactive mode");
    return;
  }
  
  const shouldUpload = options.yes || await confirm(
    `Upload ${threads.length} existing Amp thread(s) to ardenstats.com under agent A-AMP? (y/N)`
  );
  
  if (!shouldUpload) {
    console.log("Skipping Amp history upload");
    return;
  }
  
  console.log("Uploading Amp thread history...");
  
  try {
    const events = createAmpHistoryEvents(threads);
    const result = await sendEvents(events, { host: options.host });
    
    if (result.status === 'accepted') {
      console.log(`Successfully uploaded ${result.accepted_count} thread record(s)`);
    } else if (result.status === 'partial') {
      console.log(`Uploaded ${result.accepted_count} thread record(s), ${result.rejected_count || 0} failed`);
    } else {
      console.log("Failed to upload thread history");
    }
  } catch (error) {
    logger.error(`Failed to upload Amp history: ${(error as Error).message}`);
    console.log("Warning: Could not upload Amp thread history");
  }
}

function showSuccessMessage() {
  console.log("\nSetup complete!");
  console.log("\nArden is now configured to track your AI agent usage.");
  console.log("Your agents will automatically send telemetry to ardenstats.com");
  console.log("\nNext steps:");
  console.log("• Use Claude Code or Amp as normal");
  console.log("• Visit https://ardenstats.com to view your usage analytics");
  console.log("• Run 'arden --help' to see additional commands");
}
