import { readdir, stat } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

import { logger } from './logging';
import { buildEvent, TelemetryEvent } from './schema';
import { formatBytes, formatDateRange } from './time';

export interface AmpThread {
  threadId: string;
  createdAt: Date;
  path: string;
  size: number;
}

export async function findAmpThreads(): Promise<AmpThread[]> {
  const ampDir = join(homedir(), '.amp', 'file-changes');

  try {
    const entries = await readdir(ampDir);
    const threads: AmpThread[] = [];

    for (const entry of entries) {
      if (entry.startsWith('T-')) {
        const threadPath = join(ampDir, entry);
        const stats = await stat(threadPath);

        if (stats.isDirectory()) {
          threads.push({
            threadId: entry,
            createdAt: stats.birthtime,
            path: threadPath,
            size: await getDirectorySize(threadPath),
          });
        }
      }
    }

    // Sort by creation date (oldest first)
    return threads.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  } catch (error) {
    logger.debug(`Could not read Amp directory: ${(error as Error).message}`);
    return [];
  }
}

async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const entries = await readdir(dirPath);

    // Process entries in parallel for better performance
    const sizePromises = entries.map(async (entry): Promise<number> => {
      const entryPath = join(dirPath, entry);
      try {
        const stats = await stat(entryPath);

        if (stats.isFile()) {
          return stats.size;
        } else if (stats.isDirectory()) {
          return await getDirectorySize(entryPath);
        }
        return 0;
      } catch {
        return 0;
      }
    });

    const sizes = await Promise.all(sizePromises);
    return sizes.reduce((total, size) => total + size, 0);
  } catch {
    return 0;
  }
}

export function createAmpHistoryEvents(threads: AmpThread[]): TelemetryEvent[] {
  return threads.map(thread =>
    buildEvent({
      agent: 'A-AMP',
      time: thread.createdAt.getTime(),
      bid: 0,
      mult: 1,
      data: {
        thread_id: thread.threadId,
        type: 'historical_thread',
        size_bytes: thread.size,
        source: 'amp_file_changes',
      },
    })
  );
}

export function formatThreadSummary(threads: AmpThread[]): string {
  const totalSize = threads.reduce((sum, t) => sum + t.size, 0);
  const oldestDate = threads.length > 0 ? threads[0].createdAt : null;
  const newestDate = threads.length > 0 ? threads[threads.length - 1].createdAt : null;

  let summary = `Found ${threads.length} Amp thread(s)`;

  if (threads.length > 0) {
    summary += `\n  Total size: ${formatBytes(totalSize)}`;
    summary += `\n  Date range: ${formatDateRange(oldestDate!, newestDate!)}`;
  }

  return summary;
}
