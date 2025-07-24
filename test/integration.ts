import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { execa } from 'execa';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { tmpdir } from 'os';
import { join } from 'path';

import type { CliResult } from './setup';

/**
 * E2E Integration Tests for arden-cli
 *
 * Tests the full CLI workflow from command invocation to output,
 * using msw for API mocking and execa for CLI execution.
 */

// Test server setup
const TEST_HOST = 'http://localhost:9999';
const TEST_API_TOKEN = 'test-token-123';
const TEST_USER_ID = 'test-user-456';

// Mock API server
const server = setupServer(
  // Events endpoints
  http.post(`${TEST_HOST}/api/events`, () => {
    return HttpResponse.json({
      success: true,
      event_id: 'evt_123',
      message: 'Event sent successfully',
    });
  }),

  http.post(`${TEST_HOST}/api/events/batch`, () => {
    return HttpResponse.json({
      success: true,
      events_processed: 2,
      message: 'Batch events sent successfully',
    });
  }),

  // Agents endpoints
  http.get(`${TEST_HOST}/api/agents`, () => {
    return HttpResponse.json({
      agents: [
        { id: 'agent-1', name: 'Test Agent 1', status: 'active' },
        { id: 'agent-2', name: 'Test Agent 2', status: 'inactive' },
      ],
    });
  }),

  http.get(`${TEST_HOST}/api/agents/leaderboard`, () => {
    return HttpResponse.json({
      leaderboard: [
        { agent_id: 'agent-1', score: 100, rank: 1 },
        { agent_id: 'agent-2', score: 85, rank: 2 },
      ],
    });
  }),

  // Users endpoints
  http.get(`${TEST_HOST}/api/users/leaderboard`, () => {
    return HttpResponse.json({
      leaderboard: [
        { user_id: 'user-1', score: 200, rank: 1 },
        { user_id: 'user-2', score: 150, rank: 2 },
      ],
    });
  }),

  // Error responses
  http.post(`${TEST_HOST}/api/events/error`, () => {
    return HttpResponse.json({ error: 'Invalid event data' }, { status: 400 });
  }),

  http.get(`${TEST_HOST}/api/unauthorized`, () => {
    return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
  })
);

// Test environment
let testDir: string;
let settingsDir: string;
let settingsFile: string;
let cliPath: string;

beforeAll(async () => {
  // Start mock server
  server.listen({ onUnhandledRequest: 'error' });

  // Create test directory
  testDir = join(tmpdir(), 'arden-cli-e2e-' + Math.random().toString(36).substring(7));
  settingsDir = join(testDir, '.arden');
  settingsFile = join(settingsDir, 'settings.json');

  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }

  // Build CLI
  const buildResult = await execa('bun', ['run', 'build'], {
    cwd: process.cwd(),
    stdio: 'pipe',
  });

  if (buildResult.exitCode !== 0) {
    throw new Error(`Failed to build CLI: ${buildResult.stderr}`);
  }

  cliPath = join(process.cwd(), 'dist', 'index.js');

  if (!existsSync(cliPath)) {
    throw new Error(`CLI executable not found at ${cliPath}`);
  }
});

