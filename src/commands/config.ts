import chalk from 'chalk';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createInterface } from 'readline';

import { createCommand } from '../util/command-base';
import { output } from '../util/logging';
import { ArdenSettings, loadSettings, saveSettings } from '../util/settings';
import { skipCurrentVersion } from '../util/update-checker';
import { ConfigOptions, ConfigOptionsSchema } from './config/schemas';

export const configCommand = createCommand('config', 'View and manage Arden CLI configuration')
  .argument('[key]', 'Configuration key to view or set')
  .argument('[value]', 'Value to set for the configuration key')
  .option('--skip-version', 'Skip the current version in future update checks')
  .option('--reset', 'Reset configuration to default values')
  .option('--list', 'List all configuration keys and their current values')
  .action(async (key?: string, value?: string, _command?: unknown, thisCommand?: unknown) => {
    try {
      const options = (thisCommand || _command).opts() as ConfigOptions;
      const validatedOptions = ConfigOptionsSchema.parse(options);
      await runConfig(validatedOptions, key, value);
    } catch (error) {
      output.error(`Command failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Configuration keys that should be exposed via the config command
const CONFIGURABLE_KEYS = ['user_id', 'host', 'log_level', 'telemetry_enabled'] as const;
type ConfigurableKey = (typeof CONFIGURABLE_KEYS)[number];

// Default values for configuration
const CONFIG_DEFAULTS: Pick<ArdenSettings, ConfigurableKey> = {
  host: 'https://ardenstats.com',
  log_level: 'info',
  telemetry_enabled: true,
};

async function runConfig(options: ConfigOptions, key?: string, value?: string) {
  // Handle skip-version option
  if (options.skipVersion) {
    skipCurrentVersion();
    return;
  }

  // Handle reset option
  if (options.reset) {
    await resetConfig();
    return;
  }

  // If no key provided, show all configuration
  if (!key || options.list) {
    await showAllConfig();
    return;
  }

  // Validate key
  if (!CONFIGURABLE_KEYS.includes(key as ConfigurableKey)) {
    output.error(`Invalid configuration key: ${key}`);
    output.info(`Valid keys: ${CONFIGURABLE_KEYS.join(', ')}`);
    return;
  }

  const configKey = key as ConfigurableKey;

  // If no value provided, show current value
  if (value === undefined) {
    await showConfigValue(configKey);
    return;
  }

  // Set the configuration value
  await setConfigValue(configKey, value);
}

async function showAllConfig() {
  const settings = loadSettings();
  const configPath = join(homedir(), '.arden', 'settings.json');

  output.message(chalk.bold('Configuration'));
  output.message('');

  // Show all configurable keys with their values or defaults
  for (const key of CONFIGURABLE_KEYS) {
    const value = settings[key];
    const defaultValue = CONFIG_DEFAULTS[key];

    let displayValue: string;
    let isDefault = false;

    if (value !== undefined) {
      displayValue = String(value);
    } else if (defaultValue !== undefined) {
      displayValue = String(defaultValue);
      isDefault = true;
    } else {
      displayValue = '(not set)';
      isDefault = true;
    }

    const keyFormatted = chalk.cyan(key.padEnd(17));
    const valueFormatted = isDefault ? chalk.dim(displayValue) : displayValue;
    output.message(`${keyFormatted} ${valueFormatted}`);
  }

  output.message('');
  output.message(chalk.dim(`Config file: ${configPath}`));
}

async function showConfigValue(key: ConfigurableKey) {
  const settings = loadSettings();
  const value = settings[key];

  if (value !== undefined) {
    output.message(`${chalk.cyan(key)} ${String(value)}`);
  } else {
    const defaultValue = CONFIG_DEFAULTS[key];
    if (defaultValue !== undefined) {
      output.message(`${chalk.cyan(key)} ${chalk.dim(String(defaultValue) + ' (default)')}`);
    } else {
      output.message(`${chalk.cyan(key)} ${chalk.dim('(not set)')}`);
    }
  }
}

async function setConfigValue(key: ConfigurableKey, value: string) {
  try {
    // Parse value based on key type
    let parsedValue: unknown = value;

    if (key === 'telemetry_enabled') {
      if (value.toLowerCase() === 'true') {
        parsedValue = true;
      } else if (value.toLowerCase() === 'false') {
        parsedValue = false;
      } else {
        output.error('telemetry_enabled must be "true" or "false"');
        return;
      }
    } else if (key === 'log_level') {
      const validLevels = ['debug', 'info', 'warn', 'error'];
      if (!validLevels.includes(value)) {
        output.error(`log_level must be one of: ${validLevels.join(', ')}`);
        return;
      }
    }

    // Save the setting
    const updateObj = { [key]: parsedValue } as Partial<ArdenSettings>;
    saveSettings(updateObj);

    output.message(`${chalk.cyan(key)} ${chalk.green('→')} ${String(parsedValue)}`);
  } catch (error) {
    output.error(
      `Failed to set configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function resetConfig() {
  try {
    // Check what settings will be reset (only show items that will actually change)
    const settings = loadSettings();
    const settingsToReset = CONFIGURABLE_KEYS.filter(key => {
      const currentValue = settings[key];
      const defaultValue = CONFIG_DEFAULTS[key];

      // Only include if the key is explicitly set and differs from default
      if (currentValue === undefined) return false; // Not set, no change needed

      // Compare current value with default
      return currentValue !== defaultValue;
    });

    if (settingsToReset.length === 0) {
      output.message('No configuration to reset (already using defaults)');
      return;
    }

    // Show what will be reset
    output.message(chalk.yellow('The following configuration will be reset to defaults:'));
    output.message('');
    for (const key of settingsToReset) {
      const currentValue = settings[key];
      const defaultValue = CONFIG_DEFAULTS[key];
      const displayDefault = defaultValue !== undefined ? String(defaultValue) : '(not set)';
      output.message(
        `${chalk.cyan(key.padEnd(17))} ${chalk.dim(String(currentValue))} ${chalk.red('→')} ${chalk.dim(displayDefault)}`
      );
    }
    output.message('');

    // Confirm with user
    const confirmed = await confirm('Are you sure you want to reset your configuration? (y/N)');
    if (!confirmed) {
      output.message('Reset cancelled');
      return;
    }

    // Reset only the configurable keys, preserve sync state and other internal settings
    // We need to read the raw file to preserve internal settings that aren't exposed via config

    const configPath = join(homedir(), '.arden', 'settings.json');
    let currentFileSettings: Record<string, unknown> = {};

    if (existsSync(configPath)) {
      try {
        const data = readFileSync(configPath, 'utf8');
        currentFileSettings = JSON.parse(data) as Record<string, unknown>;
      } catch {
        // Ignore parsing errors, start fresh
      }
    }

    // Remove only the configurable keys, preserve everything else
    for (const key of CONFIGURABLE_KEYS) {
      delete currentFileSettings[key];
    }

    // Write the updated settings directly to file
    const data = JSON.stringify(currentFileSettings, null, 2);
    writeFileSync(configPath, data, 'utf8');

    output.success('Configuration reset to default values');
    output.message('');
    await showAllConfig();
  } catch (error) {
    output.error(
      `Failed to reset configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(question + ' ', answer => {
      rl.close();
      resolve(['y', 'yes'].includes(answer.trim().toLowerCase()));
    });
  });
}
