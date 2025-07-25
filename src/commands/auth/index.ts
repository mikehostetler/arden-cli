import { Command } from 'commander';
import {
  createCommand,
  createCommandAction,
  getResolvedConfig,
  GlobalOptions,
} from '../../util/command-base';
import { output } from '../../util/logging';
import { getUserId, saveSettings, loadSettings } from '../../util/settings';
import { deviceAuthFlow } from './device';

interface AuthOptions extends GlobalOptions {}

export const authCommand = createCommand('auth', 'Manage authentication with ardenstats.com')
  .addCommand(createLoginCommand())
  .addCommand(createLogoutCommand())
  .addCommand(createStatusCommand());

function createLoginCommand(): Command {
  return createCommand('login', 'Authenticate with ardenstats.com using device flow').action(
    createCommandAction(
      async (options: AuthOptions, config: ReturnType<typeof getResolvedConfig>) => {
        const currentUserId = getUserId();

        if (currentUserId) {
          output.info(`Already authenticated as: ${currentUserId}`);
          output.info('Use "arden auth logout" to sign out first');
          return;
        }

        try {
          const ulid = await deviceAuthFlow(config.host || 'https://ardenstats.com');
          const settings = loadSettings();
          settings.user_id = ulid;
          saveSettings(settings);
          output.success('Authentication successful!');
          output.info(`Authenticated as: ${ulid}`);
        } catch (error) {
          output.error(`Authentication failed: ${(error as Error).message}`);
          process.exit(1);
        }
      }
    )
  );
}

function createLogoutCommand(): Command {
  return createCommand('logout', 'Sign out of ardenstats.com').action(
    createCommandAction(async () => {
      const currentUserId = getUserId();

      if (!currentUserId) {
        output.info('Not currently authenticated');
        return;
      }

      const settings = loadSettings();
      delete settings.user_id;
      saveSettings(settings);

      output.success('Successfully signed out');
      output.info('Use "arden auth login" to authenticate again');
    })
  );
}

function createStatusCommand(): Command {
  return createCommand('status', 'Show current authentication status').action(
    createCommandAction(async () => {
      const currentUserId = getUserId();

      if (currentUserId) {
        output.success(`Authenticated as: ${currentUserId}`);
      } else {
        output.info('Not authenticated');
        output.info('Use "arden auth login" to authenticate');
      }
    })
  );
}
