import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";

// Mock pino
const mockLogger = {
  debug: mock(),
  info: mock(),
  warn: mock(),
  error: mock(),
  trace: mock(),
  fatal: mock()
};

mock.module("pino", () => ({
  default: mock(() => mockLogger)
}));

describe("Logger", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mock.restore();
  });

  afterEach(() => {
    process.env = originalEnv;
    // Clear module cache
    delete require.cache[require.resolve("../../../src/util/logger")];
  });

  test("creates logger with default info level", () => {
    delete process.env.LOG_LEVEL;
    
    const pino = require("pino").default;
    require("../../../src/util/logger");

    expect(pino).toHaveBeenCalledWith({
      level: "info"
    });
  });

  test("creates logger with environment LOG_LEVEL", () => {
    process.env.LOG_LEVEL = "debug";
    
    const pino = require("pino").default;
    require("../../../src/util/logger");

    expect(pino).toHaveBeenCalledWith({
      level: "debug"
    });
  });

  test("exports logger instance", () => {
    const logger = require("../../../src/util/logger").default;
    
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.warn).toBe("function");
  });

  test("logger methods are callable", () => {
    const logger = require("../../../src/util/logger").default;
    
    logger.info("test message");
    logger.error("error message");
    logger.debug("debug message");
    logger.warn("warning message");

    expect(mockLogger.info).toHaveBeenCalledWith("test message");
    expect(mockLogger.error).toHaveBeenCalledWith("error message");
    expect(mockLogger.debug).toHaveBeenCalledWith("debug message");
    expect(mockLogger.warn).toHaveBeenCalledWith("warning message");
  });

  test("handles different log levels", () => {
    const testCases = ["error", "warn", "info", "debug", "trace"];
    
    for (const level of testCases) {
      process.env.LOG_LEVEL = level;
      
      const pino = require("pino").default;
      delete require.cache[require.resolve("../../../src/util/logger")];
      require("../../../src/util/logger");

      expect(pino).toHaveBeenCalledWith({ level });
    }
  });

  test("handles invalid log level gracefully", () => {
    process.env.LOG_LEVEL = "invalid-level";
    
    const pino = require("pino").default;
    require("../../../src/util/logger");

    expect(pino).toHaveBeenCalledWith({
      level: "invalid-level"
    });
  });

  test("handles empty LOG_LEVEL", () => {
    process.env.LOG_LEVEL = "";
    
    const pino = require("pino").default;
    require("../../../src/util/logger");

    expect(pino).toHaveBeenCalledWith({
      level: "info"
    });
  });
});
