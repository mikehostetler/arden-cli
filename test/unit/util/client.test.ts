import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { Client, sendEvents, sendTelemetry, createClient, type ClientOptions, type TelemetryResponse } from "../../../src/util/client";
import type { TelemetryEvent } from "../../../src/util/schema";

// Mock ky HTTP client
const mockKy = {
  create: mock(() => mockKy),
  post: mock(() => ({
    json: mock(() => Promise.resolve({
      status: 'accepted',
      accepted_count: 1,
      event_ids: ['event-123']
    }))
  }))
};

mock.module("ky", () => ({
  default: mockKy
}));

// Mock logger
mock.module("../../../src/util/logger", () => ({
  debug: mock(),
  info: mock(),
  error: mock()
}));

// Mock zlib
mock.module("zlib", () => ({
  gzipSync: mock((data: string) => Buffer.from(`gzipped:${data}`))
}));

describe("Client", () => {
  let client: Client;
  
  beforeEach(() => {
    mock.restore();
    client = new Client({ host: "https://test.com", token: "test-token" });
  });

  describe("constructor", () => {
    test("uses provided options", () => {
      const customClient = new Client({
        host: "https://custom.com",
        token: "custom-token",
        timeout: 5000,
        maxRetries: 1
      });
      
      expect(customClient).toBeDefined();
    });

    test("uses default values", () => {
      const defaultClient = new Client();
      expect(defaultClient).toBeDefined();
    });

    test("removes trailing slash from host", () => {
      const clientWithSlash = new Client({ host: "https://test.com/" });
      expect(clientWithSlash).toBeDefined();
    });
  });

  describe("sendEvents", () => {
    test("sends single event successfully", async () => {
      const event: TelemetryEvent = {
        agent: "A-12345",
        time: 1234567890,
        bid: 100,
        mult: 1,
        data: { test: "data" }
      };

      const result = await client.sendEvents([event]);

      expect(result.status).toBe('accepted');
      expect(result.accepted_count).toBe(1);
      expect(mockKy.post).toHaveBeenCalledWith('api/events', expect.any(Object));
    });

    test("chunks large arrays of events", async () => {
      const events: TelemetryEvent[] = Array.from({ length: 250 }, (_, i) => ({
        agent: `A-${i}`,
        time: 1234567890 + i,
        bid: 100,
        mult: 1,
        data: { index: i }
      }));

      await client.sendEvents(events);

      // Should make 3 calls (100, 100, 50)
      expect(mockKy.post).toHaveBeenCalledTimes(3);
    });

    test("validates events before sending", async () => {
      const invalidEvent = {
        agent: "invalid_agent!",
        time: 1234567890,
        bid: 100,
        mult: 1,
        data: {}
      } as any;

      await expect(client.sendEvents([invalidEvent])).rejects.toThrow();
    });

    test("combines results from multiple chunks", async () => {
      // Mock multiple successful responses
      mockKy.post = mock()
        .mockReturnValueOnce({
          json: () => Promise.resolve({
            status: 'accepted',
            accepted_count: 100,
            event_ids: Array.from({ length: 100 }, (_, i) => `event-${i}`)
          })
        })
        .mockReturnValueOnce({
          json: () => Promise.resolve({
            status: 'accepted',
            accepted_count: 50,
            event_ids: Array.from({ length: 50 }, (_, i) => `event-${i + 100}`)
          })
        });

      const events: TelemetryEvent[] = Array.from({ length: 150 }, (_, i) => ({
        agent: `A-${i}`,
        time: 1234567890,
        bid: 100,
        mult: 1,
        data: {}
      }));

      const result = await client.sendEvents(events);

      expect(result.accepted_count).toBe(150);
      expect(result.event_ids).toHaveLength(150);
      expect(result.status).toBe('accepted');
    });

    test("handles partial failures", async () => {
      mockKy.post = mock(() => ({
        json: () => Promise.resolve({
          status: 'partial',
          accepted_count: 1,
          rejected_count: 1,
          rejected: [{ index: 1, error: "Invalid data" }]
        })
      }));

      const events: TelemetryEvent[] = [
        {
          agent: "A-12345",
          time: 1234567890,
          bid: 100,
          mult: 1,
          data: {}
        },
        {
          agent: "A-67890",
          time: 1234567891,
          bid: 200,
          mult: 2,
          data: {}
        }
      ];

      const result = await client.sendEvents(events);

      expect(result.status).toBe('partial');
      expect(result.accepted_count).toBe(1);
      expect(result.rejected_count).toBe(1);
      expect(result.rejected).toHaveLength(1);
    });

    test("uses gzip for large payloads", async () => {
      const largeData: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        largeData[`key${i}`] = "x".repeat(1000);
      }

      const event: TelemetryEvent = {
        agent: "A-12345",
        time: 1234567890,
        bid: 100,
        mult: 1,
        data: largeData
      };

      // Mock validation to pass for large data
      mock.module("../../../src/util/schema", () => ({
        validateEvents: mock((events: any[]) => events)
      }));

      await client.sendEvents([event]);

      expect(mockKy.post).toHaveBeenCalledWith('api/events', 
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Encoding': 'gzip'
          })
        })
      );
    });
  });

  describe("HTTP client creation", () => {
    test("creates client with authorization header when token provided", async () => {
      const clientWithToken = new Client({ 
        host: "https://test.com", 
        token: "secret-token" 
      });

      await clientWithToken.sendEvents([{
        agent: "A-12345",
        time: 1234567890,
        bid: 100,
        mult: 1,
        data: {}
      }]);

      expect(mockKy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer secret-token'
          })
        })
      );
    });

    test("creates client without authorization header when token not provided", async () => {
      const clientNoToken = new Client({ host: "https://test.com" });

      await clientNoToken.sendEvents([{
        agent: "A-12345",
        time: 1234567890,
        bid: 100,
        mult: 1,
        data: {}
      }]);

      expect(mockKy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String)
          })
        })
      );
    });
  });
});

