import { Command } from 'commander';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { dirname } from 'path';
import { createInterface } from 'readline';

import logger from '../../util/logger';
import { output } from '../../util/output';

interface InitOpts {
  settings: string;
  yes: boolean;
}

/**
 * Claude settings.json hook command structure
 */
interface ClaudeHookCommand {
  type: string;
  command: string;
}

/**
 * Claude settings.json hook entry structure
 */
interface ClaudeHookEntry {
  hooks: ClaudeHookCommand[];
}

/**
 * Claude settings.json structure
 */
interface ClaudeSettings {
  hooks?: {
    [hookName: string]: (ClaudeHookEntry | string)[];
  };
}

const HOOKS = ['Stop', 'SubagentStop'];

export function buildInitCommand(): Command {
  return new Command('init')
    .description('Initialize Claude Code hooks to send Arden telemetry')
    .option('-s, --settings <file>', 'Path to settings.json', '~/.claude/settings.json')
    .option('-y, --yes, --force', 'Skip confirmation prompts')
    .action(run);
}

async function run(opts: InitOpts, command: Command) {
  const settingsPath = expandTilde(opts.settings);

  output.info(`Configuring Claude Code hooks for: ${settingsPath}`);

  try {
    const { json, modified } = await ensureHooks(settingsPath);

    if (!modified) {
      output.success('Arden hooks already present – nothing to do.');
      return;
    }

    if (!opts.yes && !(await confirm(`Write changes to ${settingsPath}? (y/N)`))) {
      output.info('Aborted.');
      return;
    }

    await writeFileAtomic(settingsPath, JSON.stringify(json, null, 2) + '\n');
    output.success(`Claude hooks initialized in ${settingsPath}`);
    output.info('Claude Code will now send Stop and SubagentStop events to Arden.');
  } catch (error) {
    output.error(`Failed to initialize Claude hooks: ${(error as Error).message}`);
    process.exit(1);
  }
}

export function expandTilde(path: string): string {
  return path.replace(/^~(?=$|\/|\\)/, homedir());
}

function buildHookCommand({ hook }: { hook: string }) {
  return `arden claude hook ${hook}`;
}

/**
 * Reads settings.json (creating skeleton if missing) and ensures all hooks are installed.
 * Returns the modified JSON and whether any changes were made.
 */
async function ensureHooks(
  file: string
): Promise<{ json: ClaudeSettings; modified: boolean }> {
  let json: ClaudeSettings = {};

  try {
    const content = await fs.readFile(file, 'utf8');
    json = JSON.parse(content);
  } catch {
    // File missing or invalid JSON - start with empty object
  }

  // Ensure hooks object exists
  json.hooks = json.hooks ?? {};

  let modified = false;

  // Install each hook
  for (const hook of HOOKS) {
    const cmd = buildHookCommand({ hook });

    // Get current hook array
    const currentHooks: (ClaudeHookEntry | string)[] = json.hooks[hook] ?? [];

    // Check if our exact command is already present in the correct format
    const hookEntry = {
      hooks: [
        {
          type: 'command',
          command: cmd,
        },
      ],
    };

    if (!hasArdenHook(currentHooks, cmd)) {
      // Add our command to the existing array
      json.hooks[hook] = [...currentHooks, hookEntry];
      modified = true;
    }
  }

  return { json, modified };
}



/**
 * Check if the cleaned hooks already contain our Arden command.
 */
function hasArdenHook(hooks: (ClaudeHookEntry | string)[], cmd: string): boolean {
  return hooks.some(hook => {
    if (typeof hook === 'object' && hook.hooks && Array.isArray(hook.hooks)) {
      return hook.hooks.some((h: ClaudeHookCommand) => h.command === cmd);
    }
    return false;
  });
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

/**
 * Check if Claude hooks need to be installed (read-only check)
 * Returns true if hooks are missing/need installation
 */
export async function checkClaudeHooks(settingsPath: string): Promise<boolean> {
  try {
    const { modified } = await ensureHooks(settingsPath);
    return modified; // true means hooks are missing and need installation
  } catch (error) {
    logger.error(`Failed to check Claude hooks: ${(error as Error).message}`);
    return true; // Assume hooks need installation if we can't read the file
  }
}

async function writeFileAtomic(path: string, data: string): Promise<void> {
  // Ensure directory exists
  await fs.mkdir(dirname(path), { recursive: true });

  // Write to temp file first, then rename for atomic operation
  const tmpPath = path + '.tmp';
  await fs.writeFile(tmpPath, data, 'utf8');
  await fs.rename(tmpPath, path);
}
