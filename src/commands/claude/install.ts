import { Command } from 'commander';
import { promises as fs } from 'fs';
import { dirname } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';
import logger from '../../util/logger';

interface InstallOpts {
  settings: string;
  yes: boolean;
  dryRun: boolean;
}

const HOOKS = ['Stop', 'SubagentStop'];

export function buildInstallCommand(): Command {
  return new Command('install')
    .description('Configure Claude Code hooks to send Arden telemetry')
    .option('-s, --settings <file>', 'Path to settings.json', '~/.claude/settings.json')
    .option('-y, --yes, --force', 'Skip confirmation prompts')
    .option('--dry-run', 'Preview changes without writing')
    .action(run);
}

async function run(opts: InstallOpts, command: Command) {
  const settingsPath = expandTilde(opts.settings);
  
  // Get host from parent command (global option)
  const parentOptions = command.parent?.parent?.opts() || {};
  const host = parentOptions['host'];

  console.log(`Configuring Claude Code hooks for: ${settingsPath}`);

  try {
    const { json, modified } = await ensureHooks(settingsPath, host);

    if (!modified) {
      console.log('✅ Arden hooks already present – nothing to do.');
      return;
    }

    if (opts.dryRun) {
      console.log('[DRY-RUN] New settings.json would be:');
      console.log(JSON.stringify(json, null, 2));
      return;
    }

    if (!opts.yes && !(await confirm(`Write changes to ${settingsPath}? (y/N)`))) {
      console.log('Aborted.');
      return;
    }

    await writeFileAtomic(settingsPath, JSON.stringify(json, null, 2) + '\n');
    console.log(`✅ Claude hooks installed in ${settingsPath}`);
    console.log('Claude Code will now send Stop and SubagentStop events to Arden.');
  } catch (error) {
    console.error(`Failed to install Claude hooks: ${(error as Error).message}`);
    process.exit(1);
  }
}

export function expandTilde(path: string): string {
  return path.replace(/^~(?=$|\/|\\)/, homedir());
}

function buildHookCommand({ host, hook }: { host?: string; hook: string }) {
  // Prepend global host if supplied so each invocation inherits it
  return host ? `arden --host ${host} claude hook ${hook}` : `arden claude hook ${hook}`;
}

/** 
 * Reads settings.json (creating skeleton if missing) and ensures all hooks are installed.
 * Returns the modified JSON and whether any changes were made.
 */
async function ensureHooks(file: string, host?: string): Promise<{ json: any; modified: boolean }> {
  let json: any = {};
  
  try {
    const content = await fs.readFile(file, 'utf8');
    json = JSON.parse(content);
  } catch (error) {
    // File missing or invalid JSON - start with empty object
  }

  // Ensure hooks object exists
  json.hooks = json.hooks ?? {};
  
  let modified = false;
  
  // Install each hook
  for (const hook of HOOKS) {
    const cmd = buildHookCommand({ host, hook });
    
    // Get current hook array and clean up any legacy entries
    const currentHooks: any[] = json.hooks[hook] ?? [];
    const cleanedHooks = filterOutLegacyArdenHooks(currentHooks);
    
    // Check if our exact command is already present in the correct format
    const hookEntry = {
      hooks: [
        {
          type: "command",
          command: cmd
        }
      ]
    };
    
    if (!hasArdenHook(cleanedHooks, cmd)) {
      // Add our command to the cleaned array
      json.hooks[hook] = [...cleanedHooks, hookEntry];
      modified = true;
    } else {
      json.hooks[hook] = cleanedHooks;
    }
  }
  
  return { json, modified };
}

/**
 * Remove earlier variants of Arden hooks to prevent duplicates.
 * This handles upgrades where the command might have changed.
 */
function filterOutLegacyArdenHooks(hooks: any[]): any[] {
  const ardenPatterns = [
    // Legacy patterns without 'hook' subcommand
    /^arden.*claude\s+(Stop|SubagentStop)$/,
    /^npx arden.*claude\s+(Stop|SubagentStop)$/,
    /^bunx arden.*claude\s+(Stop|SubagentStop)$/,
  ];
  
  return hooks.filter(hook => {
    // Handle both string format (legacy) and object format (current)
    if (typeof hook === 'string') {
      return !ardenPatterns.some(pattern => pattern.test(hook));
    }
    
    // Check if any command in the hook contains an Arden pattern
    if (hook.hooks && Array.isArray(hook.hooks)) {
      return !hook.hooks.some((h: any) => 
        h.command && ardenPatterns.some(pattern => pattern.test(h.command))
      );
    }
    
    return true;
  });
}

/**
 * Check if the cleaned hooks already contain our Arden command.
 */
function hasArdenHook(hooks: any[], cmd: string): boolean {
  return hooks.some(hook => {
    if (hook.hooks && Array.isArray(hook.hooks)) {
      return hook.hooks.some((h: any) => h.command === cmd);
    }
    return false;
  });
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(question + ' ', (answer) => {
      rl.close();
      resolve(['y', 'yes'].includes(answer.trim().toLowerCase()));
    });
  });
}

/**
 * Check if Claude hooks need to be installed (read-only check)
 * Returns true if hooks are missing/need installation
 */
export async function checkClaudeHooks(settingsPath: string, host?: string): Promise<boolean> {
  try {
    const { modified } = await ensureHooks(settingsPath, host);
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
