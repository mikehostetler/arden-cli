import { Command } from 'commander';

/**
 * Helper to traverse command hierarchy and find global CLI options from root command.
 * This eliminates the need for commands to manually call command.parent?.parent?.opts()
 * and handles different hierarchy depths automatically.
 */
export function findRootOpts(command: Command): Record<string, unknown> {
  let current = command;
  let opts = {};

  // Traverse up the command hierarchy to find global options
  while (current) {
    const currentOpts = current.opts();

    // Merge options, with higher-level options taking precedence
    opts = { ...currentOpts, ...opts };

    // If we find a command with global options like host/insecure, we're likely at root
    if (currentOpts.host || currentOpts.insecure || !current.parent) {
      break;
    }

    current = current.parent;
  }

  return opts;
}

/**
 * Helper to get a specific global option value from the command hierarchy.
 * Useful when you only need one specific option value.
 */
export function getRootOption<T = unknown>(command: Command, optionName: string): T | undefined {
  const opts = findRootOpts(command);
  return opts[optionName] as T | undefined;
}

/**
 * Helper to get commonly used global options in a type-safe way.
 */
export interface GlobalRootOptions {
  host?: string;
  insecure?: boolean;
  token?: string;
  user?: string;
  format?: 'json' | 'table' | 'yaml';
  verbose?: boolean;
  quiet?: boolean;
  yes?: boolean;
}

export function getGlobalOptions(command: Command): GlobalRootOptions {
  return findRootOpts(command) as GlobalRootOptions;
}
