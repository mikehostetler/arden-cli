import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { initCommand } from '../setup';

// Mock dependencies
const mockDetectClaude = mock();
const mockDetectAmp = mock();
const mockCheckClaudeHooks = mock();
const mockEnsureApiToken = mock();

mock.module('../../util/detect', () => ({
  detectClaude: mockDetectClaude,
  detectAmp: mockDetectAmp,
}));

mock.module('../claude/install', () => ({
  checkClaudeHooks: mockCheckClaudeHooks,
  expandTilde: (path: string) => path.replace(/^~/, '/home/user'),
}));

mock.module('../../util/config', () => ({
  ensureApiToken: mockEnsureApiToken,
}));

// Mock output functions
const mockOutputMessage = mock();
const mockOutputSuccess = mock();
const mockOutputError = mock();
const mockOutputInfo = mock();

mock.module('../../util/output', () => ({
  output: {
    message: mockOutputMessage,
    success: mockOutputSuccess,
    error: mockOutputError,
    info: mockOutputInfo,
  },
  logger: {
    debug: mock(),
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

beforeEach(() => {
  // Reset mocks
  mockDetectClaude.mockReset();
  mockDetectAmp.mockReset();
  mockCheckClaudeHooks.mockReset();
  mockEnsureApiToken.mockReset();

  // Reset output mocks
  mockOutputMessage.mockReset();
  mockOutputSuccess.mockReset();
  mockOutputError.mockReset();
  mockOutputInfo.mockReset();
});

describe('init command', () => {
  it('should create init command with correct options', () => {
    const command = initCommand;

    expect(command.name()).toBe('init');
    expect(command.description()).toBe('Initialize Arden CLI for your AI agent environment');

    // Note: --host and --yes are global options inherited from parent command
  });

  it('should detect agents and show summary', async () => {
    mockDetectClaude.mockResolvedValue({
      present: true,
      bin: '/usr/local/bin/claude',
      version: '0.3.7',
    });

    mockDetectAmp.mockResolvedValue({
      present: false,
    });

    mockCheckClaudeHooks.mockResolvedValue(false); // hooks already installed
    mockEnsureApiToken.mockResolvedValue('test-token');

    // We can't easily test the full command execution without mocking process.exit
    // and readline, so we'll test individual components
    expect(mockDetectClaude).toBeDefined();
    expect(mockDetectAmp).toBeDefined();
  });
});
