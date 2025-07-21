import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface ArdenSettings {
  // Core settings
  api_token?: string;
  user_id?: string;
  host?: string;
  
  // CLI preferences
  log_level?: string;
  default_format?: 'json' | 'table' | 'yaml';
  interactive?: boolean;
}

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
      fileSettings = JSON.parse(data) as ArdenSettings;
    }
  } catch (error) {
    // Ignore file read errors, use defaults
  }

  // Merge with environment variables
  const envSettings: ArdenSettings = {
    api_token: process.env.ARDEN_API_TOKEN,
    user_id: process.env.ARDEN_USER_ID,
    host: process.env.ARDEN_HOST || process.env.HOST,
    log_level: process.env.LOG_LEVEL,
  };

  // Remove undefined values
  Object.keys(envSettings).forEach(key => {
    if (envSettings[key as keyof ArdenSettings] === undefined) {
      delete envSettings[key as keyof ArdenSettings];
    }
  });

  return { ...defaults, ...fileSettings, ...envSettings };
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
    
    const data = JSON.stringify(newSettings, null, 2);
    writeFileSync(SETTINGS_FILE, data, 'utf8');
  } catch (error) {
    throw new Error(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get setting value with explicit CLI option override
 */
export function getSettingValue<K extends keyof ArdenSettings>(
  key: K,
  cliValue?: ArdenSettings[K],
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

// Backward compatibility aliases for old config system
export interface ArdenConfig {
  apiToken?: string;
  host?: string;
  userToken?: string;
  userId?: number;
}

export async function loadConfig(): Promise<ArdenConfig> {
  const settings = loadSettings();
  return {
    apiToken: settings.api_token,
    host: settings.host,
    userToken: settings.api_token, // For backward compatibility
    userId: settings.user_id ? parseInt(settings.user_id, 10) : undefined,
  };
}

export async function saveConfig(config: ArdenConfig): Promise<void> {
  const settings: Partial<ArdenSettings> = {
    api_token: config.apiToken || config.userToken,
    host: config.host,
    user_id: config.userId?.toString(),
  };
  saveSettings(settings);
}

export async function ensureApiToken(options: { 
  yes?: boolean; 
  dryRun?: boolean; 
  nonInteractive?: boolean;
  host?: string;
}): Promise<string | null> {
  const token = getApiToken();
  if (token) {
    return token;
  }
  
  if (options.nonInteractive || options.dryRun) {
    return null;
  }
  
  // For backward compatibility, just return null for now
  // This function was complex and can be reimplemented later if needed
  return null;
}
