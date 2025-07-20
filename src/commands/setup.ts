import { Command } from "commander";
import { spawn } from "child_process";
import { createInterface } from "readline";
import { detectClaude, detectAmp } from "../util/detect";
import { checkClaudeHooks, expandTilde } from "./claude/install";
import { ensureApiToken } from "../util/config";
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
    
    // Amp detection (no action needed)
    if (amp.present) {
      console.log("Amp detected - built-in Arden support, no configuration needed");
    }
    
    // API token setup
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

function showSuccessMessage() {
  console.log("\nSetup complete!");
  console.log("\nArden is now configured to track your AI agent usage.");
  console.log("Your agents will automatically send telemetry to ardenstats.com");
  console.log("\nNext steps:");
  console.log("• Use Claude Code or Amp as normal");
  console.log("• Visit https://ardenstats.com to view your usage analytics");
  console.log("• Run 'arden --help' to see additional commands");
}
