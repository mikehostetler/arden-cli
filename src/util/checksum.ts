import { createHash } from 'crypto';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Calculate SHA-256 checksum of a file
 */
export function calculateFileChecksum(filePath: string): string {
  try {
    const fileBuffer = readFileSync(filePath);
    const hashSum = createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (error) {
    throw new Error(`Failed to calculate checksum for ${filePath}: ${(error as Error).message}`);
  }
}

/**
 * Calculate SHA-256 checksum of a directory based on its structure and modification times
 */
export function calculateDirectoryChecksum(dirPath: string): string {
  try {
    const hash = createHash('sha256');

    function processDirectory(currentPath: string) {
      const entries = readdirSync(currentPath, { withFileTypes: true });

      // Sort entries for consistent hashing
      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);
        const relativePath = fullPath.replace(dirPath, '');

        hash.update(relativePath);

        if (entry.isFile()) {
          const stats = statSync(fullPath);
          hash.update(stats.mtime.toISOString());
          hash.update(stats.size.toString());
        } else if (entry.isDirectory()) {
          processDirectory(fullPath);
        }
      }
    }

    processDirectory(dirPath);
    return hash.digest('hex');
  } catch (error) {
    throw new Error(
      `Failed to calculate directory checksum for ${dirPath}: ${(error as Error).message}`
    );
  }
}
