/**
 * Security utility for sanitizing sensitive data in objects
 * Masks tokens, secrets, and other sensitive fields
 */

const SENSITIVE_KEY_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /key/i,
  /auth.*token/i, // auth_token, authToken, etc. - not standalone "auth"
  /auth.*key/i, // auth_key, authKey, etc.
  /auth.*header/i, // auth_header, authHeader, etc.
  /credential/i,
];

/**
 * Checks if a key name contains sensitive patterns
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Masks a sensitive value by showing only first and last 4 characters
 */
function maskValue(value: string): string {
  if (typeof value !== 'string' || value.length <= 8) {
    return '[REDACTED]';
  }
  const start = value.substring(0, 4);
  const end = value.substring(value.length - 4);
  const middleLength = value.length - 8; // 4 chars from start + 4 chars from end
  const middle = '*'.repeat(Math.max(0, middleLength));
  return `${start}${middle}${end}`;
}

/**
 * Deep clones an object and masks sensitive fields (internal function with circular reference tracking)
 *
 * @param obj - Object to sanitize
 * @param visited - WeakSet to track visited objects (prevents circular references)
 * @returns Deep cloned object with sensitive fields masked
 */
function sanitizeInternal(obj: unknown, visited: WeakSet<object> = new WeakSet()): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitives
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle circular references
  if (visited.has(obj)) {
    return '[CIRCULAR]';
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    visited.add(obj);
    const result = obj.map(item => sanitizeInternal(item, visited));
    visited.delete(obj);
    return result;
  }

  // Handle Date objects and other built-ins
  if (obj instanceof Date || obj instanceof RegExp || obj instanceof Error) {
    return obj;
  }

  // Handle plain objects
  visited.add(obj);
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      // Mask sensitive values
      if (typeof value === 'string') {
        sanitized[key] = maskValue(value);
      } else {
        sanitized[key] = '[REDACTED]';
      }
    } else {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeInternal(value, visited);
    }
  }

  visited.delete(obj);
  return sanitized;
}

/**
 * Deep clones an object and masks sensitive fields
 *
 * @param obj - Object to sanitize
 * @returns Deep cloned object with sensitive fields masked
 */
export function sanitize(obj: unknown): unknown {
  return sanitizeInternal(obj);
}

/**
 * Sanitizes data for JSON output
 */
export function sanitizeForJson(data: unknown): unknown {
  return sanitize(data);
}

/**
 * Sanitizes data for debug logging
 */
export function sanitizeForDebug(data: unknown): unknown {
  return sanitize(data);
}