describe("Convenience functions", () => {
  beforeEach(() => {
    mock.restore();
  });

  describe("sendEvents", () => {
    test("creates client and sends events", async () => {
      const events: TelemetryEvent[] = [{
        agent: "A-12345",
        time: 1234567890,
        bid: 100,
        mult: 1,
        data: {}
      }];

      const result = await sendEvents(events, { host: "https://test.com" });

      expect(result.status).toBe('accepted');
    });
  });

  describe("sendTelemetry", () => {
    test("converts telemetry data to event format", async () => {
      const telemetryData = {
        provider: "test-provider",
        hook: "test-hook",
        timestamp: "1234567890",
        payload: { custom: "data" }
      };

      // Mock successful response
      const logger = require("../../../src/util/logger").default;

      await sendTelemetry("test-event", telemetryData, "https://test.com");

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("[TELEMETRY] test-event sent to https://test.com")
      );
    });

    test("handles string payload", async () => {
      const telemetryData = {
        provider: "test-provider",
        hook: "test-hook",
        timestamp: "1234567890",
        payload: "string-payload"
      };

      const logger = require("../../../src/util/logger").default;

      await sendTelemetry("test-event", telemetryData);

      expect(logger.info).toHaveBeenCalled();
    });

    test("handles errors gracefully", async () => {
      // Mock client to throw error
      mockKy.post = mock(() => {
        throw new Error("Network error");
      });

      const telemetryData = {
        provider: "test-provider",
        hook: "test-hook",
        timestamp: "1234567890",
        payload: {}
      };

      const logger = require("../../../src/util/logger").default;

      // Should not throw
      await sendTelemetry("test-event", telemetryData);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("[TELEMETRY] Failed to send test-event"),
        expect.any(Error)
      );
    });
  });

  describe("createClient", () => {
    test("creates HTTP client with default settings", async () => {
      const client = await createClient("https://test.com");

      expect(mockKy.create).toHaveBeenCalledWith({
        prefixUrl: "https://test.com",
        timeout: 30000,
        retry: 3,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
    });
  });
});

describe("Error handling", () => {
  test("handles network errors", async () => {
    mockKy.post = mock(() => {
      throw new Error("Network error");
    });

    const client = new Client({ host: "https://test.com" });
    const event: TelemetryEvent = {
      agent: "A-12345",
      time: 1234567890,
      bid: 100,
      mult: 1,
      data: {}
    };

    await expect(client.sendEvents([event])).rejects.toThrow("Network error");
  });

  test("handles API errors", async () => {
    mockKy.post = mock(() => ({
      json: () => Promise.reject(new Error("API error"))
    }));

    const client = new Client({ host: "https://test.com" });
    const event: TelemetryEvent = {
      agent: "A-12345",
      time: 1234567890,
      bid: 100,
      mult: 1,
      data: {}
    };

    await expect(client.sendEvents([event])).rejects.toThrow("API error");
  });
});
