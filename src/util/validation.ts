import { z } from 'zod';

import logger from './logger';

/**
 * Validation error with formatted user-friendly messages
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: z.ZodError
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Format Zod validation errors into user-friendly messages
 */
export function formatValidationErrors(errors: z.ZodError): string {
  const formatted = errors.errors.map(error => {
    const path = error.path.length > 0 ? error.path.join('.') : 'input';
    return `${path}: ${error.message}`;
  });

  return formatted.join('\n');
}

/**
 * Validate input against a Zod schema with proper error handling
 */
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown, context = 'input'): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    const message = `Invalid ${context}:\n${formatValidationErrors(result.error)}`;
    logger.debug('Validation failed:', result.error);
    throw new ValidationError(message, result.error);
  }

  return result.data;
}

/**
 * Create a validation wrapper for command options
 */
export function createValidator<T>(schema: z.ZodSchema<T>, context = 'options') {
  return (input: unknown): T => validateInput(schema, input, context);
}

// Common validation schemas for reuse across commands

/**
 * URL validation schema
 */
export const UrlSchema = z
  .string()
  .url('Must be a valid URL')
  .refine(
    url => url.startsWith('http://') || url.startsWith('https://'),
    'Must use http:// or https:// protocol'
  );

/**
 * File path validation schema
 */
export const FilePathSchema = z
  .string()
  .min(1, 'File path cannot be empty')
  .refine(path => !path.includes('\0'), 'File path cannot contain null characters');

/**
 * Agent ID validation schema
 */
export const AgentIdSchema = z
  .string()
  .regex(/^[A-Z0-9-]+$/i, 'Agent ID must contain only letters, numbers, and hyphens')
  .min(1, 'Agent ID cannot be empty')
  .max(64, 'Agent ID cannot exceed 64 characters');

/**
 * User ID validation schema (ULID format)
 */
export const UserIdSchema = z
  .string()
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'User ID must be a valid ULID');

/**
 * Email validation schema
 */
export const EmailSchema = z
  .string()
  .email('Must be a valid email address')
  .max(254, 'Email address too long');

/**
 * Password validation schema
 */
export const PasswordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters long')
  .max(128, 'Password cannot exceed 128 characters');

/**
 * JSON data validation schema
 */
export const JsonDataSchema = z.union([
  z.record(z.string(), z.union([z.string(), z.number()])).refine(obj => {
    try {
      const encoded = JSON.stringify(obj);
      return Buffer.byteLength(encoded, 'utf8') <= 1024;
    } catch {
      return false;
    }
  }, 'JSON data exceeds 1024 bytes when encoded'),
  z.string().refine(s => {
    try {
      const decoded = Buffer.from(s, 'base64');
      return decoded.length <= 1024;
    } catch {
      return false;
    }
  }, 'Invalid base64 or decoded data exceeds 1024 bytes'),
]);

/**
 * Output format validation schema
 */
export const OutputFormatSchema = z.enum(['json', 'table', 'yaml'], {
  errorMap: () => ({ message: 'Format must be one of: json, table, yaml' }),
});

/**
 * Positive integer validation schema
 */
export const PositiveIntegerSchema = z
  .number()
  .int('Must be an integer')
  .nonnegative('Must be non-negative');

/**
 * Non-empty string validation schema
 */
export const NonEmptyStringSchema = z.string().min(1, 'Cannot be empty');
