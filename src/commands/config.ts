import { Command } from 'commander';
import { loadSettings, saveSettings } from '../util/settings';
import logger from '../util/logger';

interface ConfigOptions {
  get?: string;
  set?: string;
  unset?: string;
  list?: boolean;
}

export const configCommand = new Command('config')
  .description('Manage Arden CLI configuration')
  .option('--get <key>', 'Get a configuration value')
  .option('--set <key=value>', 'Set a configuration value')
  .option('--unset <key>', 'Remove a configuration value')
  .option('--list', 'List all configuration values')
  .action(async (options: ConfigOptions) => {
    try {
      const settings = loadSettings();

      if (options.list) {
        console.log('Current configuration:');
        if (Object.keys(settings).length === 0) {
          console.log('  (no settings configured)');
        } else {
          Object.entries(settings).forEach(([key, value]) => {
            // Mask sensitive values
            const displayValue = key.includes('token') || key.includes('api') 
              ? '[SET]' 
              : value;
            console.log(`  ${key} = ${displayValue}`);
          });
        }
        return;
      }

      if (options.get) {
        const value = settings[options.get as keyof typeof settings];
        if (value !== undefined) {
          console.log(value);
        } else {
          console.log(`Configuration key '${options.get}' not found`);
          process.exit(1);
        }
        return;
      }

      if (options.set) {
        const [key, ...valueParts] = options.set.split('=');
        if (valueParts.length === 0) {
          throw new Error('Invalid format. Use --set key=value');
        }
        
        const value = valueParts.join('=');
        const validKeys = ['user_id', 'api_token'];
        
        if (!validKeys.includes(key)) {
          throw new Error(`Invalid configuration key '${key}'. Valid keys: ${validKeys.join(', ')}`);
        }

        const newSettings = { ...settings, [key]: value };
        saveSettings(newSettings);
        console.log(`✓ Set ${key} = ${key.includes('token') || key.includes('api') ? '[SET]' : value}`);
        return;
      }

      if (options.unset) {
        const validKeys = ['user_id', 'api_token'];
        
        if (!validKeys.includes(options.unset)) {
          throw new Error(`Invalid configuration key '${options.unset}'. Valid keys: ${validKeys.join(', ')}`);
        }

        if (settings[options.unset as keyof typeof settings] === undefined) {
          console.log(`Configuration key '${options.unset}' is not set`);
          return;
        }

        const newSettings = { ...settings };
        delete newSettings[options.unset as keyof typeof settings];
        saveSettings(newSettings);
        console.log(`✓ Unset ${options.unset}`);
        return;
      }

      // If no options provided, show help
      configCommand.help();

    } catch (error) {
      logger.error(`Configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });
