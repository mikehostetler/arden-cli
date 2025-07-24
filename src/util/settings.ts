import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { z } from 'zod';

// Zod schema for Claude sync state
const ClaudeSyncStateSchema = z.object({
  last_sync: z.string().datetime().optional(),
  synced_files: z
    .array(
      z.object({
        path: z.string(),
        checksum: z.string(),
        last_modified: z.string().datetime(),
        events_processed: z.number(),
      })
    )
    .optional(),
});

// Zod schema for Amp sync state
const AmpSyncStateSchema = z.object({
  last_sync: z.string().datetime().optional(),
  synced_threads: z
    .array(
      z.object({
        path: z.string(),
        checksum: z.string(),
        last_modified: z.string().datetime(),
        events_processed: z.number(),
      })
    )
    .optional(),
});

// Zod schema for ArdenSettings validation
export const ArdenSettingsSchema = z.object({
  // Core settings
  api_token: z.string().optional(),
  user_id: z.string().optional(),
  host: z.string().url().optional(),

  // CLI preferences
  log_level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  default_format: z.enum(['json', 'table', 'yaml']).optional(),
  interactive: z.boolean().optional(),

  // Sync state tracking
  claude_sync: ClaudeSyncStateSchema.optional(),
  amp_sync: AmpSyncStateSchema.optional(),
});

export type ArdenSettings = z.infer<typeof ArdenSettingsSchema>;

const SETTINGS_DIR = join(homedir(), '.arden');
const SETTINGS_FILE = join(SETTINGS_DIR, 'settings.json');

/**
 * Ensure the settings directory exists
 */
function ensureSettingsDir(): void {
  if (!existsSync(SETTINGS_DIR)) {
    mkdirSync(SETTINGS_DIR, { recursive: true });
  }
}

/**
 * Load settings with priority:
 * 1. CLI options (passed explicitly)
 * 2. Environment variables
 * 3. Settings file (~/.arden/settings.json)
 * 4. Defaults
 */
