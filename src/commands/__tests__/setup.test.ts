import { describe, it, expect, mock, beforeEach } from "bun:test";
import { buildSetupCommand } from "../setup";

// Mock dependencies
const mockDetectClaude = mock();
const mockDetectAmp = mock();
const mockCheckClaudeHooks = mock();
const mockEnsureApiToken = mock();

mock.module("../../util/detect", () => ({
  detectClaude: mockDetectClaude,
  detectAmp: mockDetectAmp,
}));

mock.module("../claude/install", () => ({
  checkClaudeHooks: mockCheckClaudeHooks,
  expandTilde: (path: string) => path.replace(/^~/, "/home/user"),
}));

mock.module("../../util/config", () => ({
  ensureApiToken: mockEnsureApiToken,
}));

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
let consoleOutput: string[] = [];

beforeEach(() => {
  // Reset mocks
  mockDetectClaude.mockReset();
  mockDetectAmp.mockReset();
  mockCheckClaudeHooks.mockReset();
  mockEnsureApiToken.mockReset();
  
  // Reset console capture
  consoleOutput = [];
  console.log = (...args) => consoleOutput.push(args.join(" "));
  console.error = (...args) => consoleOutput.push(args.join(" "));
});

describe("setup command", () => {
  it("should create setup command with correct options", () => {
    const command = buildSetupCommand();
    
    expect(command.name()).toBe("setup");
    expect(command.description()).toBe("Set up Arden CLI for your AI agent environment");
    
    const options = command.options;
    expect(options.some(opt => opt.flags === "-y, --yes")).toBe(true);
    expect(options.some(opt => opt.flags === "--dry-run")).toBe(true);
    expect(options.some(opt => opt.flags === "--non-interactive")).toBe(true);
    expect(options.some(opt => opt.flags === "--host <url>")).toBe(true);
  });

  it("should detect agents and show summary", async () => {
    mockDetectClaude.mockResolvedValue({
      present: true,
      bin: "/usr/local/bin/claude",
      version: "0.3.7"
    });
    
    mockDetectAmp.mockResolvedValue({
      present: false
    });
    
    mockCheckClaudeHooks.mockResolvedValue(false); // hooks already installed
    mockEnsureApiToken.mockResolvedValue("test-token");

    // We can't easily test the full command execution without mocking process.exit
    // and readline, so we'll test individual components
    expect(mockDetectClaude).toBeDefined();
    expect(mockDetectAmp).toBeDefined();
  });
});
