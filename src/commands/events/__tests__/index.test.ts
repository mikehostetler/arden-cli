import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { Command } from "commander";
import { eventsCommand } from "../index";

describe("events command", () => {
  let mockExit: any;
  let mockConsoleLog: any;

  beforeEach(() => {
    mockExit = spyOn(process, "exit").mockImplementation(() => undefined as never);
    mockConsoleLog = spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
  });

  it("should create events command with correct structure", () => {
    expect(eventsCommand.name()).toBe("events");
    expect(eventsCommand.description()).toBe("Send telemetry events to Arden Stats API");
    
    const subcommands = eventsCommand.commands.map(cmd => cmd.name());
    expect(subcommands).toContain("send");
    expect(subcommands).toContain("batch");
    expect(subcommands).toContain("pipe");
    expect(subcommands).toContain("validate");
  });

  it("should have send subcommand", () => {
    const sendCommand = eventsCommand.commands.find(cmd => cmd.name() === "send");
    expect(sendCommand).toBeDefined();
    expect(sendCommand?.description()).toBe("Send a single telemetry event");
  });

  it("should have batch subcommand", () => {
    const batchCommand = eventsCommand.commands.find(cmd => cmd.name() === "batch");
    expect(batchCommand).toBeDefined();
    expect(batchCommand?.description()).toBe("Send multiple telemetry events from a JSON file");
  });

  it("should have pipe subcommand", () => {
    const pipeCommand = eventsCommand.commands.find(cmd => cmd.name() === "pipe");
    expect(pipeCommand).toBeDefined();
    expect(pipeCommand?.description()).toBe("Send telemetry events from stdin (JSON object or array)");
  });

  it("should have validate subcommand", () => {
    const validateCommand = eventsCommand.commands.find(cmd => cmd.name() === "validate");
    expect(validateCommand).toBeDefined();
    expect(validateCommand?.description()).toBe("Validate telemetry events without sending them");
  });
});
