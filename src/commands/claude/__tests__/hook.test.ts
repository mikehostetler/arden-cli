import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { claudeCommand } from "../index";

const mockConsoleError = spyOn(console, "error").mockImplementation(() => {});
const mockProcessExit = spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit");
});

// Mock the handler module
const mockHandleClaudeHook = mock(() => Promise.resolve());
spyOn(require("../handler"), "handleClaudeHook").mockImplementation(mockHandleClaudeHook);

describe("claude hook command", () => {
  beforeEach(() => {
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
    mockHandleClaudeHook.mockClear();
  });

  afterEach(() => {
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
  });

  const getHookCommand = () => {
    return claudeCommand.commands.find(cmd => cmd.name() === "hook");
  };

  it("should be configured correctly", () => {
    const hookCommand = getHookCommand();
    expect(hookCommand).toBeDefined();
    expect(hookCommand?.name()).toBe("hook");
    expect(hookCommand?.description()).toBe("(internal) invoked by Claude Code runtime");
    
    // Check options
    const options = hookCommand?.options.map(opt => opt.long);
    expect(options).toContain("--dry-run");
    expect(options).toContain("--print");
  });

  it("should require hook argument", () => {
    const hookCommand = getHookCommand();
    // Commander.js argument method adds to internal registeredArguments
    // We can check that the command has arguments configured
    expect(hookCommand?.registeredArguments).toHaveLength(1);
    expect(hookCommand?.registeredArguments[0].name()).toBe("hook");
    expect(hookCommand?.registeredArguments[0].required).toBe(true);
  });

  it("should have action handler", () => {
    const hookCommand = getHookCommand();
    expect(hookCommand?._actionHandler).toBeDefined();
  });

  it("should have correct option configurations", () => {
    const hookCommand = getHookCommand();
    
    const dryRunOption = hookCommand?.options.find(opt => opt.long === "--dry-run");
    expect(dryRunOption?.description).toBe("validate payload and skip API call");
    expect(dryRunOption?.defaultValue).toBe(false);
    
    const printOption = hookCommand?.options.find(opt => opt.long === "--print");
    expect(printOption?.description).toBe("print enriched payload to stdout");
    expect(printOption?.defaultValue).toBe(false);
  });
});
