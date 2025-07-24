import { spawn } from 'child_process';
import inquirer from 'inquirer';

import { createAmpHistoryEvents, findAmpThreads, formatThreadSummary } from '../util/amp-history';
import { sendEvents } from '../util/client';
import {
  createCommand,
  createCommandAction,
  getResolvedConfig,
  GlobalOptions,
} from '../util/command-base';
import { AgentDetection, detectAmp, detectClaude } from '../util/detect';
import { logger, output } from '../util/logging';
import { ensureApiToken, getUserId, saveSettings, loadSettings } from '../util/settings';
import { checkClaudeHooks, expandTilde } from './claude/init';

interface InitOptions extends GlobalOptions {
  yes?: boolean;
}

export const initCommand = createCommand(
  'init',
  'Initialize Arden CLI for your AI agent environment'
).action(createCommandAction(runInit));

async function runInit(options: InitOptions, config: ReturnType<typeof getResolvedConfig>) {
  const initOptions = {
    ...options,
    host: config.host,
    yes: config.yes,
  };

  showBanner();

  // Environment checks
  checkNodeVersion();

  // User setup - prompt for ardenstats.com signup and user ID configuration
  await handleUserSetup(initOptions);

  // Agent detection
  output.info('Detecting AI agents...');
  const claude = await detectClaude();
  const amp = await detectAmp();

  showDetectionSummary({ claude, amp });

  // Claude setup flow
  if (claude.present) {
    await handleClaudeSetup(claude, initOptions);
    await handleClaudeSync(initOptions);
  } else {
    output.info("Claude Code not found. Skip if you don't use Claude Code.");
  }

  // Amp setup flow
  if (amp.present) {
    output.info('Amp detected - built-in Arden support, no configuration needed');
    await handleAmpSync(initOptions);
  }

  // API token setup (legacy support)
  output.info('Checking API token...');
  await ensureApiToken(initOptions);

  showSuccessMessage();
}

function showBanner() {
  output.message('Welcome to Arden CLI Initialization!');
  output.message('This will configure your system to track AI agent usage.\n');
}

function checkNodeVersion() {
  const version = process.version;
  const majorVersion = parseInt(version.slice(1).split('.')[0] || '0');

  if (majorVersion < 18) {
    output.warn(`Node.js ${version} detected. Node.js 18+ recommended.`);
  } else {
    output.message(`Node.js ${version} detected`);
  }
}

async function handleUserSetup(options: InitOptions) {
  const currentUserId = getUserId();
  
  if (currentUserId) {
    output.success(`User ID already configured: ${currentUserId}`);
    return;
  }

  output.info('No user ID configured. Setting up Arden user account...');
  output.message('To track your agent usage on ardenstats.com, you need a user ID.');
  output.message('');
  output.message('1. Visit: https://ardenstats.com/auth/register');
  output.message('2. Sign up for an account (free)');
  output.message('3. Find your user ID in your profile settings');
  output.message('');

  if (options.yes) {
    output.info('Skipping user ID setup (--yes mode). You can configure later with:');
    output.info('  arden config set user_id <your-user-id>');
    return;
  }

  const { shouldSetup } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldSetup',
      message: 'Do you want to configure your user ID now?',
      default: false,
    },
  ]);
  
  if (!shouldSetup) {
    output.info('Skipping user ID setup. You can configure later with:');
    output.info('  arden config set user_id <your-user-id>');
    return;
  }

  const { userId } = await inquirer.prompt([
    {
      type: 'input',
      name: 'userId',
      message: 'Enter your user ID (or press Enter to skip):',
      validate: (input: string) => {
        const trimmed = input.trim();
        return trimmed.length > 0 || 'User ID cannot be empty (or press Enter to skip)';
      },
      filter: (input: string) => input.trim() || null,
    },
  ]);

  if (userId) {
    const settings = loadSettings();
    settings.user_id = userId;
    saveSettings(settings);
    output.success(`User ID configured: ${userId}`);
  }
}

function showDetectionSummary({ claude, amp }: { claude: AgentDetection; amp: AgentDetection }) {
  output.info('Detection Summary:');

  if (claude.present) {
    output.success(
      `Claude Code found at ${claude.bin}${claude.version ? ` (${claude.version})` : ''}`
    );
  } else {
    output.error(`Claude Code not found in PATH`);
  }

  if (amp.present) {
    output.success(`Amp found at ${amp.bin}${amp.version ? ` (${amp.version})` : ''}`);
  } else {
    output.error(`Amp not found in PATH`);
  }
}

