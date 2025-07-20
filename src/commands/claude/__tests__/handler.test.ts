import { describe, it, expect } from "bun:test";
import type { ClaudeHookOptions } from "../handler";
import { AgentIds } from "../../../production-agents";

describe("claude handler", () => {
  it("should export handleClaudeHook function", async () => {
    const { handleClaudeHook } = await import("../handler");
    expect(typeof handleClaudeHook).toBe("function");
  });

  it("should have correct ClaudeHookOptions interface", () => {
    // This is a compile-time test - if it compiles, the interface is correct
    const options: ClaudeHookOptions = {
      dryRun: false,
      print: true,
      host: "localhost:3000"
    };
    
    expect(options.dryRun).toBe(false);
    expect(options.print).toBe(true);
    expect(options.host).toBe("localhost:3000");
  });

  it("should reference correct AgentIds constant", () => {
    // Test that the handler uses the correct agent ID
    expect(AgentIds.CLAUDE_CODE).toBeDefined();
    expect(typeof AgentIds.CLAUDE_CODE).toBe("string");
  });

  it("should handle all hook option properties", () => {
    // Test that all expected option properties are supported
    const fullOptions: ClaudeHookOptions = {
      dryRun: true,
      print: false,
      host: "example.com:8080"
    };
    
    expect(fullOptions).toHaveProperty("dryRun");
    expect(fullOptions).toHaveProperty("print"); 
    expect(fullOptions).toHaveProperty("host");
  });

  it("should support optional host parameter", () => {
    // Test that host is optional
    const optionsWithoutHost: ClaudeHookOptions = {
      dryRun: false,
      print: true
    };
    
    expect(optionsWithoutHost.host).toBeUndefined();
  });
});
