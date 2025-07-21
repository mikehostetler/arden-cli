import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { buildImportCommand } from "../import";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Mock the client module
mock.module("../../util/client", () => ({
  sendTelemetry: mock(() => Promise.resolve()),
}));

// Mock the logger module
mock.module("../../util/logger", () => ({
  default: {
    info: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
  },
}));

describe("claude import command", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Create temp directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "arden-claude-test-"));
    originalCwd = process.cwd();
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    process.chdir(originalCwd);
  });

  describe("command configuration", () => {
    it("should be configured correctly", () => {
      const command = buildImportCommand();
      expect(command.name()).toBe("import");
      expect(command.description()).toBe("Import Claude Code usage data from local JSONL files");
      
      const options = command.options.map(opt => opt.long);
      expect(options).toContain("--claude-dir");
      expect(options).toContain("--dry-run");
      expect(options).toContain("--limit");
    });

    it("should have correct default values", () => {
      const command = buildImportCommand();
      
      const claudeDirOption = command.options.find(opt => opt.long === "--claude-dir");
      expect(claudeDirOption?.defaultValue).toContain(".claude");
      
      const limitOption = command.options.find(opt => opt.long === "--limit");
      expect(limitOption?.defaultValue).toBe("100");
    });

    it("should have action handler", () => {
      const command = buildImportCommand();
      expect(command._actionHandler).toBeDefined();
    });
  });

  describe("file discovery", () => {
    it("should find JSONL files in project directories", async () => {
      // Create test directory structure
      const projectsDir = path.join(tempDir, "projects");
      const project1Dir = path.join(projectsDir, "-Users-test-project1");
      const project2Dir = path.join(projectsDir, "-Users-test-project2");
      
      fs.mkdirSync(project1Dir, { recursive: true });
      fs.mkdirSync(project2Dir, { recursive: true });
      
      // Create test JSONL files
      fs.writeFileSync(path.join(project1Dir, "session1.jsonl"), '{"type":"test"}');
      fs.writeFileSync(path.join(project2Dir, "session2.jsonl"), '{"type":"test"}');
      fs.writeFileSync(path.join(project1Dir, "not-jsonl.txt"), "ignore me");

      const { findJsonlFiles } = await import("../import");
      const files = findJsonlFiles(projectsDir);
      
      expect(files).toHaveLength(2);
      expect(files.some(f => f.includes("session1.jsonl"))).toBe(true);
      expect(files.some(f => f.includes("session2.jsonl"))).toBe(true);
      expect(files.some(f => f.includes("not-jsonl.txt"))).toBe(false);
    });

    it("should handle missing projects directory gracefully", async () => {
      const nonExistentDir = path.join(tempDir, "nonexistent");
      const { findJsonlFiles } = await import("../import");
      const files = findJsonlFiles(nonExistentDir);
      
      expect(files).toHaveLength(0);
    });
  });

  describe("project path extraction", () => {
    it("should extract project path from directory name", async () => {
      const { extractProjectPath } = await import("../import");
      
      const testFile = "/path/to/-Users-mhostetler-Source-Project-name/session.jsonl";
      const result = extractProjectPath(testFile);
      
      expect(result).toBe("Users/mhostetler/Source/Project/name");
    });

    it("should handle directory names without leading dash", async () => {
      const { extractProjectPath } = await import("../import");
      
      const testFile = "/path/to/simple-name/session.jsonl";
      const result = extractProjectPath(testFile);
      
      expect(result).toBe("simple-name");
    });
  });

  describe("event filtering", () => {
    it("should process assistant messages with usage data", async () => {
      const { shouldProcessEvent } = await import("../import");
      
      const event = {
        type: "assistant",
        message: {
          role: "assistant",
          usage: {
            input_tokens: 100,
            output_tokens: 50
          }
        }
      };
      
      expect(shouldProcessEvent(event)).toBe(true);
    });

    it("should process significant user messages", async () => {
      const { shouldProcessEvent } = await import("../import");
      
      const event = {
        type: "user",
        message: {
          content: "This is a long user message that should be processed because it's over 50 characters"
        }
      };
      
      expect(shouldProcessEvent(event)).toBe(true);
    });

    it("should skip short user messages", async () => {
      const { shouldProcessEvent } = await import("../import");
      
      const event = {
        type: "user",
        message: {
          content: "Short"
        }
      };
      
      expect(shouldProcessEvent(event)).toBe(false);
    });

    it("should skip assistant messages without usage", async () => {
      const { shouldProcessEvent } = await import("../import");
      
      const event = {
        type: "assistant",
        message: {
          role: "assistant"
        }
      };
      
      expect(shouldProcessEvent(event)).toBe(false);
    });

    it("should skip meta user messages", async () => {
      const { shouldProcessEvent } = await import("../import");
      
      const event = {
        type: "user",
        message: {
          content: "This message has isMeta flag and should be skipped"
        }
      };
      
      expect(shouldProcessEvent(event)).toBe(false);
    });
  });

  describe("event transformation", () => {
    it("should transform Claude event to Arden event correctly", async () => {
      const { transformToArdenEvent } = await import("../import");
      
      const claudeEvent = {
        type: "assistant",
        timestamp: "2024-01-01T12:00:00Z",
        version: "1.0.0",
        userType: "pro",
        cwd: "/workspace",
        message: {
          role: "assistant",
          model: "claude-3-sonnet",
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation_input_tokens: 10
          }
        }
      };

      const result = transformToArdenEvent(claudeEvent, "Users/test/project", "session123");
      
      expect(result.sessionId).toBe("session123");
      expect(result.projectPath).toBe("Users/test/project");
      expect(result.timestamp).toBe("2024-01-01T12:00:00Z");
      expect(result.event.type).toBe("assistant");
      expect(result.event.model).toBe("claude-3-sonnet");
      expect(result.event.usage).toEqual({
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 10
      });
      expect(result.event.estimatedCostMicroCents).toBeGreaterThan(0);
    });

    it("should handle events without usage data", async () => {
      const { transformToArdenEvent } = await import("../import");
      
      const claudeEvent = {
        type: "user",
        message: {
          role: "user"
        }
      };

      const result = transformToArdenEvent(claudeEvent, "Users/test/project", "session123");
      
      expect(result.event.usage).toBeUndefined();
      expect(result.event.estimatedCostMicroCents).toBeUndefined();
    });

    it("should calculate cost estimation correctly", async () => {
      const { transformToArdenEvent } = await import("../import");
      
      const claudeEvent = {
        type: "assistant",
        message: {
          usage: {
            input_tokens: 1000,    // 1000 * 0.3 = 300 micro-cents
            output_tokens: 500,    // 500 * 1.5 = 750 micro-cents  
            cache_creation_input_tokens: 100  // 100 * 0.3 = 30 micro-cents
          }
        }
      };

      const result = transformToArdenEvent(claudeEvent, "Users/test/project", "session123");
      
      // Total: 300 + 750 + 30 = 1080 micro-cents
      expect(result.event.estimatedCostMicroCents).toBe(1080);
    });
  });
});
