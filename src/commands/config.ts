import { homedir } from 'os';
import { join } from 'path';

import { createCommand, createCommandAction } from '../util/command-base';
import { output } from '../util/output';
import { loadSettings } from '../util/settings';
import { ConfigOptionsSchema } from './config/schemas';

export const configCommand = createCommand(
  'config',
  'Display current Arden CLI configuration'
).action(createCommandAction(runConfig, ConfigOptionsSchema));

async function runConfig() {
  const settings = loadSettings();
  const configPath = join(homedir(), '.arden', 'settings.json');

  output.message('Current configuration:');

  if (Object.keys(settings).length === 0) {
    output.info('(no settings configured)');
  } else {
    Object.entries(settings).forEach(([key, value]) => {
      // Mask sensitive values
      const displayValue = key.includes('token') || key.includes('api') ? '[SET]' : String(value);
      output.message(`  ${key} = ${displayValue}`);
    });
  }

  output.message('');
  output.info(`To modify configuration, edit the settings file directly:`);
  output.info(`  ${configPath}`);
  output.message('');
  output.info('Valid configuration keys:');
  output.info('  api_token     - Your Arden API token');
  output.info('  user_id       - Your user ID');
  output.info('  host          - API host URL (default: https://ardenstats.com)');
  output.info('  default_format - Output format: json, table, yaml (default: table)');
  output.info('  log_level     - Log level: debug, info, warn, error (default: info)');
  output.info('  interactive   - Enable interactive mode (default: true)');
}
