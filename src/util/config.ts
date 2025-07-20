import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createInterface } from "readline";
import logger from "./logger";

export interface ArdenConfig {
  apiToken?: string;
  host?: string;
}

const CONFIG_FILE = join(homedir(), ".ardencfg.json");

/**
 * Load Arden configuration from ~/.ardencfg.json
 */
export async function loadConfig(): Promise<ArdenConfig> {
  try {
    const content = await fs.readFile(CONFIG_FILE, "utf8");
    return JSON.parse(content);
  } catch (error) {
    // Config file doesn't exist or is invalid
    return {};
  }
}

/**
 * Save Arden configuration to ~/.ardencfg.json
 */
export async function saveConfig(config: ArdenConfig): Promise<void> {
  const content = JSON.stringify(config, null, 2) + "\n";
  await fs.writeFile(CONFIG_FILE, content, "utf8");
}

/**
 * Get API token from environment variable or config file
 */
export async function getApiToken(): Promise<string | undefined> {
  // Check environment variable first
  const envToken = process.env.ARDEN_API_TOKEN;
  if (envToken) {
    return envToken;
  }

  // Check config file
  const config = await loadConfig();
  return config.apiToken;
}

/**
 * Validate API token by making a ping request to the Arden API
 */
export async function validateApiToken(token: string, host?: string): Promise<boolean> {
  try {
    const baseUrl = host || "https://ardenstats.com";
    const response = await fetch(`${baseUrl}/v1/ping`, {
      method: "GET",
      headers: {
        "x-api-key": token,
      },
    });
    
    return response.ok;
  } catch (error) {
    logger.error(`Failed to validate API token: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Prompt user for API token input
 */
export async function promptForApiToken(): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log("\nYou need an Arden account to track your AI agent usage.");
    console.log("1. Visit https://ardenstats.com and log in (or create an account)");
    console.log("2. Go to your account settings and find the 'API Keys' section");
    console.log("3. Copy your API token and paste it below\n");
    
    rl.question("Paste your Arden API token: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Confirm with user before saving token to config file
 */
export async function confirmSaveToken(): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Save this token to ~/.ardencfg.json for future use? (y/N) ", (answer) => {
      rl.close();
      resolve(["y", "yes"].includes(answer.trim().toLowerCase()));
    });
  });
}

/**
 * Ensure user has a valid API token, prompting if necessary
 */
export async function ensureApiToken(options: { 
  yes?: boolean; 
  dryRun?: boolean; 
  nonInteractive?: boolean;
  host?: string;
}): Promise<string | null> {
  // Check if we already have a token
  let token = await getApiToken();
  
  if (token) {
    const isValid = await validateApiToken(token, options.host);
    if (isValid) {
      console.log("✅ Valid API token found");
      return token;
    } else {
      console.log("❌ Existing API token is invalid");
      token = undefined;
    }
  }

  // Need to get a new token
  if (options.nonInteractive) {
    console.log("❌ No valid API token found and running in non-interactive mode");
    process.exit(2);
  }

  if (!token) {
    if (options.dryRun) {
      console.log("[DRY-RUN] Would prompt for API token");
      return null;
    }

    token = await promptForApiToken();
    
    if (!token) {
      console.log("❌ No API token provided");
      return null;
    }

    const isValid = await validateApiToken(token, options.host);
    if (!isValid) {
      console.log("❌ Invalid API token provided");
      return null;
    }

    // Ask to save token unless --yes flag is used
    const shouldSave = options.yes || await confirmSaveToken();
    
    if (shouldSave && !options.dryRun) {
      const config = await loadConfig();
      config.apiToken = token;
      if (options.host) {
        config.host = options.host;
      }
      await saveConfig(config);
      console.log("✅ API token saved to ~/.ardencfg.json");
    }
  }

  return token;
}
