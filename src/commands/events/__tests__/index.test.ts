import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { eventCommand } from '../index';

describe('event command', () => {
  let mockExit: ReturnType<typeof spyOn>;
  let mockConsoleLog: ReturnType<typeof spyOn>;

  beforeEach(() => {
    mockExit = spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockConsoleLog = spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
  });

  it('should create event command with correct structure', () => {
    expect(eventCommand.name()).toBe('event');
    expect(eventCommand.description()).toBe('Send a telemetry event to Arden Stats API');

    // Should not have subcommands anymore
    expect(eventCommand.commands).toHaveLength(0);
  });

  it('should have the correct options', () => {
    const options = eventCommand.options.map(opt => opt.long);
    expect(options).toContain('--agent');
    expect(options).toContain('--bid');
    expect(options).toContain('--mult');
    expect(options).toContain('--time');
    expect(options).toContain('--data');
    expect(options).toContain('--file');
    expect(options).toContain('--print');
  });
});
