import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import logger from "../../util/logger";
import { sendTelemetry } from "../../util/client";
import { AgentIds } from "../../agents";

export function buildImportCommand(): Command {
  return new Command("import")
    .description("Import Claude Code usage data from local JSONL files")
    .option(
      "--claude-dir <path>",
      "Custom path to Claude data directory",
      path.join(os.homedir(), ".claude")
    )
    .option(
      "--dry-run",
      "Preview files and events without sending to API",
      false
    )
    .option(
      "--limit <number>",
      "Limit number of events to process per file",
      "100"
    )
    .action(async (options) => {
      await importClaudeUsage(options);
    });
}

interface ClaudeOptions {
  claudeDir: string;
  dryRun: boolean;
  limit: string;
}

interface ClaudeEvent {
  type: string;
  sessionId?: string;
  version?: string;
  timestamp?: string;
  uuid?: string;
  message?: {
    role: string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  cwd?: string;
  userType?: string;
}

async function importClaudeUsage(options: ClaudeOptions): Promise<void> {
  const projectsDir = path.join(options.claudeDir, "projects");

  if (!fs.existsSync(projectsDir)) {
    logger.error(`Claude projects directory not found: ${projectsDir}`);
    logger.info(
      "Try running with --claude-dir <path> if Claude is installed elsewhere"
    );
    process.exit(1);
  }

  // Find all JSONL files
  const jsonlFiles = findJsonlFiles(projectsDir);

  if (jsonlFiles.length === 0) {
    logger.info("No Claude Code JSONL files found");
    return;
  }

  logger.info(`Found ${jsonlFiles.length} Claude Code session files`);

  if (options.dryRun) {
    logger.info("[DRY RUN] Would process the following files:");
    jsonlFiles.forEach((file) => {
      const projectPath = extractProjectPath(file);
      logger.info(`  - ${path.basename(file)} (${projectPath})`);
    });
    return;
  }

  const limit = parseInt(options.limit, 10);
  let totalEvents = 0;

  for (const jsonlFile of jsonlFiles) {
    try {
      const events = await processJsonlFile(jsonlFile, limit);
      totalEvents += events;
      logger.info(
        `Processed ${events} events from ${path.basename(jsonlFile)}`
      );
    } catch (error) {
      logger.error(
        `Failed to process ${jsonlFile}: ${(error as Error).message}`
      );
    }
  }

  logger.info(`Successfully imported ${totalEvents} Claude Code events`);
}

export function findJsonlFiles(projectsDir: string): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectPath = path.join(projectsDir, entry.name);
        const projectFiles = fs
          .readdirSync(projectPath)
          .filter((file) => file.endsWith(".jsonl"))
          .map((file) => path.join(projectPath, file));
        files.push(...projectFiles);
      }
    }
  } catch (error) {
    logger.error(
      `Failed to scan projects directory: ${(error as Error).message}`
    );
  }

  return files;
}

export function extractProjectPath(jsonlFile: string): string {
  // Extract project path from directory name like "-Users-mhostetler-Source-Project-name"
  const dirName = path.basename(path.dirname(jsonlFile));
  if (dirName.startsWith("-")) {
    return dirName.substring(1).replace(/-/g, "/");
  }
  return dirName;
}

async function processJsonlFile(
  filePath: string,
  limit: number
): Promise<number> {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n").slice(0, limit);

  const projectPath = extractProjectPath(filePath);
  const sessionId = path.basename(filePath, ".jsonl");
  let eventCount = 0;

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const event: ClaudeEvent = JSON.parse(line);

      // Only process assistant messages with usage data or significant user interactions
      if (shouldProcessEvent(event)) {
        const ardenEvent = transformToArdenEvent(event, projectPath, sessionId);
        await sendTelemetry("claude.usage", ardenEvent);
        eventCount++;
      }
    } catch (error) {
      logger.debug(
        `Skipped malformed JSON line in ${filePath}: ${
          (error as Error).message
        }`
      );
    }
  }

  return eventCount;
}

export function shouldProcessEvent(event: ClaudeEvent): boolean {
  // Process assistant messages with usage data
  if (event.type === "assistant" && event.message?.usage) {
    return true;
  }

  // Process significant user interactions (not meta messages)
  if (event.type === "user" && !event.message?.content?.includes("isMeta")) {
    const content = event.message?.content;
    if (typeof content === "string" && content.length > 50) {
      return true;
    }
  }

  return false;
}

export function transformToArdenEvent(
  event: ClaudeEvent,
  projectPath: string,
  sessionId: string
) {
  const usage = event.message?.usage;

  // Calculate cost estimate based on usage (rough estimation)
  let costMicroCents = 0;
  if (usage) {
    // Rough cost estimation for Claude models (in micro-cents)
    const inputTokenCost = (usage.input_tokens || 0) * 0.3; // ~$3/1M tokens
    const outputTokenCost = (usage.output_tokens || 0) * 1.5; // ~$15/1M tokens
    const cacheCost = (usage.cache_creation_input_tokens || 0) * 0.3;
    costMicroCents = Math.round(inputTokenCost + outputTokenCost + cacheCost);
  }

  return {
    provider: AgentIds.CLAUDE_CODE,
    sessionId,
    projectPath,
    timestamp: event.timestamp || new Date().toISOString(),
    event: {
      type: event.type,
      model: event.message?.model,
      role: event.message?.role,
      usage: usage || undefined,
      version: event.version,
      userType: event.userType,
      workingDirectory: event.cwd,
      estimatedCostMicroCents: costMicroCents > 0 ? costMicroCents : undefined,
    },
  };
}
