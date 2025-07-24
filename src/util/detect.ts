import { spawn } from 'child_process';
import { access } from 'fs/promises';
import { join } from 'path';

export interface AgentDetection {
  present: boolean;
  bin?: string;
  version?: string;
}

/**
 * Find an executable on the system PATH
 */
export async function findOnPath(cmd: string): Promise<string | null> {
  const paths = process.env.PATH?.split(process.platform === 'win32' ? ';' : ':') ?? [];
  const extension = process.platform === 'win32' ? '.exe' : '';

  for (const p of paths) {
    const fullPath = join(p, cmd + extension);
    try {
      await access(fullPath);
      return fullPath;
    } catch {
      // Ignore and continue
    }
  }
  return null;
}

/**
 * Get version from a command by running it with --version
 */
export async function getVersion(
  cmdPath: string,
  args = ['--version']
): Promise<string | undefined> {
  return new Promise<string | undefined>(resolve => {
    const child = spawn(cmdPath, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let output = '';

    child.stdout?.on('data', chunk => {
      output += chunk.toString();
    });

    child.on('close', code => {
      resolve(code === 0 ? output.trim() : undefined);
    });

    child.on('error', () => {
      resolve(undefined);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      child.kill();
      resolve(undefined);
    }, 5000);
  });
}

/**
 * Detect Claude Code agent
 */
export async function detectClaude(): Promise<AgentDetection> {
  const bin = await findOnPath('claude');
  if (!bin) {
    return { present: false };
  }

  const version = await getVersion(bin);
  return { present: true, bin, version };
}

/**
 * Detect Amp Code agent
 */
export async function detectAmp(): Promise<AgentDetection> {
  const bin = await findOnPath('amp');
  if (!bin) {
    return { present: false };
  }

  const version = await getVersion(bin);
  return { present: true, bin, version };
}
