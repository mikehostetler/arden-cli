import { describe, it, expect } from "bun:test";
import { buildInstallCommand } from "../install";

describe("claude install command", () => {
  it("should be configured correctly", () => {
    const command = buildInstallCommand();
    expect(command.name()).toBe("install");
    expect(command.description()).toBe("Configure Claude Code hooks to send Arden telemetry");
    
    const options = command.options.map(opt => opt.long);
    expect(options).toContain("--settings");
    expect(options).toContain("--yes");
    expect(options).toContain("--dry-run");
  });

  it("should have correct option aliases", () => {
    const command = buildInstallCommand();
    
    const settingsOption = command.options.find(opt => opt.long === "--settings");
    expect(settingsOption?.short).toBe("-s");
    
    const yesOption = command.options.find(opt => opt.long === "--yes");
    expect(yesOption?.short).toBe("-y");
  });

  it("should have correct default values", () => {
    const command = buildInstallCommand();
    
    const settingsOption = command.options.find(opt => opt.long === "--settings");
    expect(settingsOption?.defaultValue).toBe("~/.claude/settings.json");
  });

  it("should have action handler", () => {
    const command = buildInstallCommand();
    expect(command._actionHandler).toBeDefined();
  });
});
