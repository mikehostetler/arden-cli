import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import logger from './logger';

interface Settings {
  user_id?: string;
  api_token?: string;
}

const SETTINGS_DIR = join(homedir(), '.arden');
const SETTINGS_FILE = join(SETTINGS_DIR, 'settings.json');

/**
 * Ensure the settings directory exists
 */
function ensureSettingsDir(): void {
  if (!existsSync(SETTINGS_DIR)) {
    mkdirSync(SETTINGS_DIR, { recursive: true });
    logger.debug(`Created settings directory: ${SETTINGS_DIR}`);
  }
}

/**
 * Load settings from ~/.arden/settings.json
 */
export function loadSettings(): Settings {
  try {
    if (!existsSync(SETTINGS_FILE)) {
      logger.debug('Settings file does not exist, returning empty settings');
      return {};
    }

    const data = readFileSync(SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data) as Settings;
    logger.debug('Loaded settings from file');
    return settings;
  } catch (error) {
    logger.debug(`Failed to load settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {};
  }
}

/**
 * Save settings to ~/.arden/settings.json
 */
export function saveSettings(settings: Settings): void {
  try {
    ensureSettingsDir();
    const data = JSON.stringify(settings, null, 2);
    writeFileSync(SETTINGS_FILE, data, 'utf8');
    logger.debug('Saved settings to file');
  } catch (error) {
    logger.error(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * Get a specific setting value with fallback priority:
 * 1. Explicit value (if provided)
 * 2. Environment variable
 * 3. Settings file
 */
export function getSettingValue(
  key: keyof Settings,
  explicitValue?: string,
  envVar?: string
): string | undefined {
  // 1. Use explicit value if provided
  if (explicitValue) {
    logger.debug(`Using explicit value for ${key}`);
    return explicitValue;
  }

  // 2. Check environment variable
  if (envVar && process.env[envVar]) {
    logger.debug(`Using environment variable ${envVar} for ${key}`);
    return process.env[envVar];
  }

  // 3. Check settings file
  const settings = loadSettings();
  if (settings[key]) {
    logger.debug(`Using settings file value for ${key}`);
    return settings[key];
  }

  logger.debug(`No value found for ${key}`);
  return undefined;
}

/**
 * Get user ID with fallback priority:
 * 1. Explicit --user option
 * 2. ARDEN_USER_ID environment variable
 * 3. Settings file user_id
 */
export function getUserId(explicitUser?: string): string | undefined {
  return getSettingValue('user_id', explicitUser, 'ARDEN_USER_ID');
}

/**
 * Get API token with fallback priority:
 * 1. Explicit --token option
 * 2. ARDEN_API_TOKEN environment variable
 * 3. Settings file api_token
 */
export function getApiToken(explicitToken?: string): string | undefined {
  return getSettingValue('api_token', explicitToken, 'ARDEN_API_TOKEN');
}