async function handleClaudeSetup(_claude: AgentDetection, options: InitOptions) {
  output.info('Configuring Claude Code...');

  const settingsPath = expandTilde('~/.claude/settings.json');
  const needsInstall = await checkClaudeHooks(settingsPath);

  if (!needsInstall) {
    output.success('Arden hooks already installed in Claude settings');
    return;
  }

  output.warn('Arden hooks not found in Claude settings');

  let shouldInstall = options.yes;
  
  if (!shouldInstall) {
    const { install } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'install',
        message: 'Install Arden hooks for Claude Code?',
        default: false,
      },
    ]);
    shouldInstall = install;
  }

  if (!shouldInstall) {
    output.info('Skipping Claude hook installation');
    return;
  }

  // Run the claude init command
  output.info('Initializing Claude hooks...');

  const args = [
    process.argv[0], // node executable
    process.argv[1], // arden script
    ...(options.host ? ['--host', options.host] : []),
    'claude',
    'init',
    '-s',
    settingsPath,
    ...(options.yes ? ['--yes'] : []),
  ].filter((arg): arg is string => arg !== undefined);

  const result = await spawnProcess(process.execPath, args.slice(1));

  if (result.code === 0) {
    output.success('Claude hooks initialized successfully');
  } else {
    throw new Error('Failed to initialize Claude hooks');
  }
}



async function spawnProcess(command: string, args: string[]): Promise<{ code: number }> {
  return new Promise(resolve => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('close', code => {
      resolve({ code: code || 0 });
    });

    child.on('error', error => {
      logger.error(`Failed to spawn process: ${error.message}`);
      resolve({ code: 1 });
    });
  });
}

async function handleClaudeSync(options: InitOptions) {
  const currentUserId = getUserId();
  if (!currentUserId) {
    output.info('Skipping Claude sync - no user ID configured');
    return;
  }

  output.info('Syncing Claude Code usage logs...');

  try {
    const args = [
      process.argv[0], // node executable
      process.argv[1], // arden script
      ...(options.host ? ['--host', options.host] : []),
      'claude',
      'sync',
    ].filter((arg): arg is string => arg !== undefined);

    const result = await spawnProcess(process.execPath, args.slice(1));

    if (result.code === 0) {
      output.success('Claude logs synced successfully');
    } else {
      output.warn('Claude sync completed with warnings (see above)');
    }
  } catch (error) {
    logger.error(`Failed to sync Claude logs: ${(error as Error).message}`);
    output.warn('Could not sync Claude Code logs');
  }
}

async function handleAmpSync(options: InitOptions) {
  const currentUserId = getUserId();
  if (!currentUserId) {
    output.info('Skipping Amp sync - no user ID configured');
    return;
  }

  // Use the regular amp sync command which works correctly
  output.info('Syncing Amp usage logs...');

  try {
    const threadsPath = expandTilde('~/.amp/file-changes');
    const args = [
      process.argv[0], // node executable
      process.argv[1], // arden script
      ...(options.host ? ['--host', options.host] : []),
      'amp',
      'sync',
      '--threads',
      threadsPath,
    ].filter((arg): arg is string => arg !== undefined);

    const result = await spawnProcess(process.execPath, args.slice(1));

    if (result.code === 0) {
      output.success('Amp logs synced successfully');
    } else {
      output.warn('Amp sync completed with warnings (see above)');
    }
  } catch (error) {
    logger.error(`Failed to sync Amp logs: ${(error as Error).message}`);
    output.warn('Could not sync Amp logs');
  }
}

async function handleAmpHistoryUpload(options: InitOptions) {
  output.info('Checking for existing Amp thread history...');

  const threads = await findAmpThreads();

  if (threads.length === 0) {
    output.info('No existing Amp threads found in ~/.amp/file-changes');
    return;
  }

  output.message(formatThreadSummary(threads));

  let shouldUpload = options.yes;
  
  if (!shouldUpload) {
    const { upload } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'upload',
        message: `Upload ${threads.length} existing Amp thread(s) to ardenstats.com under agent A-AMP?`,
        default: false,
      },
    ]);
    shouldUpload = upload;
  }

  if (!shouldUpload) {
    output.info('Skipping Amp history upload');
    return;
  }

  output.info('Uploading Amp thread history...');

  try {
    const events = createAmpHistoryEvents(threads);
    const result = await sendEvents(events, { host: options.host });

    if (result.status === 'accepted') {
      output.success(`Successfully uploaded ${result.accepted_count} thread record(s)`);
    } else if (result.status === 'partial') {
      output.success(
        `Uploaded ${result.accepted_count} thread record(s), ${result.rejected_count || 0} failed`
      );
    } else {
      output.error('Failed to upload thread history');
    }
  } catch (error) {
    logger.error(`Failed to upload Amp history: ${(error as Error).message}`);
    output.warn('Could not upload Amp thread history');
  }
}

function showSuccessMessage() {
  output.success('Initialization complete!');
  output.message('\nArden is now configured to track your AI agent usage.');
  output.message('Your agents will automatically send telemetry to ardenstats.com');
  output.message('\nWhat was configured:');
  const userId = getUserId();
  if (userId) {
    output.message(`• User ID: ${userId}`);
  }
  output.message('• Claude Code hooks installed (if present)');
  output.message('• Historical logs synced to ardenstats.com');
  output.message('\nNext steps:');
  output.message('• Use Claude Code or Amp as normal');
  output.message('• Visit https://ardenstats.com to view your usage analytics');
  output.message("• Run 'arden --help' to see additional commands");
  if (!userId) {
    output.message("• Configure your user ID with 'arden config set user_id <your-user-id>'");
  }
}
