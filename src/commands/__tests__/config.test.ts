import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { homedir } from 'os';
import { join } from 'path';

interface Settings {
  user_id?: string;
  api_token?: string;
  host?: string;
  default_format?: string;
  log_level?: string;
  interactive?: boolean;
}

// Mock functions
const mockLoadSettings = mock<() => Settings>();
const mockOutputMessage = mock<(message: string) => void>();
const mockOutputInfo = mock<(message: string) => void>();

// Simplified config logic for testing (matches the new implementation)
async function configLogic() {
  const settings = mockLoadSettings();
  const configPath = join(homedir(), '.arden', 'settings.json');

  mockOutputMessage('Current configuration:');

  if (Object.keys(settings).length === 0) {
    mockOutputInfo('(no settings configured)');
  } else {
    Object.entries(settings).forEach(([key, value]) => {
      // Mask sensitive values
      const displayValue = key.includes('token') || key.includes('api') ? '[SET]' : String(value);
      mockOutputMessage(`  ${key} = ${displayValue}`);
    });
  }

  mockOutputMessage('');
  mockOutputInfo(`To modify configuration, edit the settings file directly:`);
  mockOutputInfo(`  ${configPath}`);
  mockOutputMessage('');
  mockOutputInfo('Valid configuration keys:');
  mockOutputInfo('  api_token     - Your Arden API token');
  mockOutputInfo('  user_id       - Your user ID');
  mockOutputInfo('  host          - API host URL (default: https://ardenstats.com)');
  mockOutputInfo('  default_format - Output format: json, table, yaml (default: table)');
  mockOutputInfo('  log_level     - Log level: debug, info, warn, error (default: info)');
  mockOutputInfo('  interactive   - Enable interactive mode (default: true)');
}

beforeEach(() => {
  mockLoadSettings.mockClear();
  mockOutputMessage.mockClear();
  mockOutputInfo.mockClear();
});

describe('config command logic', () => {
  it('should show empty settings message when no settings exist', async () => {
    mockLoadSettings.mockReturnValue({});

    await configLogic();

    expect(mockOutputMessage).toHaveBeenCalledWith('Current configuration:');
    expect(mockOutputInfo).toHaveBeenCalledWith('(no settings configured)');
    expect(mockOutputInfo).toHaveBeenCalledWith(
      'To modify configuration, edit the settings file directly:'
    );
    expect(mockOutputInfo).toHaveBeenCalledWith('Valid configuration keys:');
  });

  it('should list all settings with masked sensitive values', async () => {
    mockLoadSettings.mockReturnValue({
      user_id: 'test-user',
      api_token: 'secret-token',
      host: 'https://example.com',
      default_format: 'json',
    });

    await configLogic();

    expect(mockOutputMessage).toHaveBeenCalledWith('Current configuration:');
    expect(mockOutputMessage).toHaveBeenCalledWith('  user_id = test-user');
    expect(mockOutputMessage).toHaveBeenCalledWith('  api_token = [SET]');
    expect(mockOutputMessage).toHaveBeenCalledWith('  host = https://example.com');
    expect(mockOutputMessage).toHaveBeenCalledWith('  default_format = json');
  });

  it('should show help text about manual configuration editing', async () => {
    const configPath = join(homedir(), '.arden', 'settings.json');
    mockLoadSettings.mockReturnValue({});

    await configLogic();

    expect(mockOutputInfo).toHaveBeenCalledWith(
      'To modify configuration, edit the settings file directly:'
    );
    expect(mockOutputInfo).toHaveBeenCalledWith(`  ${configPath}`);
    expect(mockOutputInfo).toHaveBeenCalledWith('Valid configuration keys:');
    expect(mockOutputInfo).toHaveBeenCalledWith('  api_token     - Your Arden API token');
    expect(mockOutputInfo).toHaveBeenCalledWith('  user_id       - Your user ID');
    expect(mockOutputInfo).toHaveBeenCalledWith(
      '  host          - API host URL (default: https://ardenstats.com)'
    );
    expect(mockOutputInfo).toHaveBeenCalledWith(
      '  default_format - Output format: json, table, yaml (default: table)'
    );
    expect(mockOutputInfo).toHaveBeenCalledWith(
      '  log_level     - Log level: debug, info, warn, error (default: info)'
    );
    expect(mockOutputInfo).toHaveBeenCalledWith(
      '  interactive   - Enable interactive mode (default: true)'
    );
  });
});
