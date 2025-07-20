import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { Command } from "commander";
import { agentsCommand } from "../index";

describe("agents command", () => {
  let command: Command;
  let mockExit: any;
  let mockConsoleLog: any;

  beforeEach(() => {
    command = agentsCommand();
    mockExit = spyOn(process, "exit").mockImplementation(() => undefined as never);
    mockConsoleLog = spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
  });

  it("should create agents command with correct structure", () => {
    expect(command.name()).toBe("agents");
    expect(command.description()).toBe("Manage agents");
    
    const subcommands = command.commands.map(cmd => cmd.name());
    expect(subcommands).toContain("list");
    expect(subcommands).toContain("leaderboard");
  });

  it("should have list subcommand", () => {
    const listCommand = command.commands.find(cmd => cmd.name() === "list");
    expect(listCommand).toBeDefined();
    expect(listCommand?.description()).toBe("List all agents");
  });

  it("should have leaderboard subcommand", () => {
    const leaderboardCommand = command.commands.find(cmd => cmd.name() === "leaderboard");
    expect(leaderboardCommand).toBeDefined();
    expect(leaderboardCommand?.description()).toBe("Show top agents leaderboard");
  });
});
