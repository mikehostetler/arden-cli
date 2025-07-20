import { describe, test, expect, beforeEach } from "bun:test";
import {
  validateEvent,
  validateEvents,
  normalizeAgentId,
  buildEvent,
  EventSchema,
  type TelemetryEvent
} from "../../../src/util/schema";

describe("Schema Validation", () => {
  describe("validateEvent", () => {
    test("validates valid event with all fields", () => {
      const validEvent = {
        agent: "A-12345",
        user: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        time: 1234567890,
        bid: 100,
        mult: 2,
        data: { key: "value", count: 42 }
      };

      const result = validateEvent(validEvent);
      expect(result).toEqual(validEvent);
    });

    test("validates valid event with required fields only", () => {
      const validEvent = {
        agent: "A-12345",
        time: 1234567890,
        bid: 100,
        mult: 2,
        data: {}
      };

      const result = validateEvent(validEvent);
      expect(result).toEqual(validEvent);
    });

    test("validates event with base64 data", () => {
      const validEvent = {
        agent: "TEST-123",
        time: 1234567890,
        bid: 100,
        mult: 1,
        data: Buffer.from("test data").toString("base64")
      };

      const result = validateEvent(validEvent);
      expect(result).toEqual(validEvent);
    });

    test("rejects invalid agent ID format", () => {
      const invalidEvent = {
        agent: "invalid_agent!",
        time: 1234567890,
        bid: 100,
        mult: 1,
        data: {}
      };

      expect(() => validateEvent(invalidEvent)).toThrow("Invalid agent ID format");
    });

    test("rejects invalid ULID format", () => {
      const invalidEvent = {
        agent: "A-12345",
        user: "invalid-ulid",
        time: 1234567890,
        bid: 100,
        mult: 1,
        data: {}
      };

      expect(() => validateEvent(invalidEvent)).toThrow("Invalid ULID format");
    });

    test("rejects negative numbers", () => {
      const invalidEvent = {
        agent: "A-12345",
        time: -1,
        bid: 100,
        mult: 1,
        data: {}
      };

      expect(() => validateEvent(invalidEvent)).toThrow();
    });

    test("rejects large JSON data objects", () => {
      const largeData: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        largeData[`key${i}`] = "x".repeat(20);
      }

      const invalidEvent = {
        agent: "A-12345",
        time: 1234567890,
        bid: 100,
        mult: 1,
        data: largeData
      };

      expect(() => validateEvent(invalidEvent)).toThrow("Encoded JSON data exceeds 1024 bytes");
    });

    test("rejects large base64 data", () => {
      const largeData = Buffer.from("x".repeat(2000)).toString("base64");
      
      const invalidEvent = {
        agent: "A-12345",
        time: 1234567890,
        bid: 100,
        mult: 1,
        data: largeData
      };

      expect(() => validateEvent(invalidEvent)).toThrow("Invalid base64 or decoded data exceeds 1024 bytes");
    });

    test("rejects invalid base64 data", () => {
      const invalidEvent = {
        agent: "A-12345",
        time: 1234567890,
        bid: 100,
        mult: 1,
        data: "invalid-base64!"
      };

      expect(() => validateEvent(invalidEvent)).toThrow("Invalid base64 or decoded data exceeds 1024 bytes");
    });

    test("rejects extra fields in strict mode", () => {
      const invalidEvent = {
        agent: "A-12345",
        time: 1234567890,
        bid: 100,
        mult: 1,
        data: {},
        extraField: "not allowed"
      };

      expect(() => validateEvent(invalidEvent)).toThrow();
    });
  });

  describe("validateEvents", () => {
    test("validates array of valid events", () => {
      const events = [
        {
          agent: "A-12345",
          time: 1234567890,
          bid: 100,
          mult: 1,
          data: {}
        },
        {
          agent: "B-67890",
          time: 1234567891,
          bid: 200,
          mult: 2,
          data: { test: "data" }
        }
      ];

      const result = validateEvents(events);
      expect(result).toEqual(events);
    });

    test("throws error with index for invalid event in array", () => {
      const events = [
        {
          agent: "A-12345",
          time: 1234567890,
          bid: 100,
          mult: 1,
          data: {}
        },
        {
          agent: "invalid_agent!",
          time: 1234567891,
          bid: 200,
          mult: 2,
          data: {}
        }
      ];

      expect(() => validateEvents(events)).toThrow("Event at index 1 is invalid");
    });

    test("validates empty array", () => {
      const result = validateEvents([]);
      expect(result).toEqual([]);
    });
  });

  describe("normalizeAgentId", () => {
    test("removes A- prefix", () => {
      expect(normalizeAgentId("A-12345")).toBe("12345");
    });

    test("removes a- prefix (case insensitive)", () => {
      expect(normalizeAgentId("a-12345")).toBe("12345");
    });

    test("leaves agent ID without prefix unchanged", () => {
      expect(normalizeAgentId("12345")).toBe("12345");
    });

    test("only removes prefix at start", () => {
      expect(normalizeAgentId("test-A-12345")).toBe("test-A-12345");
    });
  });

  describe("buildEvent", () => {
    test("builds event with defaults", () => {
      const partial = { agent: "A-12345" };
      const result = buildEvent(partial);

      expect(result.agent).toBe("A-12345");
      expect(result.bid).toBe(0);
      expect(result.mult).toBe(0);
      expect(result.data).toEqual({});
      expect(typeof result.time).toBe("number");
      expect(result.time).toBeGreaterThan(0);
    });

    test("preserves provided values", () => {
      const partial = {
        agent: "A-12345",
        user: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        time: 1234567890,
        bid: 100,
        mult: 2,
        data: { custom: "data" }
      };

      const result = buildEvent(partial);
      expect(result).toEqual(partial);
    });

    test("mixes defaults with provided values", () => {
      const partial = {
        agent: "A-12345",
        bid: 50
      };

      const result = buildEvent(partial);
      expect(result.agent).toBe("A-12345");
      expect(result.bid).toBe(50);
      expect(result.mult).toBe(0);
      expect(result.data).toEqual({});
    });
  });

  describe("Edge cases", () => {
    test("validates minimum valid ULID", () => {
      const event = {
        agent: "A-1",
        user: "00000000000000000000000000",
        time: 0,
        bid: 0,
        mult: 0,
        data: {}
      };

      expect(() => validateEvent(event)).not.toThrow();
    });

    test("validates maximum valid ULID", () => {
      const event = {
        agent: "A-1",
        user: "7ZZZZZZZZZZZZZZZZZZZZZZZZZ",
        time: 0,
        bid: 0,
        mult: 0,
        data: {}
      };

      expect(() => validateEvent(event)).not.toThrow();
    });

    test("rejects ULID with invalid characters", () => {
      const event = {
        agent: "A-1",
        user: "01ARZ3NDEKTSV4RRFFQ69G5FAI", // 'I' is invalid in ULID
        time: 0,
        bid: 0,
        mult: 0,
        data: {}
      };

      expect(() => validateEvent(event)).toThrow("Invalid ULID format");
    });

    test("handles JSON data at exactly 1024 bytes", () => {
      // Create JSON that's exactly 1024 bytes
      const key = "a".repeat(1018); // 1018 + 6 chars for {"":""}
      const data = { [key]: "" };
      
      const event = {
        agent: "A-1",
        time: 0,
        bid: 0,
        mult: 0,
        data
      };

      expect(() => validateEvent(event)).not.toThrow();
    });
  });
});
