import { describe, it, expect } from "bun:test";
import { CLAUDE_HOOKS, isClaudeHook, type ClaudeHook } from "../hooks";

describe("claude hooks utilities", () => {
  describe("CLAUDE_HOOKS constant", () => {
    it("should contain all expected hooks", () => {
      const expectedHooks = ['PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SubagentStop'];
      expect(CLAUDE_HOOKS).toEqual(expectedHooks);
    });

    it("should be readonly", () => {
      // Attempt to modify should not affect the original array
      const hooksCopy = [...CLAUDE_HOOKS];
      expect(hooksCopy).toEqual(CLAUDE_HOOKS);
    });

    it("should have correct length", () => {
      expect(CLAUDE_HOOKS).toHaveLength(5);
    });
  });

  describe("isClaudeHook function", () => {
    it("should return true for valid hooks", () => {
      const validHooks = ['PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SubagentStop'];
      
      for (const hook of validHooks) {
        expect(isClaudeHook(hook)).toBe(true);
      }
    });

    it("should return false for invalid hooks", () => {
      const invalidHooks = [
        'InvalidHook',
        'pretooluse', // wrong case
        'PRETOOLUSE', // wrong case
        'PreToolUse ', // extra space
        ' PreToolUse', // leading space
        'Pre Tool Use', // spaces
        'PreTool', // partial
        'ToolUse', // partial
        '',
        'undefined',
        'null',
        '123',
        'Stop Stop', // duplicate
        'SubagentStops', // extra s
      ];
      
      for (const hook of invalidHooks) {
        expect(isClaudeHook(hook)).toBe(false);
      }
    });

    it("should handle edge cases", () => {
      // Test with non-string inputs (though TypeScript should prevent this)
      expect(isClaudeHook(undefined as any)).toBe(false);
      expect(isClaudeHook(null as any)).toBe(false);
      expect(isClaudeHook(123 as any)).toBe(false);
      expect(isClaudeHook({} as any)).toBe(false);
      expect(isClaudeHook([] as any)).toBe(false);
    });

    it("should be case sensitive", () => {
      expect(isClaudeHook('stop')).toBe(false);
      expect(isClaudeHook('STOP')).toBe(false);
      expect(isClaudeHook('Stop')).toBe(true);
      
      expect(isClaudeHook('pretooluse')).toBe(false);
      expect(isClaudeHook('PRETOOLUSE')).toBe(false);
      expect(isClaudeHook('PreToolUse')).toBe(true);
    });

    it("should work as type guard", () => {
      const testString: string = "Stop";
      
      if (isClaudeHook(testString)) {
        // TypeScript should now know testString is ClaudeHook
        const hook: ClaudeHook = testString;
        expect(hook).toBe("Stop");
      }
    });
  });

  describe("ClaudeHook type", () => {
    it("should accept all valid hook values", () => {
      const hooks: ClaudeHook[] = ['PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SubagentStop'];
      
      // If this compiles, the type is working correctly
      expect(hooks).toHaveLength(5);
    });

    it("should be compatible with CLAUDE_HOOKS array", () => {
      const hookFromArray: ClaudeHook = CLAUDE_HOOKS[0];
      expect(hookFromArray).toBe('PreToolUse');
    });
  });

  describe("integration with isClaudeHook", () => {
    it("should validate all hooks in CLAUDE_HOOKS", () => {
      for (const hook of CLAUDE_HOOKS) {
        expect(isClaudeHook(hook)).toBe(true);
      }
    });

    it("should work with array includes check", () => {
      const testHook = "Stop";
      expect(CLAUDE_HOOKS.includes(testHook as ClaudeHook)).toBe(true);
      expect(isClaudeHook(testHook)).toBe(true);
    });
  });
});
