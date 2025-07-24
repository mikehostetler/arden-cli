import { afterEach, beforeEach, mock } from 'bun:test';
import { type ExecaChildProcess } from 'execa';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';

/**
 * Shared test setup utilities for arden-cli
 */

// Test environment setup
export interface TestEnvironment {
  tempDir: string;
  settingsDir: string;
  settingsFile: string;
  originalEnv: Record<string, string | undefined>;
  originalCwd: string;
}

// Mock response types
export interface MockApiResponse {
  status: number;
  data?: any;
  error?: string;
}

// CLI execution result
export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  command: string;
}

/**
 * Create isolated test environment
 */
export function createTestEnvironment(): TestEnvironment {
  const tempDir = join(tmpdir(), 'arden-cli-test-' + Math.random().toString(36).substring(7));
  const settingsDir = join(tempDir, '.arden');
  const settingsFile = join(settingsDir, 'settings.json');

  return {
    tempDir,
    settingsDir,
    settingsFile,
    originalEnv: {},
    originalCwd: process.cwd(),
  };
}

/**
 * Setup test environment with cleanup
 */
export function setupTestEnvironment() {
  let testEnv: TestEnvironment;

  beforeEach(() => {
    testEnv = createTestEnvironment();

    // Create temp directory
    if (!existsSync(testEnv.tempDir)) {
      mkdirSync(testEnv.tempDir, { recursive: true });
    }

    // Save original environment
    testEnv.originalEnv = {
      HOME: process.env.HOME,
      ARDEN_API_TOKEN: process.env.ARDEN_API_TOKEN,
      ARDEN_USER_ID: process.env.ARDEN_USER_ID,
      ARDEN_HOST: process.env.ARDEN_HOST,
      ARDEN_LOG_LEVEL: process.env.ARDEN_LOG_LEVEL,
      ARDEN_DEFAULT_FORMAT: process.env.ARDEN_DEFAULT_FORMAT,
      ARDEN_INTERACTIVE: process.env.ARDEN_INTERACTIVE,
      HOST: process.env.HOST,
      LOG_LEVEL: process.env.LOG_LEVEL,
      NODE_ENV: process.env.NODE_ENV,
    };

    // Set up test environment
    process.env.HOME = testEnv.tempDir;
    process.env.NODE_ENV = 'test';

    // Clear arden environment variables
    delete process.env.ARDEN_API_TOKEN;
    delete process.env.ARDEN_USER_ID;
    delete process.env.ARDEN_HOST;
    delete process.env.ARDEN_LOG_LEVEL;
    delete process.env.ARDEN_DEFAULT_FORMAT;
    delete process.env.ARDEN_INTERACTIVE;
    delete process.env.HOST;
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    // Restore original environment
    Object.entries(testEnv.originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });

    // Clean up temp directory
    if (existsSync(testEnv.tempDir)) {
      rmSync(testEnv.tempDir, { recursive: true, force: true });
    }

    // Restore working directory
    process.chdir(testEnv.originalCwd);
  });

  return () => testEnv;
}

/**
 * Mock API response helpers
 */
export const mockApiHelpers = {
  success: (data: any): MockApiResponse => ({
    status: 200,
    data,
  }),

  error: (status: number, error: string): MockApiResponse => ({
    status,
    error,
  }),

  unauthorized: (): MockApiResponse => ({
    status: 401,
    error: 'Unauthorized',
  }),

  notFound: (): MockApiResponse => ({
    status: 404,
    error: 'Not found',
  }),

  serverError: (): MockApiResponse => ({
    status: 500,
    error: 'Internal server error',
  }),
};

/**
 * Mock console output for testing
 */
export function mockConsoleOutput() {
  const logs: string[] = [];
  const errors: string[] = [];
  const warns: string[] = [];

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = mock((...args: any[]) => {
    logs.push(args.map(arg => String(arg)).join(' '));
  });

  console.error = mock((...args: any[]) => {
    errors.push(args.map(arg => String(arg)).join(' '));
  });

  console.warn = mock((...args: any[]) => {
    warns.push(args.map(arg => String(arg)).join(' '));
  });

  return {
    logs,
    errors,
    warns,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    },
  };
}

/**
 * Helper to create test settings file
 */
export function createTestSettings(testEnv: TestEnvironment, settings: Record<string, any>) {
  if (!existsSync(testEnv.settingsDir)) {
    mkdirSync(testEnv.settingsDir, { recursive: true });
  }

  const fs = require('fs');
  fs.writeFileSync(testEnv.settingsFile, JSON.stringify(settings, null, 2));
}

/**
 * Helper to read test settings file
 */
