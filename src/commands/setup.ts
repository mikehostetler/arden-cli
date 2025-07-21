import { Command } from "commander";
import { spawn } from "child_process";
import { createInterface } from "readline";
import { detectClaude, detectAmp } from "../util/detect";
import { checkClaudeHooks, expandTilde } from "./claude/install";
import { ensureApiToken } from "../util/settings";
import {
  findAmpThreads,
  createAmpHistoryEvents,
  formatThreadSummary,
} from "../util/amp-history";
import { sendEvents } from "../util/client";
import {
  isAuthenticated,
  ArdenAuthClient,
  promptForEmail,
  promptForPassword,
  promptForName,
  confirmPassword,
  saveUserToken,
} from "../util/auth";
import logger from "../util/logger";
import { output } from "../util/output";

interface SetupOptions {
  yes: boolean;
  dryRun: boolean;
  nonInteractive: boolean;
  host?: string;
}

export const setupCommand = new Command("setup")
  .description("Set up Arden CLI for your AI agent environment")
  .option("-y, --yes", "Accept all suggested actions without prompts", false)
  .option(
    "--dry-run",
    "Preview changes without making any modifications",
    false
  )
  .option("--non-interactive", "Fail if user input would be required", false)
  .action(runSetup);

async function runSetup(options: SetupOptions, command: Command) {
  try {
    // Get host from global options
    const host = command.parent?.getOptionValue("host") || options.host;
    const setupOptions = { ...options, host };

    showBanner();

    // Environment checks
    checkNodeVersion();

    // Agent detection
    output.info("Detecting AI agents...");
    const claude = await detectClaude();
    const amp = await detectAmp();

    showDetectionSummary({ claude, amp });

    // Claude setup flow
    if (claude.present) {
      await handleClaudeSetup(claude, setupOptions);
    } else {
      output.info("Claude Code not found. Skip if you don't use Claude Code.");
    }

    // Amp detection and history upload
    if (amp.present) {
      output.info(
        "Amp detected - built-in Arden support, no configuration needed"
      );
      await handleAmpHistoryUpload(setupOptions);
    }

    // User authentication setup
    await handleUserAuthentication(setupOptions);

    // API token setup (legacy support)
    output.info("Checking API token...");
    await ensureApiToken(setupOptions);

    showSuccessMessage();
  } catch (error) {
    logger.error(`Setup failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

function showBanner() {
  output.message("Welcome to Arden CLI Setup!");
  output.message("This will configure your system to track AI agent usage.\n");
}

function checkNodeVersion() {
  const version = process.version;
  const majorVersion = parseInt(version.slice(1).split(".")[0]);

  if (majorVersion < 18) {
    output.warn(`Node.js ${version} detected. Node.js 18+ recommended.`);
  } else {
    output.message(`Node.js ${version} detected`);
  }
}

function showDetectionSummary({ claude, amp }: { claude: any; amp: any }) {
  output.info("Detection Summary:");

  if (claude.present) {
    output.success(
      `Claude Code found at ${claude.bin}${
        claude.version ? ` (${claude.version})` : ""
      }`
    );
  } else {
    output.error(`Claude Code not found in PATH`);
  }

  if (amp.present) {
    output.success(
      `Amp found at ${amp.bin}${amp.version ? ` (${amp.version})` : ""}`
    );
  } else {
    output.error(`Amp not found in PATH`);
  }
}

async function handleClaudeSetup(claude: any, options: SetupOptions) {
  output.info("Configuring Claude Code...");

  const settingsPath = expandTilde("~/.claude/settings.json");
  const needsInstall = await checkClaudeHooks(settingsPath, options.host);

  if (!needsInstall) {
    output.success("Arden hooks already installed in Claude settings");
    return;
  }

  output.warn("Arden hooks not found in Claude settings");

  if (options.dryRun) {
    output.info("[DRY-RUN] Would install Claude hooks");
    return;
  }

  if (options.nonInteractive) {
    output.error(
      "Claude hooks need installation but running in non-interactive mode"
    );
    process.exit(2);
  }

  const shouldInstall =
    options.yes ||
    (await confirm("Install Arden hooks for Claude Code? (y/N)"));

  if (!shouldInstall) {
    output.info("Skipping Claude hook installation");
    return;
  }

  // Run the claude install command
  output.info("Installing Claude hooks...");

  const args = [
    process.argv[0], // node executable
    process.argv[1], // arden script
    ...(options.host ? ["--host", options.host] : []),
    "claude",
    "install",
    "-s",
    settingsPath,
    ...(options.yes ? ["--yes"] : []),
  ].filter((arg): arg is string => arg !== undefined);

  const result = await spawnProcess(process.execPath, args.slice(1));

  if (result.code === 0) {
    output.success("Claude hooks installed successfully");
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

async function spawnProcess(
  command: string,
  args: string[]
): Promise<{ code: number }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
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
  output.info("Checking Arden account...");

  // Check if already authenticated
  if (await isAuthenticated()) {
    output.success("Already logged in to Arden");
    return;
  }

  if (options.dryRun) {
    output.info("[DRY-RUN] Would prompt for account setup");
    return;
  }

  if (options.nonInteractive) {
    output.error("Authentication required but running in non-interactive mode");
    output.info(
      "Run 'arden auth login' or 'arden auth register' to authenticate"
    );
    return;
  }

  // Ask if they have an account
  const hasAccount = options.yes
    ? false
    : await confirm("Do you already have an Arden account? (y/N)");

  if (hasAccount) {
    await handleLogin(options);
  } else {
    await handleRegistration(options);
  }
}

async function handleLogin(options: SetupOptions) {
  output.info("Signing in to your Arden account...");

  try {
    const email = await promptForEmail();
    const password = await promptForPassword();

    const client = new ArdenAuthClient(options.host);
    const authResponse = await client.login({ email, password });

    await saveUserToken(authResponse.token);

    output.success("Successfully logged in!");
  } catch (error) {
    logger.error(`Login failed: ${(error as Error).message}`);
    output.warn(
      "Setup will continue, but you may need to run 'arden auth login' later"
    );
  }
}

async function handleRegistration(options: SetupOptions) {
  output.info("Creating new Arden account...");

  try {
    const name = await promptForName();
    const email = await promptForEmail();

    let password = await promptForPassword();
    if (password.length < 6) {
      output.warn("Password must be at least 6 characters long");
      password = await promptForPassword();
    }

    const isConfirmed = await confirmPassword(password);
    if (!isConfirmed) {
      output.warn(
        "Passwords do not match, setup will continue without account creation"
      );
      output.info(
        "You can run 'arden auth register' later to create an account"
      );
      return;
    }

    const client = new ArdenAuthClient(options.host);
    const user = await client.register({ name, email, password });

    output.success(
      `Account created successfully for ${user.name} (${user.email})`
    );

    if (!user.is_confirmed) {
      output.info("A confirmation email has been sent to your email address");
    }

    // Auto-login after registration
    const authResponse = await client.login({ email, password });
    await saveUserToken(authResponse.token, user.id);
    output.success("Successfully logged in");
  } catch (error) {
    logger.error(`Registration failed: ${(error as Error).message}`);
    output.warn(
      "Setup will continue, but you may need to run 'arden auth register' later"
    );
  }
}

async function handleAmpHistoryUpload(options: SetupOptions) {
  output.info("Checking for existing Amp thread history...");

  const threads = await findAmpThreads();

  if (threads.length === 0) {
    output.info("No existing Amp threads found in ~/.amp/file-changes");
    return;
  }

  output.message(formatThreadSummary(threads));

  if (options.dryRun) {
    output.info("[DRY-RUN] Would upload thread history to A-AMP agent");
    return;
  }

  if (options.nonInteractive) {
    output.info("Amp thread history found but running in non-interactive mode");
    return;
  }

  const shouldUpload =
    options.yes ||
    (await confirm(
      `Upload ${threads.length} existing Amp thread(s) to ardenstats.com under agent A-AMP? (y/N)`
    ));

  if (!shouldUpload) {
    output.info("Skipping Amp history upload");
    return;
  }

  output.info("Uploading Amp thread history...");

  try {
    const events = createAmpHistoryEvents(threads);
    const result = await sendEvents(events, { host: options.host });

    if (result.status === "accepted") {
      output.success(
        `Successfully uploaded ${result.accepted_count} thread record(s)`
      );
    } else if (result.status === "partial") {
      output.success(
        `Uploaded ${result.accepted_count} thread record(s), ${
          result.rejected_count || 0
        } failed`
      );
    } else {
      output.error("Failed to upload thread history");
    }
  } catch (error) {
    logger.error(`Failed to upload Amp history: ${(error as Error).message}`);
    output.warn("Could not upload Amp thread history");
  }
}

function showSuccessMessage() {
  output.success("Setup complete!");
  output.message("\nArden is now configured to track your AI agent usage.");
  output.message(
    "Your agents will automatically send telemetry to ardenstats.com"
  );
  output.message("\nNext steps:");
  output.message("• Use Claude Code or Amp as normal");
  output.message("• Visit https://ardenstats.com to view your usage analytics");
  output.message("• Run 'arden --help' to see additional commands");
}
