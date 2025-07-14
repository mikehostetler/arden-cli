import { z } from 'zod';

// Agent ID regex: Case-insensitive with optional A-/a- prefix
const agentRegex = /^(?:[aA]-)?[0-9a-fA-F]{1,8}$/;

// ULID regex: Crockford base32 excluding I, L, O, U
const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/;

// Validate base64 string and check decoded length <= 1024 bytes
const base64Validator = (s: string) => {
  try {
    const decoded = Buffer.from(s, 'base64');
    return decoded.length <= 1024;
  } catch {
    return false;
  }
};

// Validate flat JSON object size <= 1024 bytes when encoded
const jsonObjectValidator = (obj: Record<string, string | number>) => {
  try {
    const encoded = JSON.stringify(obj);
    return Buffer.byteLength(encoded, 'utf8') <= 1024;
  } catch {
    return false;
  }
};

export const EventSchema = z.object({
  agent: z.string().regex(agentRegex, 'Invalid agent ID format'),
  user: z.string().regex(ulidRegex, 'Invalid ULID format').optional(),
  time: z.number().int().nonnegative(),
  bid: z.number().int().nonnegative(),
  mult: z.number().int().nonnegative(),
  data: z.union([
    z.record(z.string(), z.union([z.string(), z.number()]))
      .refine(jsonObjectValidator, 'Encoded JSON data exceeds 1024 bytes'),
    z.string().refine(base64Validator, 'Invalid base64 or decoded data exceeds 1024 bytes')
  ])
}).strict();

export type TelemetryEvent = z.infer<typeof EventSchema>;

export function validateEvent(event: any): TelemetryEvent {
  return EventSchema.parse(event);
}

export function validateEvents(events: any[]): TelemetryEvent[] {
  return events.map((event, index) => {
    try {
      return validateEvent(event);
    } catch (error) {
      throw new Error(`Event at index ${index} is invalid: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

// Helper to normalize agent ID (remove A- prefix for internal use)
export function normalizeAgentId(agentId: string): string {
  return agentId.replace(/^[aA]-/, '');
}

// Helper to build event with defaults
export function buildEvent(partial: Partial<TelemetryEvent> & { agent: string }): TelemetryEvent {
  return {
    agent: partial.agent,
    user: partial.user,
    time: partial.time ?? Date.now(),
    bid: partial.bid ?? 0,
    mult: partial.mult ?? 0,
    data: partial.data ?? {}
  };
}
