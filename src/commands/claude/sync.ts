import * as cliProgress from 'cli-progress';
import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { AGENTS } from '../../agents';
import { calculateFileChecksum } from '../../util/checksum';
import { sendTelemetry } from '../../util/client';
import { logger, output } from '../../util/logging';
import { getUserId, isFileSynced, recordFileSynced } from '../../util/settings';
import { getCurrentDateISO } from '../../util/time';
import { checkUserOrPrompt } from '../../util/user-prompt';

export function buildSyncCommand(): Command {
  return new Command('sync')
    .description('Sync Claude Code usage data from local JSONL files to Arden')
    .option(
      '--claude-dir <path>',
      'Custom path to Claude data directory',
      path.join(os.homedir(), '.claude')
    )
    .option('--limit <number>', 'Limit number of events to process per file', '100')
    .option('--force', 'Force sync all files, ignoring cached state', false)
    .action(async options => {
      await syncClaudeUsage(options);
    });
}

interface ClaudeOptions {
  claudeDir: string;
  limit: string;
  force: boolean;
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
    content?: string;
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

async function syncClaudeUsage(options: ClaudeOptions): Promise<void> {
  // Check if user wants to proceed with anonymous events if no user ID
  const userId = getUserId();
  const shouldProceed = await checkUserOrPrompt(userId);
  if (!shouldProceed) {
    logger.info('Claude sync cancelled.');
    return;
  }

  const projectsDir = path.join(options.claudeDir, 'projects');

  if (!fs.existsSync(projectsDir)) {
    logger.error(`Claude projects directory not found: ${projectsDir}`);
    logger.info('Try running with --claude-dir <path> if Claude is installed elsewhere');
    process.exit(1);
  }

  // Find all JSONL files
  const jsonlFiles = findJsonlFiles(projectsDir);

  if (jsonlFiles.length === 0) {
    logger.info('No Claude Code JSONL files found');
    return;
  }

  output.info(`Found ${jsonlFiles.length} Claude Code session files`);

  const limit = parseInt(options.limit, 10);
  
  // Filter files that need syncing
  const filesToSync = [];
  let skippedFiles = 0;

  for (const jsonlFile of jsonlFiles) {
    if (!options.force) {
      const checksum = calculateFileChecksum(jsonlFile);
      if (isFileSynced(jsonlFile, checksum)) {
        logger.debug(`Skipping already synced file: ${path.basename(jsonlFile)}`);
        skippedFiles++;
        continue;
      }
    }
    filesToSync.push(jsonlFile);
  }

  if (filesToSync.length === 0) {
    output.info('All files are already synced (use --force to re-sync)');
    return;
  }

  // Create progress bar for sync operations
  const progressBar = new cliProgress.SingleBar({
    format: 'Syncing sessions |{bar}| {percentage}% | {value}/{total} sessions',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });
  
  progressBar.start(filesToSync.length, 0);

  let totalEvents = 0;
  for (const jsonlFile of filesToSync) {
    try {
      const events = await processJsonlFile(jsonlFile, limit, options.force, true);
      totalEvents += events;
      progressBar.increment();
    } catch (error) {
      logger.error(`Failed to process ${jsonlFile}: ${(error as Error).message}`);
      progressBar.increment();
    }
  }

  progressBar.stop();

  if (skippedFiles > 0) {
    output.info(`Skipped ${skippedFiles} already synced files (use --force to re-sync)`);
  }
  output.success(`Successfully synced ${totalEvents} Claude Code events`);
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
          .filter(file => file.endsWith('.jsonl'))
          .map(file => path.join(projectPath, file));
        files.push(...projectFiles);
      }
    }
  } catch (error) {
    logger.error(`Failed to scan projects directory: ${(error as Error).message}`);
  }

  return files;
}

export function extractProjectPath(jsonlFile: string): string {
  // Extract project path from directory name like "-Users-mhostetler-Source-Project-name"
  const dirName = path.basename(path.dirname(jsonlFile));
  if (dirName.startsWith('-')) {
    return dirName.substring(1).replace(/-/g, '/');
  }
  return dirName;
}

async function processJsonlFile(filePath: string, limit: number, force?: boolean, showProgress = false): Promise<number> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').slice(0, limit);

  const projectPath = extractProjectPath(filePath);
  const sessionId = path.basename(filePath, '.jsonl');
  let eventCount = 0;

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const event: ClaudeEvent = JSON.parse(line);

      // Only process assistant messages with usage data or significant user interactions
      if (shouldProcessEvent(event)) {
        const ardenEvent = transformToArdenEvent(event, projectPath, sessionId);
        await sendTelemetry('claude.usage', ardenEvent, undefined, false, showProgress);
        eventCount++;
      }
    } catch (error) {
      logger.debug(`Skipped malformed JSON line in ${filePath}: ${(error as Error).message}`);
    }
  }

  // Record sync state for this file
  if (eventCount > 0 || force) {
    const checksum = calculateFileChecksum(filePath);
    recordFileSynced(filePath, checksum, eventCount);
  }

  return eventCount;
}

export function shouldProcessEvent(event: ClaudeEvent): boolean {
  // Process assistant messages with usage data
  if (event.type === 'assistant' && event.message?.usage) {
    return true;
  }

  // Process significant user interactions (not meta messages)
  if (event.type === 'user' && !event.message?.content?.includes('isMeta')) {
    const content = event.message?.content;
    if (typeof content === 'string' && content.length > 50) {
      return true;
    }
  }

  return false;
}

export function transformToArdenEvent(event: ClaudeEvent, projectPath: string, sessionId: string) {
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
    provider: AGENTS.CLAUDE,
    hook: 'message',
    timestamp: event.timestamp || getCurrentDateISO(),
    payload: {
      sessionId,
      projectPath,
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
    },
  };
}
