import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { Command } from "commander";

// Mock all external dependencies
mock.module("../../../../src/util/client", () => ({
  sendEvents: mock(() => Promise.resolve({ status: 'accepted' }))
}));

mock.module("../../../../src/util/settings", () => ({
  getUserId: mock((param: string | undefined) => param || "test-user-id"),
  getApiToken: mock((param: string | undefined) => param || "test-token")
}));

mock.module("../../../../src/util/logger", () => ({
  debug: mock(),
  info: mock(),
  warn: mock(),
  error: mock()
}));

mock.module("fs", () => ({
  readFileSync: mock((path: string | number, encoding?: string) => {
    if (path === 0) return '{"stdin": "data"}'; // stdin
    if (path === 'test.json') return '{"file": "data"}'; // file
    throw new Error("File not found");
  })
}));

describe("Send Command", () => {
  let command: Command;
  let originalConsoleLog: typeof console.log;
  let originalProcessExit: typeof process.exit;
  let logs: string[];

  beforeEach(() => {
    // Reset mocks
    mock.restore();
    
    // Mock console.log
    logs = [];
    originalConsoleLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(" "));
    
    // Mock process.exit
    originalProcessExit = process.exit;
    // @ts-ignore
    process.exit = mock((code?: number) => {
      throw new Error(`Process would exit with code ${code}`);
    });

    // Set up command structure
    const rootCommand = new Command()
      .option('-H, --host <url>', 'API host URL', 'https://test.com');
    
    const eventsCommand = new Command('events');
    
    // Import after mocks are set up
    const { sendCommand } = require("../../../../src/commands/events/send");
    eventsCommand.addCommand(sendCommand);
    rootCommand.addCommand(eventsCommand);
    
    command = rootCommand;
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    process.exit = originalProcessExit;
  });

  test("requires agent parameter", async () => {
    expect(() => 
      command.parseAsync(['node', 'test', 'events', 'send'], { from: 'node' })
    ).toThrow("Process would exit with code 1");
  });

  test("builds event with required parameters", async () => {
    const { validateEvent } = require("../../../../src/util/schema");
    const originalValidate = validateEvent;
    let capturedEvent: any;
    
    mock.module("../../../../src/util/schema", () => ({
      ...require.requireActual("../../../../src/util/schema"),
      validateEvent: mock((event: any) => {
        capturedEvent = event;
        return originalValidate(event);
      })
    }));

    await command.parseAsync([
      'node', 'test', 'events', 'send',
      '--agent', 'A-12345',
      '--dry-run'
    ], { from: 'node' });

    expect(capturedEvent).toBeDefined();
    expect(capturedEvent.agent).toBe('A-12345');
    expect(capturedEvent.bid).toBe(0);
    expect(capturedEvent.mult).toBe(0);
  });

  test("parses key-value arguments", async () => {
    const { validateEvent } = require("../../../../src/util/schema");
    const originalValidate = validateEvent;
    let capturedEvent: any;
    
    mock.module("../../../../src/util/schema", () => ({
      ...require.requireActual("../../../../src/util/schema"),
      validateEvent: mock((event: any) => {
        capturedEvent = event;
        return originalValidate(event);
      })
    }));

    await command.parseAsync([
      'node', 'test', 'events', 'send',
      '--agent', 'A-12345',
      '--dry-run',
      'key1=value1',
      'key2=123',
      'nested=complex=value'
    ], { from: 'node' });

    expect(capturedEvent.data).toEqual({
      key1: 'value1',
      key2: 123,
      nested: 'complex=value'
    });
  });

  test("parses JSON data option", async () => {
    const { validateEvent } = require("../../../../src/util/schema");
    const originalValidate = validateEvent;
    let capturedEvent: any;
    
    mock.module("../../../../src/util/schema", () => ({
      ...require.requireActual("../../../../src/util/schema"),
      validateEvent: mock((event: any) => {
        capturedEvent = event;
        return originalValidate(event);
      })
    }));

    await command.parseAsync([
      'node', 'test', 'events', 'send',
      '--agent', 'A-12345',
      '--data', '{"test": "value", "number": 42}',
      '--dry-run'
    ], { from: 'node' });

    expect(capturedEvent.data).toEqual({
      test: 'value',
      number: 42
    });
  });

  test("reads data from stdin", async () => {
    const { validateEvent } = require("../../../../src/util/schema");
    const originalValidate = validateEvent;
    let capturedEvent: any;
    
    mock.module("../../../../src/util/schema", () => ({
      ...require.requireActual("../../../../src/util/schema"),
      validateEvent: mock((event: any) => {
        capturedEvent = event;
        return originalValidate(event);
      })
    }));

    await command.parseAsync([
      'node', 'test', 'events', 'send',
      '--agent', 'A-12345',
      '--data', '-',
      '--dry-run'
    ], { from: 'node' });

    expect(capturedEvent.data).toEqual({ stdin: 'data' });
  });

  test("reads data from file", async () => {
    const { validateEvent } = require("../../../../src/util/schema");
    const originalValidate = validateEvent;
    let capturedEvent: any;
    
    mock.module("../../../../src/util/schema", () => ({
      ...require.requireActual("../../../../src/util/schema"),
      validateEvent: mock((event: any) => {
        capturedEvent = event;
        return originalValidate(event);
      })
    }));

    await command.parseAsync([
      'node', 'test', 'events', 'send',
      '--agent', 'A-12345',
      '--data', '@test.json',
      '--dry-run'
    ], { from: 'node' });

    expect(capturedEvent.data).toEqual({ file: 'data' });
  });

  test("merges data and key-value pairs", async () => {
    const { validateEvent } = require("../../../../src/util/schema");
    const originalValidate = validateEvent;
    let capturedEvent: any;
    
    mock.module("../../../../src/util/schema", () => ({
      ...require.requireActual("../../../../src/util/schema"),
      validateEvent: mock((event: any) => {
        capturedEvent = event;
        return originalValidate(event);
      })
    }));

    await command.parseAsync([
      'node', 'test', 'events', 'send',
      '--agent', 'A-12345',
      '--data', '{"base": "value"}',
      '--dry-run',
      'additional=data'
    ], { from: 'node' });

    expect(capturedEvent.data).toEqual({
      base: 'value',
      additional: 'data'
    });
  });

  test("dry run mode validates and logs", async () => {
    const logger = require("../../../../src/util/logger").default;
    
    await command.parseAsync([
      'node', 'test', 'events', 'send',
      '--agent', 'A-12345',
      '--dry-run'
    ], { from: 'node' });

    expect(logger.info).toHaveBeenCalledWith('Dry run - event validated successfully');
  });

  test("handles invalid JSON data", async () => {
    expect(() => 
      command.parseAsync([
        'node', 'test', 'events', 'send',
        '--agent', 'A-12345',
        '--data', 'invalid-json'
      ], { from: 'node' })
    ).toThrow("Process would exit with code 1");
  });

  test("handles invalid key-value pairs", async () => {
    expect(() =>
      command.parseAsync([
        'node', 'test', 'events', 'send',
        '--agent', 'A-12345',
        'invalid-pair'
      ], { from: 'node' })
    ).toThrow("Process would exit with code 1");
  });

  test("uses global host option", async () => {
    const { sendEvents } = require("../../../../src/util/client");
    
    await command.parseAsync([
      'node', 'test', '--host', 'https://custom.host.com',
      'events', 'send',
      '--agent', 'A-12345',
      '--bid', '100'
    ], { from: 'node' });

    expect(sendEvents).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        host: 'https://custom.host.com'
      })
    );
  });

  test("prints event when requested", async () => {
    await command.parseAsync([
      'node', 'test', 'events', 'send',
      '--agent', 'A-12345',
      '--print',
      '--dry-run'
    ], { from: 'node' });

    const output = logs.join("\n");
    expect(output).toContain('"agent": "A-12345"');
  });

  test("converts number parameters correctly", async () => {
    const { validateEvent } = require("../../../../src/util/schema");
    const originalValidate = validateEvent;
    let capturedEvent: any;
    
    mock.module("../../../../src/util/schema", () => ({
      ...require.requireActual("../../../../src/util/schema"),
      validateEvent: mock((event: any) => {
        capturedEvent = event;
        return originalValidate(event);
      })
    }));

    await command.parseAsync([
      'node', 'test', 'events', 'send',
      '--agent', 'A-12345',
      '--bid', '100',
      '--mult', '2',
      '--time', '1234567890',
      '--dry-run'
    ], { from: 'node' });

    expect(capturedEvent.bid).toBe(100);
    expect(capturedEvent.mult).toBe(2);
    expect(capturedEvent.time).toBe(1234567890);
  });
});
