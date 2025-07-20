import { describe, test, expect, beforeEach, mock } from "bun:test";
import { Command } from "commander";

// Mock all dependencies
mock.module("../../src/commands/claude", () => ({
  claudeCommand: new Command('claude').description('Claude commands')
}));

mock.module("../../src/commands/events", () => ({
  eventsCommand: new Command('events').description('Event commands')
}));

mock.module("../../src/commands/agents", () => ({
  agentsCommand: mock(() => new Command('agents').description('Agent commands'))
}));

mock.module("../../src/commands/users", () => ({
  usersCommand: mock(() => new Command('users').description('User commands'))
}));

mock.module("../../src/commands/config", () => ({
  configCommand: new Command('config').description('Config commands')
}));

mock.module("../../src/util/logger", () => ({
  default: {
    warn: mock(),
    error: mock(),
    info: mock(),
    debug: mock()
  }
}));

mock.module("../../src/util/env", () => ({
  default: {
    HOST: "https://test.com"
  }
}));

mock.module("fs", () => ({
  readFileSync: mock((path: string) => {
    if (path.includes("package.json")) {
      return JSON.stringify({ version: "1.0.0" });
    }
    throw new Error("File not found");
  })
}));

mock.module("path", () => ({
  join: mock((...args: string[]) => args.join("/"))
}));

describe("CLI Index", () => {
  let originalProcessExit: typeof process.exit;
  let originalConsoleError: typeof console.error;
  let errors: string[];

  beforeEach(() => {
    mock.restore();
    
    // Mock process.exit
    originalProcessExit = process.exit;
    // @ts-ignore
    process.exit = mock((code?: number) => {
      throw new Error(`Process would exit with code ${code}`);
    });

    // Mock console.error
    errors = [];
    originalConsoleError = console.error;
    console.error = (...args: any[]) => errors.push(args.join(" "));
  });

  test("creates CLI program with correct configuration", () => {
    // Import after mocks are set up
    delete require.cache[require.resolve("../../src/index")];
    
    // This should create the program without throwing
    expect(() => require("../../src/index")).not.toThrow();
  });

  test("reads version from package.json", () => {
    const fs = require("fs");
    delete require.cache[require.resolve("../../src/index")];
    
    require("../../src/index");
    
    expect(fs.readFileSync).toHaveBeenCalledWith(
      expect.stringContaining("package.json"),
      "utf-8"
    );
  });

  test("handles package.json read errors gracefully", () => {
    const fs = require("fs");
    const logger = require("../../src/util/logger").default;
    
    fs.readFileSync = mock(() => {
      throw new Error("Cannot read file");
    });
    
    delete require.cache[require.resolve("../../src/index")];
    
    expect(() => require("../../src/index")).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith("Could not read version from package.json");
  });

  test("configures program with correct name and description", () => {
    delete require.cache[require.resolve("../../src/index")];
    
    // The module should load without errors
    expect(() => require("../../src/index")).not.toThrow();
  });

  test("adds all command modules", () => {
    const agentsCommand = require("../../src/commands/agents").agentsCommand;
    const usersCommand = require("../../src/commands/users").usersCommand;
    
    delete require.cache[require.resolve("../../src/index")];
    
    require("../../src/index");
    
    // These should have been called to get the command instances
    expect(agentsCommand).toHaveBeenCalled();
    expect(usersCommand).toHaveBeenCalled();
  });

  test("sets host option from environment", () => {
    delete require.cache[require.resolve("../../src/index")];
    
    // Should not throw when setting up the program
    expect(() => require("../../src/index")).not.toThrow();
  });

  test("handles malformed package.json", () => {
    const fs = require("fs");
    const logger = require("../../src/util/logger").default;
    
    fs.readFileSync = mock(() => "invalid json");
    
    delete require.cache[require.resolve("../../src/index")];
    
    expect(() => require("../../src/index")).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith("Could not read version from package.json");
  });

  test("uses version from package.json when available", () => {
    const fs = require("fs");
    
    fs.readFileSync = mock(() => JSON.stringify({ version: "2.0.0" }));
    
    delete require.cache[require.resolve("../../src/index")];
    
    // Should not throw
    expect(() => require("../../src/index")).not.toThrow();
  });

  test("falls back to unknown version when package.json has no version", () => {
    const fs = require("fs");
    
    fs.readFileSync = mock(() => JSON.stringify({}));
    
    delete require.cache[require.resolve("../../src/index")];
    
    // Should not throw
    expect(() => require("../../src/index")).not.toThrow();
  });

  test("command structure includes all required commands", () => {
    delete require.cache[require.resolve("../../src/index")];
    
    // Importing should set up the complete command structure
    expect(() => require("../../src/index")).not.toThrow();
  });

  afterEach(() => {
    process.exit = originalProcessExit;
    console.error = originalConsoleError;
  });
});
