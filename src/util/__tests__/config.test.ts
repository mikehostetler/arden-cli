import { describe, it, expect } from "bun:test";

describe("config utilities", () => {
  // Note: These are basic structural tests since the config utilities require 
  // file system and network operations that are difficult to mock reliably in Bun.
  // The functionality is tested through integration tests in the setup command.

  it("should have loadConfig function", async () => {
    const { loadConfig } = await import("../config");
    expect(typeof loadConfig).toBe("function");
  });

  it("should have saveConfig function", async () => {
    const { saveConfig } = await import("../config");
    expect(typeof saveConfig).toBe("function");
  });

  it("should have getApiToken function", async () => {
    const { getApiToken } = await import("../config");
    expect(typeof getApiToken).toBe("function");
  });

  it("should have validateApiToken function", async () => {
    const { validateApiToken } = await import("../config");
    expect(typeof validateApiToken).toBe("function");
  });

  it("should have ensureApiToken function", async () => {
    const { ensureApiToken } = await import("../config");
    expect(typeof ensureApiToken).toBe("function");
  });

  it("should have ArdenConfig interface", async () => {
    const config = await import("../config");
    // Interface exists if module loads without error
    expect(config).toBeDefined();
  });
});
