import { spawn } from 'child_process';
import { createInterface } from 'readline';

import { createAmpHistoryEvents, findAmpThreads, formatThreadSummary } from '../util/amp-history';
import { sendEvents } from '../util/client';
import {
  createCommand,
  createCommandAction,
  getResolvedConfig,
  GlobalOptions,
} from '../util/command-base';
import { AgentDetection, detectAmp, detectClaude } from '../util/detect';
import { logger, output } from '../util/output';
import { ensureApiToken } from '../util/settings';
import { checkUserOrPrompt } from '../util/user-prompt';
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

  // Agent detection
  output.info('Detecting AI agents...');
  const claude = await detectClaude();
  const amp = await detectAmp();

  showDetectionSummary({ claude, amp });

  // Claude setup flow
  if (claude.present) {
    await handleClaudeSetup(claude, initOptions);
  } else {
    output.info("Claude Code not found. Skip if you don't use Claude Code.");
  }

  // Amp detection and history upload
  if (amp.present) {
    output.info('Amp detected - built-in Arden support, no configuration needed');
    await handleAmpHistoryUpload(initOptions, config);
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
  const needsInstall = await checkClaudeHooks(settingsPath, options.host);

  if (!needsInstall) {
    output.success('Arden hooks already installed in Claude settings');
    return;
  }

  output.warn('Arden hooks not found in Claude settings');

  const shouldInstall =
    options.yes || (await confirm('Install Arden hooks for Claude Code? (y/N)'));

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

async function handleAmpHistoryUpload(
  options: InitOptions,
  config: ReturnType<typeof getResolvedConfig>
) {
  // Check if user wants to proceed with anonymous events if no user ID
  const shouldProceed = await checkUserOrPrompt(config.userId);
  if (!shouldProceed) {
    output.info('Amp history upload cancelled.');
    return;
  }

  output.info('Checking for existing Amp thread history...');

  const threads = await findAmpThreads();

  if (threads.length === 0) {
    output.info('No existing Amp threads found in ~/.amp/file-changes');
    return;
  }

  output.message(formatThreadSummary(threads));

  const shouldUpload =
    options.yes ||
    (await confirm(
      `Upload ${threads.length} existing Amp thread(s) to ardenstats.com under agent A-AMP? (y/N)`
    ));

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
  output.message('\nNext steps:');
  output.message('• Use Claude Code or Amp as normal');
  output.message('• Visit https://ardenstats.com to view your usage analytics');
  output.message("• Run 'arden --help' to see additional commands");
}
