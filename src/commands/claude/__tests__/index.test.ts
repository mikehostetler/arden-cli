import { describe, it, expect } from "bun:test";
import { claudeCommand } from "../index";

describe("claude command", () => {
  it("should be configured correctly", () => {
    expect(claudeCommand.name()).toBe("claude");
    expect(claudeCommand.description()).toBe("Claude Code integration");
  });

  it("should have install subcommand", () => {
    const subcommands = claudeCommand.commands.map(cmd => cmd.name());
    expect(subcommands).toContain("install");
  });

  it("should have hook subcommand", () => {
    const subcommands = claudeCommand.commands.map(cmd => cmd.name());
    expect(subcommands).toContain("hook");
  });

  it("should have hook subcommand with correct configuration", () => {
    const hookCommand = claudeCommand.commands.find(cmd => cmd.name() === "hook");
    expect(hookCommand).toBeDefined();
    expect(hookCommand?.description()).toBe("(internal) invoked by Claude Code runtime");
    
    // Check that it has the expected options
    const options = hookCommand?.options.map(opt => opt.long);
    expect(options).toContain("--dry-run");
    expect(options).toContain("--print");
  });
});