export function readTestSettings(testEnv: TestEnvironment): Record<string, any> | null {
  if (!existsSync(testEnv.settingsFile)) {
    return null;
  }

  const fs = require('fs');
  try {
    return JSON.parse(fs.readFileSync(testEnv.settingsFile, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Process mock helpers
 */
export function mockProcessExit() {
  const originalExit = process.exit;
  const exitCalls: number[] = [];

  // @ts-ignore - Mock process.exit
  process.exit = mock((code?: number) => {
    exitCalls.push(code || 0);
    throw new Error(`Process exit called with code ${code || 0}`);
  });

  return {
    exitCalls,
    restore: () => {
      process.exit = originalExit;
    },
  };
}

/**
 * Mock stdout/stderr for testing output formatting
 */
export function mockStdStreams() {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  // @ts-ignore - Mock stdout.write
  process.stdout.write = mock((chunk: any) => {
    stdout.push(String(chunk));
    return true;
  });

  // @ts-ignore - Mock stderr.write
  process.stderr.write = mock((chunk: any) => {
    stderr.push(String(chunk));
    return true;
  });

  return {
    stdout,
    stderr,
    restore: () => {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    },
  };
}

/**
 * Create test data generators for consistent test data
 */
export const testDataGenerators = {
  /**
   * Generate test event data
   */
  event: (overrides: Partial<any> = {}) => ({
    type: 'test_event',
    agent_id: 'test-agent-123',
    user_id: 'test-user-456',
    timestamp: '2024-01-01T00:00:00.000Z',
    data: { key: 'value' },
    ...overrides,
  }),

  /**
   * Generate test agent data
   */
  agent: (overrides: Partial<any> = {}) => ({
    id: 'agent-123',
    name: 'Test Agent',
    status: 'active',
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  /**
   * Generate test user data
   */
  user: (overrides: Partial<any> = {}) => ({
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  /**
   * Generate test leaderboard data
   */
  leaderboard: (count = 3) =>
    Array.from({ length: count }, (_, i) => ({
      rank: i + 1,
      agent_id: `agent-${i + 1}`,
      score: 1000 - i * 100,
      events: 50 - i * 5,
    })),

  /**
   * Generate test settings data
   */
  settings: (overrides: Partial<any> = {}) => ({
    api_token: 'test-token-123',
    user_id: 'test-user-456',
    host: 'https://test.ardenstats.com',
    log_level: 'info',
    default_format: 'table',
    interactive: true,
    ...overrides,
  }),
};

/**
 * Assertion helpers for common test patterns
 */
export const testAssertions = {
  /**
   * Assert CLI output contains success message
   */
  expectSuccess: (output: string, message?: string) => {
    expect(output).toContain('✓');
    if (message) {
      expect(output).toContain(message);
    }
  },

  /**
   * Assert CLI output contains error message
   */
  expectError: (output: string, message?: string) => {
    expect(output).toContain('✗');
    if (message) {
      expect(output).toContain(message);
    }
  },

  /**
   * Assert CLI output contains warning message
   */
  expectWarning: (output: string, message?: string) => {
    expect(output).toContain('⚠');
    if (message) {
      expect(output).toContain(message);
    }
  },

  /**
   * Assert CLI output contains info message
   */
  expectInfo: (output: string, message?: string) => {
    expect(output).toContain('ℹ');
    if (message) {
      expect(output).toContain(message);
    }
  },

  /**
   * Assert valid JSON output
   */
  expectValidJson: (output: string) => {
    expect(() => JSON.parse(output)).not.toThrow();
    return JSON.parse(output);
  },

  /**
   * Assert table output format
   */
  expectTableFormat: (output: string) => {
    // Basic table format checks
    expect(output).toMatch(/┌─+┬─+┬─+┐|│.*│.*│.*│/);
  },

  /**
   * Assert exit code
   */
  expectExitCode: (result: { exitCode: number }, expectedCode: number) => {
    expect(result.exitCode).toBe(expectedCode);
  },
};

/**
 * Test timeout helpers
 */
export const testTimeouts = {
  fast: 1000, // 1 second
  normal: 5000, // 5 seconds
  slow: 10000, // 10 seconds
  integration: 30000, // 30 seconds
};

/**
 * Environment variable helpers for testing
 */
export const envHelpers = {
  /**
   * Set test environment variables
   */
  setTestEnv: (vars: Record<string, string>) => {
    Object.entries(vars).forEach(([key, value]) => {
      process.env[key] = value;
    });
  },

  /**
   * Clear test environment variables
   */
  clearTestEnv: (keys: string[]) => {
    keys.forEach(key => {
      delete process.env[key];
    });
  },

  /**
   * Get standard Arden environment variable keys
   */
  getArdenEnvKeys: () => [
    'ARDEN_API_TOKEN',
    'ARDEN_USER_ID',
    'ARDEN_HOST',
    'ARDEN_LOG_LEVEL',
    'ARDEN_DEFAULT_FORMAT',
    'ARDEN_INTERACTIVE',
    'HOST', // Legacy
    'LOG_LEVEL', // Legacy
  ],
};