afterAll(() => {
  // Stop mock server
  server.close();

  // Clean up test directory
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

/**
 * Execute CLI command with test environment
 */
async function runCli(
  args: string[],
  options: {
    env?: Record<string, string>;
    input?: string;
    expectError?: boolean;
  } = {}
): Promise<CliResult> {
  const env = {
    HOME: testDir,
    NODE_ENV: 'test',
    ARDEN_HOST: TEST_HOST,
    ...options.env,
  };

  try {
    const result = await execa('node', [cliPath, ...args], {
      env,
      input: options.input,
      stdio: 'pipe',
      timeout: 10000,
    });

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      command: `arden ${args.join(' ')}`,
    };
  } catch (error: any) {
    if (options.expectError) {
      return {
        exitCode: error.exitCode || 1,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        command: `arden ${args.join(' ')}`,
      };
    }
    throw error;
  }
}

/**
 * Create test settings file
 */
function createSettings(settings: Record<string, any>) {
  if (!existsSync(settingsDir)) {
    mkdirSync(settingsDir, { recursive: true });
  }
  writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

describe('E2E CLI Tests', () => {
  describe('config command', () => {
    it('should set and get configuration values', async () => {
      // Set configuration
      const setResult = await runCli(['config', '--set', `api_token=${TEST_API_TOKEN}`]);
      expect(setResult.exitCode).toBe(0);
      expect(setResult.stdout).toContain('✓ Set api_token = [SET]');

      // Get configuration
      const getResult = await runCli(['config', '--get', 'api_token']);
      expect(getResult.exitCode).toBe(0);
      expect(getResult.stdout.trim()).toBe(TEST_API_TOKEN);

      // List configuration
      const listResult = await runCli(['config', '--list']);
      expect(listResult.exitCode).toBe(0);
      expect(listResult.stdout).toContain('api_token = [SET]');
    });

    it('should handle invalid configuration keys', async () => {
      const result = await runCli(['config', '--set', 'invalid_key=value'], { expectError: true });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid configuration key');
    });
  });

  describe('events send command', () => {
    it('should send single event successfully', async () => {
      createSettings({
        api_token: TEST_API_TOKEN,
        user_id: TEST_USER_ID,
        host: TEST_HOST,
      });

      const result = await runCli([
        'events',
        'send',
        '--type',
        'test_event',
        '--agent-id',
        'test-agent',
        '--data',
        '{"key":"value"}',
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('✓ Event sent successfully');
      expect(result.stdout).toContain('Event ID: evt_123');
    });

    it('should handle missing authentication', async () => {
      // No settings file
      const result = await runCli(
        ['events', 'send', '--type', 'test_event', '--agent-id', 'test-agent'],
        { expectError: true }
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('API token is required');
    });

    it('should validate event data', async () => {
      createSettings({
        api_token: TEST_API_TOKEN,
        user_id: TEST_USER_ID,
        host: TEST_HOST,
      });

      const result = await runCli(
        [
          'events',
          'send',
          '--type',
          '', // Invalid empty type
          '--agent-id',
          'test-agent',
        ],
        { expectError: true }
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Event type is required');
    });
  });

  describe('events batch command', () => {
    it('should send batch events from JSON input', async () => {
      createSettings({
        api_token: TEST_API_TOKEN,
        user_id: TEST_USER_ID,
        host: TEST_HOST,
      });

      const batchData = JSON.stringify([
        { type: 'event1', agent_id: 'agent1', data: { key1: 'value1' } },
        { type: 'event2', agent_id: 'agent2', data: { key2: 'value2' } },
      ]);

      const result = await runCli(['events', 'batch'], {
        input: batchData,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('✓ Batch events sent successfully');
      expect(result.stdout).toContain('Events processed: 2');
    });

    it('should handle invalid JSON input', async () => {
      createSettings({
        api_token: TEST_API_TOKEN,
        user_id: TEST_USER_ID,
        host: TEST_HOST,
      });

      const result = await runCli(['events', 'batch'], {
        input: 'invalid json',
        expectError: true,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid JSON');
    });
  });

  describe('agents list command', () => {
    it('should list agents in table format', async () => {
      createSettings({
        api_token: TEST_API_TOKEN,
        host: TEST_HOST,
      });

      const result = await runCli(['agents', 'list']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('agent-1');
      expect(result.stdout).toContain('Test Agent 1');
      expect(result.stdout).toContain('active');
    });

    it('should list agents in JSON format', async () => {
      createSettings({
        api_token: TEST_API_TOKEN,
        host: TEST_HOST,
      });

      const result = await runCli(['agents', 'list', '--format', 'json']);

      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout);
      expect(output.agents).toHaveLength(2);
      expect(output.agents[0].id).toBe('agent-1');
    });
  });

  describe('agents leaderboard command', () => {
    it('should show agents leaderboard', async () => {
      createSettings({
        api_token: TEST_API_TOKEN,
        host: TEST_HOST,
      });

      const result = await runCli(['agents', 'leaderboard']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('agent-1');
      expect(result.stdout).toContain('100');
      expect(result.stdout).toContain('1'); // rank
    });
  });

  describe('users leaderboard command', () => {
    it('should show users leaderboard', async () => {
      createSettings({
        api_token: TEST_API_TOKEN,
        host: TEST_HOST,
      });

      const result = await runCli(['users', 'leaderboard']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('user-1');
      expect(result.stdout).toContain('200');
      expect(result.stdout).toContain('1'); // rank
    });
  });

  describe('global options', () => {
    it('should use global --host option', async () => {
      createSettings({
        api_token: TEST_API_TOKEN,
        user_id: TEST_USER_ID,
      });

      const result = await runCli([
        '--host',
        TEST_HOST,
        'events',
        'send',
        '--type',
        'test_event',
        '--agent-id',
        'test-agent',
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('✓ Event sent successfully');
    });

    it('should show help when no command provided', async () => {
      const result = await runCli(['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('arden');
      expect(result.stdout).toContain('Commands:');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      createSettings({
        api_token: TEST_API_TOKEN,
        user_id: TEST_USER_ID,
        host: 'http://localhost:99999', // Non-existent port
      });

      const result = await runCli(
        ['events', 'send', '--type', 'test_event', '--agent-id', 'test-agent'],
        { expectError: true }
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Failed to send event');
    });

    it('should handle API errors with proper status codes', async () => {
      createSettings({
        api_token: TEST_API_TOKEN,
        user_id: TEST_USER_ID,
        host: TEST_HOST,
      });

      // Override server to return error for this specific test
      server.use(
        http.post(`${TEST_HOST}/api/events`, () => {
          return HttpResponse.json({ error: 'Invalid event data' }, { status: 400 });
        })
      );

      const result = await runCli(
        ['events', 'send', '--type', 'test_event', '--agent-id', 'test-agent'],
        { expectError: true }
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid event data');
    });
  });
});
