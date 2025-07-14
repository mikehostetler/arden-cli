import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import logger from '../util/logger';
import env from '../util/env';

interface FileChangeData {
  id: string;
  uri: string;
  before: string;
  after: string;
  diff: string;
  isNewFile: boolean;
  reverted: boolean;
  timestamp: number;
}

interface ImportStats {
  threadsProcessed: number;
  filesProcessed: number;
  totalChanges: number;
  errors: string[];
}

const ampCacheDir = path.join(os.homedir(), '.amp', 'file-changes');

async function getThreadDirectories(): Promise<string[]> {
  try {
    const entries = await fs.readdir(ampCacheDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('T-'))
      .map(entry => entry.name);
  } catch (error) {
    logger.error(`Failed to read Amp cache directory: ${error}`);
    return [];
  }
}

async function parseFileChangeData(filePath: string): Promise<FileChangeData | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    
    // Validate required fields
    if (!data.id || !data.uri || typeof data.timestamp !== 'number') {
      logger.warn(`Invalid file change data structure in ${filePath}`);
      return null;
    }
    
    return data as FileChangeData;
  } catch (error) {
    logger.error(`Failed to parse file change data from ${filePath}: ${error}`);
    return null;
  }
}

async function sendToArdenAPI(threadId: string, changes: FileChangeData[], host?: string): Promise<void> {
  const apiHost = host || env.HOST;
  const payload = {
    threadId,
    changes: changes.map(change => ({
      id: change.id,
      uri: change.uri,
      isNewFile: change.isNewFile,
      reverted: change.reverted,
      timestamp: change.timestamp,
      linesAdded: change.diff.split('\n').filter(line => line.startsWith('+')).length,
      linesRemoved: change.diff.split('\n').filter(line => line.startsWith('-')).length,
      filePath: change.uri.replace('file://', ''),
      changeType: change.isNewFile ? 'create' : (change.reverted ? 'revert' : 'modify')
    })),
    importedAt: new Date().toISOString()
  };

  logger.debug(`Sending ${changes.length} changes for thread ${threadId} to Arden API`);
  
  // TODO: Implement actual API call to Arden Stats API
  // For now, just log the payload structure
  logger.info(`Would send to ${apiHost}/api/amp/file-changes`);
  logger.debug(`Payload: ${JSON.stringify(payload, null, 2)}`);
}

async function processThread(threadId: string, host?: string): Promise<{ changes: number; errors: string[] }> {
  const threadDir = path.join(ampCacheDir, threadId);
  const errors: string[] = [];
  const changes: FileChangeData[] = [];
  
  try {
    const files = await fs.readdir(threadDir);
    
    for (const file of files) {
      if (file.startsWith('.')) continue; // Skip hidden files
      
      const filePath = path.join(threadDir, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isFile()) {
        const changeData = await parseFileChangeData(filePath);
        if (changeData) {
          changes.push(changeData);
        } else {
          errors.push(`Failed to parse ${file} in thread ${threadId}`);
        }
      }
    }
    
    if (changes.length > 0) {
      await sendToArdenAPI(threadId, changes, host);
    }
    
    return { changes: changes.length, errors };
  } catch (error) {
    const errorMsg = `Failed to process thread ${threadId}: ${error}`;
    logger.error(errorMsg);
    return { changes: 0, errors: [errorMsg] };
  }
}

const importCommand = new Command('import')
  .description('Import Amp file changes cache data into Arden Stats')
  .option('-t, --thread <threadId>', 'Import specific thread ID only')
  .option('--dry-run', 'Show what would be imported without actually sending data')
  .option('--since <date>', 'Only import changes since specified date (ISO format)')
  .action(async (options, command) => {
    logger.info('Starting Amp file changes import...');
    
    const stats: ImportStats = {
      threadsProcessed: 0,
      filesProcessed: 0,
      totalChanges: 0,
      errors: []
    };
    
    // Check if Amp cache directory exists
    try {
      await fs.access(ampCacheDir);
    } catch (error) {
      logger.error(`Amp cache directory not found: ${ampCacheDir}`);
      logger.info('Make sure Amp has been used and has cached file changes');
      return;
    }
    
    let threadIds: string[];
    
    if (options.thread) {
      threadIds = [options.thread];
      logger.info(`Importing specific thread: ${options.thread}`);
    } else {
      threadIds = await getThreadDirectories();
      logger.info(`Found ${threadIds.length} thread directories`);
    }
    
    if (threadIds.length === 0) {
      logger.warn('No thread directories found to process');
      return;
    }
    
    // Get host from parent command (global option)
    const parentOptions = command.parent?.opts() || {};
    const host = parentOptions.host;
    
    // Process threads
    for (const threadId of threadIds) {
      logger.info(`Processing thread: ${threadId}`);
      const result = await processThread(threadId, host);
      
      stats.threadsProcessed++;
      stats.totalChanges += result.changes;
      stats.errors.push(...result.errors);
      
      if (result.changes > 0) {
        logger.info(`  ✓ Imported ${result.changes} file changes`);
      } else {
        logger.warn(`  ⚠ No valid changes found in thread ${threadId}`);
      }
    }
    
    // Report final stats
    logger.info('Import completed!');
    logger.info(`Threads processed: ${stats.threadsProcessed}`);
    logger.info(`Total file changes: ${stats.totalChanges}`);
    
    if (stats.errors.length > 0) {
      logger.warn(`Errors encountered: ${stats.errors.length}`);
      if (env.LOG_LEVEL === 'debug') {
        stats.errors.forEach(error => logger.debug(`  - ${error}`));
      }
    }
  });

export const ampCommand = new Command('amp')
  .description('Amp integration commands')
  .addCommand(importCommand);
