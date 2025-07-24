/**
 * Centralized time utilities for the Arden CLI.
 * Consolidates all date/time formatting and conversion functions.
 */

/**
 * Format a Date object as a localized date string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

/**
 * Format a Date object as an ISO string
 */
export function formatDateISO(date: Date): string {
  return date.toISOString();
}

/**
 * Get current timestamp in milliseconds
 */
export function getCurrentTimestamp(): number {
  return Date.now();
}

/**
 * Get current timestamp as ISO string
 */
export function getCurrentDateISO(): string {
  return new Date().toISOString();
}

/**
 * Convert a timestamp (string or number) to milliseconds
 */
export function normalizeTimestamp(timestamp: string | number | undefined): number {
  if (timestamp === undefined) {
    return getCurrentTimestamp();
  }

  if (typeof timestamp === 'string') {
    // Try to parse as ISO date string first
    const dateFromString = new Date(timestamp);
    if (!isNaN(dateFromString.getTime())) {
      return dateFromString.getTime();
    }

    // Fallback to parseInt for numeric strings
    const parsed = parseInt(timestamp, 10);
    return isNaN(parsed) ? getCurrentTimestamp() : parsed;
  }

  return timestamp;
}

/**
 * Format bytes into human-readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format a date range from oldest to newest date
 */
export function formatDateRange(oldestDate: Date, newestDate: Date): string {
  return `${formatDate(oldestDate)} to ${formatDate(newestDate)}`;
}

/**
 * Parse a date string or timestamp into a Date object
 */
export function parseDate(input: string | number | Date): Date {
  if (input instanceof Date) {
    return input;
  }

  if (typeof input === 'number') {
    return new Date(input);
  }

  return new Date(input);
}
