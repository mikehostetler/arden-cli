import { describe, test, expect, beforeEach, afterEach } from "bun:test";

describe("Environment Configuration", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    // Clear module cache to force re-evaluation
    delete require.cache[require.resolve("../../../src/util/env")];
  });

  test("uses default values when environment variables are not set", () => {
    delete process.env.LOG_LEVEL;
    delete process.env.NODE_ENV;
    delete process.env.ARDEN_API_TOKEN;
    delete process.env.ARDEN_USER_ID;
    delete process.env.HOST;

    const env = require("../../../src/util/env").default;

    expect(env.LOG_LEVEL).toBe("info");
    expect(env.NODE_ENV).toBe("development");
    expect(env.ARDEN_API_TOKEN).toBe("");
    expect(env.ARDEN_USER_ID).toBe("");
    expect(env.HOST).toBe("https://ardenstats.com");
  });

  test("uses environment variables when set", () => {
    process.env.LOG_LEVEL = "debug";
    process.env.NODE_ENV = "production";
    process.env.ARDEN_API_TOKEN = "test-token-123";
    process.env.ARDEN_USER_ID = "user-456";
    process.env.HOST = "https://custom.host.com";

    const env = require("../../../src/util/env").default;

    expect(env.LOG_LEVEL).toBe("debug");
    expect(env.NODE_ENV).toBe("production");
    expect(env.ARDEN_API_TOKEN).toBe("test-token-123");
    expect(env.ARDEN_USER_ID).toBe("user-456");
    expect(env.HOST).toBe("https://custom.host.com");
  });

  test("handles empty string environment variables", () => {
    process.env.LOG_LEVEL = "";
    process.env.NODE_ENV = "";
    process.env.ARDEN_API_TOKEN = "";
    process.env.ARDEN_USER_ID = "";
    process.env.HOST = "";

    const env = require("../../../src/util/env").default;

    expect(env.LOG_LEVEL).toBe("info");
    expect(env.NODE_ENV).toBe("development");
    expect(env.ARDEN_API_TOKEN).toBe("");
    expect(env.ARDEN_USER_ID).toBe("");
    expect(env.HOST).toBe("https://ardenstats.com");
  });

  test("debug mode logging behavior", () => {
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args: any[]) => logs.push(args.join(" "));
    
    process.env.LOG_LEVEL = "debug";
    process.env.ARDEN_API_TOKEN = "secret-token";
    process.env.ARDEN_USER_ID = "test-user";

    const env = require("../../../src/util/env").default;

    expect(logs).toContain("Current environment variables:");
    expect(logs).toContain("  LOG_LEVEL: debug");
    expect(logs).toContain("  ARDEN_API_TOKEN: [SET]");
    expect(logs).toContain("  ARDEN_USER_ID: [SET]");

    console.log = originalLog;
  });

  test("non-debug mode does not log", () => {
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args: any[]) => logs.push(args.join(" "));
    
    process.env.LOG_LEVEL = "info";

    const env = require("../../../src/util/env").default;

    expect(logs.length).toBe(0);

    console.log = originalLog;
  });
});
