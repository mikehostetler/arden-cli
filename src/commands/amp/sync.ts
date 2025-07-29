import chalk from 'chalk';
import * as cliProgress from 'cli-progress';
import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { AGENTS } from '../../agents';
import { calculateDirectoryChecksum } from '../../util/checksum';
import { sendTelemetry } from '../../util/client';
import { logger, output } from '../../util/logging';
import { getUserId, isAmpThreadSynced, recordAmpThreadSynced } from '../../util/settings';
import { checkUserOrPrompt } from '../../util/user-prompt';

export function buildSyncCommand(): Command {
  return new Command('sync')
    .description('Sync Amp threads from file-changes directory to Arden')
    .option(
      '--threads <path>',
      'Path to file-changes directory',
      path.join(os.homedir(), 'file-changes')
    )
    .option('-y, --yes', 'Skip confirmation prompts', false)
    .option('--force', 'Force sync all threads, ignoring cached state', false)
    .action(async (options, command) => {
      // Get host from root command (global option)
      let rootCommand = command;
      while (rootCommand.parent) {
        rootCommand = rootCommand.parent;
      }
      const host = rootCommand.getOptionValue('host');
      const combinedOptions = { ...options, host };

      await syncAmpThreads(combinedOptions);
    });
}

interface AmpOptions {
  threads: string;
  yes: boolean;
  force: boolean;
  host?: string;
}

interface AmpThread {
  threadId: string;
  path: string;
  createdAt: string;
  size: number;
  fileCount: number;
}

async function syncAmpThreads(options: AmpOptions): Promise<void> {
  // Check if user wants to proceed with anonymous events if no user ID
  const userId = getUserId();
  const shouldProceed = await checkUserOrPrompt(userId);
  if (!shouldProceed) {
    logger.info('Amp sync cancelled.');
    return;
  }

  const threadsDir = path.resolve(options.threads);

  if (!fs.existsSync(threadsDir)) {
    logger.error(`Amp threads directory not found: ${threadsDir}`);
    logger.info('Try running with --threads <path> to specify the correct directory');
    process.exit(1);
  }

  // Find all thread directories
  const threads = findThreadDirectories(threadsDir);

  if (threads.length === 0) {
    logger.info('No Amp thread directories found');
    return;
  }

  output.message(chalk.dim(`Found ${threads.length} Amp thread directories`));

  // Filter threads that need syncing
  const threadsToSync = [];
  let skippedThreads = 0;

  for (const thread of threads) {
    if (!options.force) {
      const checksum = calculateDirectoryChecksum(thread.path);
      if (isAmpThreadSynced(thread.path, checksum)) {
        logger.debug(`Skipping already synced thread: ${thread.threadId}`);
        skippedThreads++;
        continue;
      }
    }
    threadsToSync.push(thread);
  }

  if (threadsToSync.length === 0) {
    output.info('All threads are already synced (use --force to re-sync)');
    return;
  }

  // Create progress bar for sync operations
  const progressBar = new cliProgress.SingleBar({
    format: 'Syncing threads |{bar}| {percentage}% | {value}/{total} threads',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });

  progressBar.start(threadsToSync.length, 0);

  let totalEvents = 0;
  for (const thread of threadsToSync) {
    try {
      const events = await processAmpThread(thread, options.host, options.force, true);
      totalEvents += events;
      progressBar.increment();
    } catch (error) {
      logger.error(`Failed to process thread ${thread.threadId}: ${(error as Error).message}`);
      progressBar.increment();
    }
  }

  progressBar.stop();

  if (skippedThreads > 0) {
    output.info(`Skipped ${skippedThreads} already synced threads (use --force to re-sync)`);
  }
  output.success(`Successfully synced ${totalEvents} Amp thread events`);
}

export function findThreadDirectories(threadsDir: string): AmpThread[] {
  const threads: AmpThread[] = [];

  try {
    const entries = fs.readdirSync(threadsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const threadPath = path.join(threadsDir, entry.name);
        const stats = fs.statSync(threadPath);

        // Count files in the thread directory
        const files = countFilesRecursively(threadPath);

        threads.push({
          threadId: entry.name,
          path: threadPath,
          createdAt: stats.birthtime.toISOString(),
          size: getDirectorySize(threadPath),
          fileCount: files,
        });
      }
    }
  } catch (error) {
    logger.error(`Failed to scan threads directory: ${(error as Error).message}`);
  }

  // Sort by creation date (newest first)
  return threads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function countFilesRecursively(dir: string): number {
  let count = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        count++;
      } else if (entry.isDirectory()) {
        count += countFilesRecursively(path.join(dir, entry.name));
      }
    }
  } catch {
    // Ignore errors for individual directories
  }
  return count;
}

function getDirectorySize(dir: string): number {
  let size = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile()) {
        size += fs.statSync(fullPath).size;
      } else if (entry.isDirectory()) {
        size += getDirectorySize(fullPath);
      }
    }
  } catch {
    // Ignore errors for individual directories
  }
  return size;
}

async function processAmpThread(
  thread: AmpThread,
  host?: string,
  _force?: boolean,
  showProgress = false
): Promise<number> {
  try {
    const ardenEvent = transformToArdenEvent(thread);
    await sendTelemetry('amp.thread', ardenEvent, host, false, showProgress);

    // Record sync state for this thread
    const checksum = calculateDirectoryChecksum(thread.path);
    recordAmpThreadSynced(thread.path, checksum, 1);

    return 1;
  } catch (error) {
    logger.error(`Failed to process thread ${thread.threadId}: ${(error as Error).message}`);
    return 0;
  }
}

export function transformToArdenEvent(thread: AmpThread) {
  return {
    provider: AGENTS.AMP,
    hook: 'thread',
    timestamp: thread.createdAt,
    payload: {
      threadId: thread.threadId,
      thread: {
        id: thread.threadId,
        createdAt: thread.createdAt,
        path: thread.path,
        fileCount: thread.fileCount,
        totalSize: thread.size,
        type: 'file-changes',
      },
    },
  };
}
