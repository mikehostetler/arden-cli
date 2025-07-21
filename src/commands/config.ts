import { loadSettings, saveSettings } from '../util/settings';
import { createCommand, createCommandAction, GlobalOptions } from '../util/command-base';
import { output } from '../util/output';

interface ConfigOptions extends GlobalOptions {
  get?: string;
  set?: string;
  unset?: string;
  list?: boolean;
}

export const configCommand = createCommand('config', 'Manage Arden CLI configuration')
  .option('--get <key>', 'Get a configuration value')
  .option('--set <key=value>', 'Set a configuration value')
  .option('--unset <key>', 'Remove a configuration value')
  .option('--list', 'List all configuration values')
  .action(createCommandAction(runConfig));

async function runConfig(options: ConfigOptions) {
  const settings = loadSettings();

  if (options.list) {
    output.message('Current configuration:');
    if (Object.keys(settings).length === 0) {
      output.info('(no settings configured)');
    } else {
      Object.entries(settings).forEach(([key, value]) => {
        // Mask sensitive values
        const displayValue = key.includes('token') || key.includes('api') 
          ? '[SET]' 
          : String(value);
        output.message(`  ${key} = ${displayValue}`);
      });
    }
    return;
  }

  if (options.get) {
    const value = settings[options.get as keyof typeof settings];
    if (value !== undefined) {
      output.message(String(value));
    } else {
      output.error(`Configuration key '${options.get}' not found`);
      process.exit(1);
    }
    return;
  }

  if (options.set) {
    const [key, ...valueParts] = options.set.split('=');
    if (!key || valueParts.length === 0) {
      throw new Error('Invalid format. Use --set key=value');
    }
    
    const value = valueParts.join('=');
    const validKeys = ['api_token', 'user_id', 'host', 'log_level', 'default_format', 'interactive'];
    
    if (!validKeys.includes(key)) {
      throw new Error(`Invalid configuration key '${key}'. Valid keys: ${validKeys.join(', ')}`);
    }

    // Type validation for specific keys
    if (key === 'default_format' && !['json', 'table', 'yaml'].includes(value)) {
      throw new Error('default_format must be one of: json, table, yaml');
    }
    
    if (key === 'interactive' && !['true', 'false'].includes(value)) {
      throw new Error('interactive must be true or false');
    }

    const settingValue = key === 'interactive' ? value === 'true' : value;
    const newSettings = { [key]: settingValue };
    saveSettings(newSettings);
    
    const displayValue = key.includes('token') || key.includes('api') ? '[SET]' : value;
    output.success(`Set ${key} = ${displayValue}`);
    return;
  }

  if (options.unset) {
    const validKeys = ['api_token', 'user_id', 'host', 'log_level', 'default_format', 'interactive'];
    
    if (!validKeys.includes(options.unset)) {
      throw new Error(`Invalid configuration key '${options.unset}'. Valid keys: ${validKeys.join(', ')}`);
    }

    if (settings[options.unset as keyof typeof settings] === undefined) {
      output.info(`Configuration key '${options.unset}' is not set`);
      return;
    }

    const currentSettings = loadSettings();
    delete currentSettings[options.unset as keyof typeof currentSettings];
    saveSettings(currentSettings);
    output.success(`Unset ${options.unset}`);
    return;
  }

  // If no options provided, show current config
  output.message('Current configuration:');
  Object.entries(settings).forEach(([key, value]) => {
    const displayValue = key.includes('token') || key.includes('api') 
      ? '[SET]' 
      : String(value);
    output.message(`  ${key} = ${displayValue}`);
  });
}
