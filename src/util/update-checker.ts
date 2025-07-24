import ky from 'ky';
import { readFileSync } from 'fs';
import { join } from 'path';
import logger from './logger';
import { output } from './output';
import { loadSettings, saveSettings } from './settings';

interface NpmPackageInfo {
  'dist-tags': {
    latest: string;
  };
  versions: Record<string, any>;
}

interface UpdateCheckCache {
  lastChecked: number;
  latestVersion: string;
  skipVersion?: string;
}

const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const NPM_REGISTRY_URL = 'https://registry.npmjs.org';

/**
 * Get the current version from package.json
 */
function getCurrentVersion(): string {
  try {
    // In production (built version), package.json is adjacent to dist/
    // In development, it's up two levels from src/util/
    const possiblePaths = [
      join(process.cwd(), 'package.json'), // Current working directory
      join(__dirname, '../../package.json'), // Development path
      join(__dirname, '../package.json'), // Built version path
    ];

    for (const packageJsonPath of possiblePaths) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.name === 'arden' && packageJson.version) {
          return packageJson.version;
        }
      } catch {
        // Try next path
        continue;
      }
    }

    logger.debug('Could not find package.json with version');
    return '0.8.2'; // Fallback to known current version
  } catch (error) {
    logger.error('Failed to read current version from package.json', error);
    return '0.8.2';
  }
}

/**
 * Fetch the latest version from NPM registry
 */
async function fetchLatestVersion(packageName: string): Promise<string | null> {
  try {
    const response = await ky.get(`${NPM_REGISTRY_URL}/${packageName}`, {
      timeout: 5000,
      retry: 1,
    });

    const packageInfo: NpmPackageInfo = await response.json();
    return packageInfo['dist-tags'].latest;
  } catch (error) {
    logger.debug('Failed to fetch latest version from NPM', error);
    return null;
  }
}

/**
 * Compare two semver versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

/**
 * Check if an update is available, with caching
 */
export async function checkForUpdate(packageName: string = 'arden'): Promise<{
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
} | null> {
  const currentVersion = getCurrentVersion();
  const settings = loadSettings();
  const cache = settings.updateCheckCache as UpdateCheckCache | undefined;

  // Check if we should skip this version
  if (cache?.skipVersion === currentVersion) {
    return null;
  }

  // Check cache validity
  const now = Date.now();
  if (cache && now - cache.lastChecked < UPDATE_CHECK_INTERVAL) {
    if (cache.latestVersion && compareVersions(cache.latestVersion, currentVersion) > 0) {
      return {
        updateAvailable: true,
        currentVersion,
        latestVersion: cache.latestVersion,
      };
    }
    return null;
  }

  // Fetch latest version
  const latestVersion = await fetchLatestVersion(packageName);
  if (!latestVersion) {
    return null;
  }

  // Update cache
  const newCache: UpdateCheckCache = {
    lastChecked: now,
    latestVersion,
    skipVersion: cache?.skipVersion,
  };

  saveSettings({ updateCheckCache: newCache });

  // Check if update is available
  const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

  if (updateAvailable) {
    return {
      updateAvailable: true,
      currentVersion,
      latestVersion,
    };
  }

  return null;
}

/**
 * Display update notification message
 */
export function displayUpdateMessage(currentVersion: string, latestVersion: string): void {
  output.info('┌─────────────────────────────────────────────────────────────┐');
  output.info('│                    Update Available                         │');
  output.info('├─────────────────────────────────────────────────────────────┤');
  output.info(`│  Current version: ${currentVersion.padEnd(43)} │`);
  output.info(`│  Latest version:  ${latestVersion.padEnd(43)} │`);
  output.info('│                                                             │');
  output.info('│  Run: npm install -g arden@latest                           │');
  output.info('│                                                             │');
  output.info('│  To skip this version: arden config --skip-version         │');
  output.info('└─────────────────────────────────────────────────────────────┘');
}

/**
 * Skip the current version in future update checks
 */
export function skipCurrentVersion(): void {
  const currentVersion = getCurrentVersion();
  const settings = loadSettings();
  const cache = settings.updateCheckCache as UpdateCheckCache | undefined;

  const newCache: UpdateCheckCache = {
    lastChecked: cache?.lastChecked || Date.now(),
    latestVersion: cache?.latestVersion || currentVersion,
    skipVersion: currentVersion,
  };

  saveSettings({ updateCheckCache: newCache });
  output.success(`Skipping version ${currentVersion} in future update checks`);
}

/**
 * Check for updates and display message if available
 */
export async function checkAndDisplayUpdate(): Promise<void> {
  try {
    const updateInfo = await checkForUpdate();
    if (updateInfo?.updateAvailable) {
      displayUpdateMessage(updateInfo.currentVersion, updateInfo.latestVersion);
    }
  } catch (error) {
    logger.debug('Update check failed', error);
    // Silently fail - update checks shouldn't interrupt normal operation
  }
}
