import { describe, expect, it } from 'bun:test';

import { buildInitCommand } from '../init';

describe('claude init command', () => {
  it('should be configured correctly', () => {
    const command = buildInitCommand();
    expect(command.name()).toBe('init');
    expect(command.description()).toBe('Initialize Claude Code hooks to send Arden telemetry');

    const options = command.options.map(opt => opt.long);
    expect(options).toContain('--settings');
    expect(options).toContain('--yes');
  });

  it('should have correct option aliases', () => {
    const command = buildInitCommand();

    const settingsOption = command.options.find(opt => opt.long === '--settings');
    expect(settingsOption?.short).toBe('-s');

    const yesOption = command.options.find(opt => opt.long === '--yes');
    expect(yesOption?.short).toBe('-y');
  });

  it('should have correct default values', () => {
    const command = buildInitCommand();

    const settingsOption = command.options.find(opt => opt.long === '--settings');
    expect(settingsOption?.defaultValue).toBe('~/.claude/settings.json');
  });

  it('should have action handler', () => {
    const command = buildInitCommand();
    expect(command._actionHandler).toBeDefined();
  });
});