export function loadSettings(): ArdenSettings {
  const defaults: ArdenSettings = {
    host: 'https://ardenstats.com',
    log_level: 'info',
    default_format: 'table',
    interactive: true,
  };

  let fileSettings: ArdenSettings = {};

  try {
    if (existsSync(SETTINGS_FILE)) {
      const data = readFileSync(SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      // Validate parsed settings against schema
      const validation = ArdenSettingsSchema.safeParse(parsed);
      if (validation.success) {
        fileSettings = validation.data;
      } else {
        console.warn(`Invalid settings file format: ${validation.error.message}`);
      }
    }
  } catch (error) {
    console.warn(
      `Failed to read settings file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Merge with environment variables (only ARDEN_* prefixed ones)
  const envSettings: Partial<ArdenSettings> = {};

  if (process.env.ARDEN_API_TOKEN) {
    envSettings.api_token = process.env.ARDEN_API_TOKEN;
  }
  if (process.env.ARDEN_USER_ID) {
    envSettings.user_id = process.env.ARDEN_USER_ID;
  }
  if (process.env.ARDEN_HOST) {
    envSettings.host = process.env.ARDEN_HOST;
  }
  if (process.env.ARDEN_LOG_LEVEL) {
    envSettings.log_level = process.env.ARDEN_LOG_LEVEL as ArdenSettings['log_level'];
  }
  if (process.env.ARDEN_DEFAULT_FORMAT) {
    envSettings.default_format = process.env
      .ARDEN_DEFAULT_FORMAT as ArdenSettings['default_format'];
  }
  if (process.env.ARDEN_INTERACTIVE) {
    envSettings.interactive = process.env.ARDEN_INTERACTIVE === 'true';
  }

  // Support legacy environment variables with deprecation warnings
  if (process.env.HOST && !process.env.ARDEN_HOST) {
    console.warn(
      'DEPRECATION WARNING: HOST environment variable is deprecated. Use ARDEN_HOST instead.'
    );
    envSettings.host = process.env.HOST;
  }
  if (process.env.LOG_LEVEL && !process.env.ARDEN_LOG_LEVEL) {
    console.warn(
      'DEPRECATION WARNING: LOG_LEVEL environment variable is deprecated. Use ARDEN_LOG_LEVEL instead.'
    );
    envSettings.log_level = process.env.LOG_LEVEL as ArdenSettings['log_level'];
  }

  // Validate final merged settings
  const mergedSettings = { ...defaults, ...fileSettings, ...envSettings };
  const validation = ArdenSettingsSchema.safeParse(mergedSettings);

  if (!validation.success) {
    console.warn(`Invalid settings configuration: ${validation.error.message}`);
    return defaults;
  }

  return validation.data;
}

/**
 * Save settings to file
 */
export function saveSettings(settings: Partial<ArdenSettings>): void {
  try {
    ensureSettingsDir();

    const currentSettings = loadSettings();
    const newSettings = { ...currentSettings, ...settings };

    // Remove undefined/null values
    Object.keys(newSettings).forEach(key => {
      if (newSettings[key as keyof ArdenSettings] == null) {
        delete newSettings[key as keyof ArdenSettings];
      }
    });

    // Validate settings before saving
    const validation = ArdenSettingsSchema.safeParse(newSettings);
    if (!validation.success) {
      throw new Error(`Invalid settings: ${validation.error.message}`);
    }

    const data = JSON.stringify(validation.data, null, 2);
    writeFileSync(SETTINGS_FILE, data, 'utf8');
  } catch (error) {
    throw new Error(
      `Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get setting value with explicit CLI option override
 */
export function getSettingValue<K extends keyof ArdenSettings>(
  key: K,
  cliValue?: ArdenSettings[K]
): ArdenSettings[K] {
  if (cliValue !== undefined) {
    return cliValue;
  }

  const settings = loadSettings();
  return settings[key];
}

/**
 * Common setting helpers for commands
 */
export function getApiToken(cliToken?: string): string | undefined {
  return getSettingValue('api_token', cliToken);
}

export function getUserId(cliUserId?: string): string | undefined {
  return getSettingValue('user_id', cliUserId);
}

export function getHost(cliHost?: string): string {
  return getSettingValue('host', cliHost) || 'https://ardenstats.com';
}

export function getLogLevel(cliLogLevel?: string): string {
  return getSettingValue('log_level', cliLogLevel) || 'info';
}

export async function ensureApiToken(_options: {
  yes?: boolean;
  host?: string;
}): Promise<string | null> {
  const token = getApiToken();
  if (token) {
    return token;
  }

  // For backward compatibility, just return null for now
  // This function was complex and can be reimplemented later if needed
  return null;
}

// Export the sync state schema type for use in sync command
export type ClaudeSyncFile = {
  path: string;
  checksum: string;
  last_modified: string;
  events_processed: number;
};

export type ClaudeSyncState = {
  last_sync?: string;
  synced_files?: ClaudeSyncFile[];
};

/**
 * Get Claude sync state from settings
 */
export function getClaudeSyncState(): ClaudeSyncState {
  const settings = loadSettings();
  return settings.claude_sync || {};
}

/**
 * Save Claude sync state to settings
 */
export function saveClaudeSyncState(syncState: ClaudeSyncState): void {
  const currentSettings = loadSettings();
  const updatedSettings = {
    ...currentSettings,
    claude_sync: syncState,
  };
  saveSettings(updatedSettings);
}

/**
 * Check if a file has been synced and hasn't changed
 */
export function isFileSynced(filePath: string, currentChecksum: string): boolean {
  const syncState = getClaudeSyncState();
  if (!syncState.synced_files) {
    return false;
  }

  const syncedFile = syncState.synced_files.find(f => f.path === filePath);
  return syncedFile ? syncedFile.checksum === currentChecksum : false;
}

/**
 * Record that a file has been synced
 */
export function recordFileSynced(
  filePath: string,
  checksum: string,
  eventsProcessed: number
): void {
  const syncState = getClaudeSyncState();
  const syncedFiles = syncState.synced_files || [];

  // Remove existing entry for this file if it exists
  const filteredFiles = syncedFiles.filter(f => f.path !== filePath);

  // Add the updated file record
  filteredFiles.push({
    path: filePath,
    checksum,
    last_modified: new Date().toISOString(),
    events_processed: eventsProcessed,
  });

  saveClaudeSyncState({
    ...syncState,
    last_sync: new Date().toISOString(),
    synced_files: filteredFiles,
  });
}

// Export the amp sync state schema type for use in sync command
export type AmpSyncThread = {
  path: string;
  checksum: string;
  last_modified: string;
  events_processed: number;
};

export type AmpSyncState = {
  last_sync?: string;
  synced_threads?: AmpSyncThread[];
};

/**
 * Get Amp sync state from settings
 */
export function getAmpSyncState(): AmpSyncState {
  const settings = loadSettings();
  return settings.amp_sync || {};
}

/**
 * Save Amp sync state to settings
 */
export function saveAmpSyncState(syncState: AmpSyncState): void {
  const currentSettings = loadSettings();
  const updatedSettings = {
    ...currentSettings,
    amp_sync: syncState,
  };
  saveSettings(updatedSettings);
}

/**
 * Check if an Amp thread has been synced and hasn't changed
 */
export function isAmpThreadSynced(threadPath: string, currentChecksum: string): boolean {
  const syncState = getAmpSyncState();
  if (!syncState.synced_threads) {
    return false;
  }

  const syncedThread = syncState.synced_threads.find(t => t.path === threadPath);
  return syncedThread ? syncedThread.checksum === currentChecksum : false;
}

/**
 * Record that an Amp thread has been synced
 */
export function recordAmpThreadSynced(
  threadPath: string,
  checksum: string,
  eventsProcessed: number
): void {
  const syncState = getAmpSyncState();
  const syncedThreads = syncState.synced_threads || [];

  // Remove existing entry for this thread if it exists
  const filteredThreads = syncedThreads.filter(t => t.path !== threadPath);

  // Add the updated thread record
  filteredThreads.push({
    path: threadPath,
    checksum,
    last_modified: new Date().toISOString(),
    events_processed: eventsProcessed,
  });

  saveAmpSyncState({
    ...syncState,
    last_sync: new Date().toISOString(),
    synced_threads: filteredThreads,
  });
}
