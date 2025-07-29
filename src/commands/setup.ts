import chalk from 'chalk';
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
import { ensureApiToken, getUserId, loadSettings, saveSettings } from '../util/settings';
import { deviceAuthFlow } from './auth/device';
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
  const claude = await detectClaude();
  const amp = await detectAmp();

  showDetectionSummary({ claude, amp });

  // Claude setup flow
  if (claude.present) {
    await handleClaudeSetup(claude, initOptions);
    await handleClaudeSync(initOptions);
  } else {
    output.message(chalk.dim("Claude Code not found. Skip if you don't use Claude Code."));
  }

  // Amp setup flow
  if (amp.present) {
    await handleAmpSync(initOptions);
  }

  // API token setup (legacy support)
  await ensureApiToken(initOptions);

  showSuccessMessage();
  
  // Force cleanup of any lingering timers/handles
  process.nextTick(() => {
    process.exit(0);
  });
}

function showBanner() {
  output.message(chalk.bold('Arden CLI Setup'));
  output.message('');
}

function checkNodeVersion() {
  const version = process.version;
  const majorVersion = parseInt(version.slice(1).split('.')[0] || '0');

  if (majorVersion < 18) {
    output.warn(`Node.js ${version} detected. Node.js 18+ recommended.`);
  }
}

async function handleUserSetup(options: InitOptions) {
  const currentUserId = getUserId();

  if (currentUserId) {
    output.message(`${chalk.cyan('User ID'.padEnd(17))} ${currentUserId} ${chalk.green('✓')}`);
    return;
  }

  output.message(chalk.dim('Authenticating...'));

  if (options.yes) {
    output.message(
      chalk.dim('Skipping authentication (--yes mode). You can authenticate later with:')
    );
    output.message(chalk.dim('  arden auth login'));
    return;
  }

  try {
    const ulid = await deviceAuthFlow(options.host || 'https://ardenstats.com');
    const settings = loadSettings();
    settings.user_id = ulid;
    saveSettings(settings);
    output.message(`${chalk.cyan('User ID'.padEnd(17))} ${ulid} ${chalk.green('✓')}`);
  } catch (error) {
    output.error(`Authentication failed: ${(error as Error).message}`);
    output.message(chalk.dim('You can try again later with: arden auth login'));

    // Don't fail the entire init process - continue with other setup
    return;
  }
}

function showDetectionSummary({ claude, amp }: { claude: AgentDetection; amp: AgentDetection }) {
  if (claude.present) {
    output.message(
      `${chalk.cyan('Claude Code'.padEnd(17))} ${claude.version || 'detected'} ${chalk.green('✓')}`
    );
  }

  if (amp.present) {
    output.message(`${chalk.cyan('Amp'.padEnd(17))} detected ${chalk.green('✓')}`);
  }
}

async function handleClaudeSetup(_claude: AgentDetection, options: InitOptions) {
  const settingsPath = expandTilde('~/.claude/settings.json');
  const needsInstall = await checkClaudeHooks(settingsPath);

  if (!needsInstall) {
    output.message(`${chalk.cyan('Claude hooks'.padEnd(17))} configured ${chalk.green('✓')}`);
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
    output.message(`${chalk.cyan('Claude hooks'.padEnd(17))} initialized ${chalk.green('✓')}`);
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
    output.message(chalk.dim('Skipping Claude sync - no user ID configured'));
    return;
  }

  output.message(chalk.dim('Syncing Claude Code usage logs...'));

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
      output.message(`${chalk.cyan('Claude sync'.padEnd(17))} completed ${chalk.green('✓')}`);
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
    output.message(chalk.dim('Skipping Amp sync - no user ID configured'));
    return;
  }

  // Use the regular amp sync command which works correctly
  output.message(chalk.dim('Syncing Amp usage logs...'));

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
      output.message(`${chalk.cyan('Amp sync'.padEnd(17))} completed ${chalk.green('✓')}`);
    } else {
      output.warn('Amp sync completed with warnings (see above)');
    }
  } catch (error) {
    logger.error(`Failed to sync Amp logs: ${(error as Error).message}`);
    output.warn('Could not sync Amp logs');
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  output.message('');
  output.message(chalk.green('✓ Setup complete!'));
  output.message('');
  output.message(`${chalk.cyan('Analytics'.padEnd(17))} https://ardenstats.com`);
}
