import { readdir, stat, readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { buildEvent, TelemetryEvent } from "./schema";
import logger from "./logger";

export interface AmpThread {
  threadId: string;
  createdAt: Date;
  path: string;
  size: number;
}

export async function findAmpThreads(): Promise<AmpThread[]> {
  const ampDir = join(homedir(), ".amp", "file-changes");
  
  try {
    const entries = await readdir(ampDir);
    const threads: AmpThread[] = [];
    
    for (const entry of entries) {
      if (entry.startsWith("T-")) {
        const threadPath = join(ampDir, entry);
        const stats = await stat(threadPath);
        
        if (stats.isDirectory()) {
          threads.push({
            threadId: entry,
            createdAt: stats.birthtime,
            path: threadPath,
            size: await getDirectorySize(threadPath)
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
    let totalSize = 0;
    
    for (const entry of entries) {
      const entryPath = join(dirPath, entry);
      const stats = await stat(entryPath);
      
      if (stats.isFile()) {
        totalSize += stats.size;
      } else if (stats.isDirectory()) {
        totalSize += await getDirectorySize(entryPath);
      }
    }
    
    return totalSize;
  } catch {
    return 0;
  }
}

export function createAmpHistoryEvents(threads: AmpThread[]): TelemetryEvent[] {
  return threads.map(thread => 
    buildEvent({
      agent: "A-AMP",
      time: thread.createdAt.getTime(),
      bid: 0,
      mult: 1,
      data: {
        thread_id: thread.threadId,
        type: "historical_thread",
        size_bytes: thread.size,
        source: "amp_file_changes"
      }
    })
  );
}

export function formatThreadSummary(threads: AmpThread[]): string {
  const totalSize = threads.reduce((sum, t) => sum + t.size, 0);
  const oldestDate = threads.length > 0 ? threads[0].createdAt : null;
  const newestDate = threads.length > 0 ? threads[threads.length - 1].createdAt : null;
  
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  const formatDate = (date: Date): string => date.toLocaleDateString();
  
  let summary = `Found ${threads.length} Amp thread(s)`;
  
  if (threads.length > 0) {
    summary += `\n  Total size: ${formatBytes(totalSize)}`;
    summary += `\n  Date range: ${formatDate(oldestDate!)} to ${formatDate(newestDate!)}`;
  }
  
  return summary;
}
