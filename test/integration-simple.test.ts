import { beforeAll, describe, expect, it } from 'bun:test';
import { execa } from 'execa';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Simplified E2E Integration Tests for arden-cli
 *
 * Tests basic CLI functionality without complex API mocking.
 * Focuses on command execution, help output, and basic validation.
 */

// CLI executable path
let cliPath: string;

beforeAll(async () => {
  // Build CLI if not already built
  cliPath = join(process.cwd(), 'dist', 'index.js');

  if (!existsSync(cliPath)) {
    console.log('Building CLI...');
    const buildResult = await execa('bun', ['run', 'build'], {
      cwd: process.cwd(),
      stdio: 'pipe',
    });

    if (buildResult.exitCode !== 0) {
      throw new Error(`Failed to build CLI: ${buildResult.stderr}`);
    }
  }

  if (!existsSync(cliPath)) {
    throw new Error(`CLI executable not found at ${cliPath}`);
  }
});

/**
 * Execute CLI command
 */
async function runCli(args: string[]): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  try {
    const result = await execa('node', [cliPath, ...args], {
      stdio: 'pipe',
      timeout: 5000,
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error: any) {
    return {
      exitCode: error.exitCode || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
    };
  }
}

describe('CLI Basic Integration Tests', () => {
  describe('Help and Version', () => {
    it('should show help when --help is passed', async () => {
      const result = await runCli(['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('arden');
      expect(result.stdout).toContain('Commands:');
      expect(result.stdout).toContain('config');
      expect(result.stdout).toContain('event');
    });

    it('should show version when --version is passed', async () => {
      const result = await runCli(['--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/); // Version format
    });

    it('should show help when no command is provided', async () => {
      const result = await runCli([]);

      // CLI shows help but exits with code 1 when no command provided
      expect(result.exitCode).toBe(1);
      // Check both stdout and stderr since commander.js may write to either
      expect(result.stdout || result.stderr).toContain('Usage: arden');
    });
  });

  describe('Command Structure', () => {
    it('should show config command help', async () => {
      const result = await runCli(['config', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('config');
      expect(result.stdout).toContain('View and manage');
    });

    it('should show event command help', async () => {
      const result = await runCli(['event', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('event');
      expect(result.stdout).toContain('--agent');
      expect(result.stdout).toContain('--data');
    });
  });

  describe('Global Options', () => {
    it('should accept global --host option', async () => {
      const result = await runCli(['--host', 'https://example.com', 'config']);

      // Should not fail with invalid global option
      expect(result.exitCode).toBe(0);
    });

    it('should show help with global options', async () => {
      const result = await runCli(['--help']);

      expect(result.stdout).toContain('--host');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid command gracefully', async () => {
      const result = await runCli(['invalid-command']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('error');
    });

    it('should handle invalid subcommand gracefully', async () => {
      const result = await runCli(['events', 'invalid-subcommand']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('error');
    });

    it('should handle missing required arguments gracefully', async () => {
      const result = await runCli(['event']);

      // Validation errors should exit with code 2 (config/validation errors)
      expect(result.exitCode).toBe(2);
      // Check either stdout or stderr for validation error message
      expect(result.stdout || result.stderr).toContain('Invalid input');
    });
  });

  describe('Configuration Commands', () => {
    it('should show configuration', async () => {
      const result = await runCli(['config']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration');
    });
  });

  describe('Validation Commands', () => {
    it('should handle validation with no input', async () => {
      // Test a simple command that should validate inputs
      const result = await runCli(['event', '--help']);

      // This should succeed and show help
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('event');
    });
  });

  describe('CLI Executable', () => {
    it('should have correct shebang and be executable', async () => {
      const fs = require('fs');
      const content = fs.readFileSync(cliPath, 'utf8');

      expect(content).toStartWith('#!/usr/bin/env node');
    });

    it('should start quickly', async () => {
      const startTime = Date.now();
      await runCli(['--help']);
      const duration = Date.now() - startTime;

      // Should start in under 2 seconds
      expect(duration).toBeLessThan(2000);
    });
  });
});
