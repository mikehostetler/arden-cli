import * as cliProgress from 'cli-progress';
import pMap from 'p-map';
import { gzipSync } from 'zlib';

import env from './env';
import { logger, output } from './logging';
import { TelemetryEvent, validateEvents } from './schema';
import { normalizeTimestamp } from './time';

// Host allow-list for security
const ALLOWED_HOSTS = [
  'https://ardenstats.com',
  'https://api.arden.dev',
  'https://staging.ardenstats.com',
  'http://localhost:4000',
  'https://localhost:4000',
  'http://127.0.0.1:4000',
  'https://127.0.0.1:4000',
];

function validateHost(host: string, insecure = false): void {
  const normalizedHost = host.replace(/\/$/, '');

  if (!ALLOWED_HOSTS.includes(normalizedHost)) {
    if (!insecure) {
      output.error(`Warning: Host '${host}' is not in the allow-list.`);
      output.info('Use --insecure flag to bypass this warning for development.');
      output.info('Allowed hosts:');
      ALLOWED_HOSTS.forEach(h => output.info(`  - ${h}`));
      process.exit(1);
    } else {
      output.info(`Warning: Using untrusted host '${host}' with --insecure flag.`);
    }
  }
}

// Note: ky is imported dynamically, so we use unknown for the type
// The actual typing is handled at the import site
type KyInstance = unknown;

export interface ClientOptions {
  host?: string | undefined;
  token?: string | undefined;
  timeout?: number | undefined;
  maxRetries?: number | undefined;
  insecure?: boolean | undefined;
  // Performance tuning options
  chunkSize?: number | undefined;
  maxConcurrency?: number | undefined;
  compressionThreshold?: number | undefined;
  // UI options
  showProgress?: boolean | undefined;
}

export interface TelemetryResponse {
  status: 'accepted' | 'partial' | 'rejected';
  accepted_count: number;
  rejected_count?: number;
  event_ids?: string[];
  rejected?: Array<{ index: number; error: string }>;
}

export class Client {
  private readonly host: string;
  private readonly token?: string | undefined;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly chunkSize: number;
  private readonly maxConcurrency: number;
  private readonly compressionThreshold: number;
  private readonly silent: boolean;
  private readonly showProgress: boolean;
  private httpClient: KyInstance;

  constructor(options: ClientOptions & { silent?: boolean } = {}) {
    const { getHost } = require('./settings');
    this.host = (options.host?.replace(/\/$/, '') || getHost()) as string;
    this.token = options.token;
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
    this.chunkSize = options.chunkSize || parseInt(process.env.ARDEN_CHUNK_SIZE || '100', 10);
    this.maxConcurrency =
      options.maxConcurrency || parseInt(process.env.ARDEN_MAX_CONCURRENCY || '5', 10);
    this.compressionThreshold =
      options.compressionThreshold ||
      parseInt(process.env.ARDEN_COMPRESSION_THRESHOLD || '65536', 10); // 64 KiB
    this.silent = options.silent ?? false;
    this.showProgress = options.showProgress ?? false;

    // TASK T10: Add host validation
    validateHost(this.host, options.insecure || false);
  }

  private async getHttpClient(): Promise<KyInstance> {
    if (!this.httpClient) {
      const { default: ky } = await import('ky');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      this.httpClient = ky.create({
        prefixUrl: this.host,
        timeout: this.timeout,
        retry: {
          limit: this.maxRetries,
          methods: ['get', 'post', 'put', 'delete'],
          statusCodes: [408, 413, 429, 500, 502, 503, 504],
          backoffLimit: 3000,
          delay: (attemptCount: number) =>
            0.3 * 2 ** (attemptCount - 1) * 1000 + Math.random() * 100,
        },
        headers,
      });
    }

    return this.httpClient;
  }

  async sendEvents(events: TelemetryEvent[]): Promise<TelemetryResponse> {
    // Validate all events first
    const validatedEvents = validateEvents(events);

    // Process in configurable chunks with parallel uploads
    const chunks = this.chunkEvents(validatedEvents, this.chunkSize);

    let progressBar: cliProgress.SingleBar | null = null;
    
    if (this.showProgress && !this.silent && chunks.length > 1) {
      progressBar = new cliProgress.SingleBar({
        format: 'Uploading events |{bar}| {percentage}% | {value}/{total} chunks',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
      });
      progressBar.start(chunks.length, 0);
    }

    // Use p-map for controlled parallel processing
    const results = await pMap(chunks, async (chunk, index) => {
      const result = await this.sendChunk(chunk);
      if (progressBar) {
        progressBar.increment();
      }
      return result;
    }, {
      concurrency: this.maxConcurrency,
    });

    if (progressBar) {
      progressBar.stop();
    }

    return this.combineResults(results);
  }

  private chunkEvents(events: TelemetryEvent[], size: number): TelemetryEvent[][] {
    const chunks: TelemetryEvent[][] = [];
    for (let i = 0; i < events.length; i += size) {
      chunks.push(events.slice(i, i + size));
    }
    return chunks;
  }

  private async sendChunk(events: TelemetryEvent[]): Promise<TelemetryResponse> {
    const body = events.length === 1 ? events[0] : events;
    const bodyString = JSON.stringify(body);

    // Use gzip if body exceeds configurable threshold
    const shouldGzip = Buffer.byteLength(bodyString, 'utf8') > this.compressionThreshold;

    try {
      const httpClient = await this.getHttpClient();
      const options: Record<string, unknown> = {
        json: body,
      };

      if (shouldGzip) {
        options.body = gzipSync(bodyString);
        options.headers = {
          'Content-Encoding': 'gzip',
          'Content-Type': 'application/json',
        };
        delete options.json;
      }

      if (!this.silent && !this.showProgress) {
        logger.debug(`Making POST request to: ${this.host}/api/events`);
      }
      const response = await httpClient.post('api/events', options).json<TelemetryResponse>();
      if (!this.silent && !this.showProgress) {
        logger.debug(`Received response: ${JSON.stringify(response)}`);
      }
      return response;
    } catch (error) {
      if (!this.silent) {
        logger.error('Failed to send telemetry chunk:', error);
        // Log the response body if available for debugging
        if (error && typeof error === 'object' && 'response' in error) {
          const response = (error as any).response;
          if (response && 'json' in response && typeof response.json === 'function') {
            try {
              const errorBody = await response.json();
              logger.error('Response body:', errorBody);
            } catch (e) {
              logger.error('Could not parse error response body');
            }
          }
        }
      }
      throw error;
    }
  }

  private combineResults(results: TelemetryResponse[]): TelemetryResponse {
    const combined: TelemetryResponse = {
      status: 'accepted',
      accepted_count: 0,
      rejected_count: 0,
      event_ids: [],
      rejected: [],
    };

    for (const result of results) {
      combined.accepted_count += result.accepted_count;

      if (result.rejected_count) {
        combined.rejected_count = (combined.rejected_count || 0) + result.rejected_count;
      }

      if (result.event_ids) {
        combined.event_ids = combined.event_ids || [];
        combined.event_ids.push(...result.event_ids);
      }

      if (result.rejected) {
        combined.rejected = combined.rejected || [];
        // Adjust indices for combined results
        const baseIndex = combined.rejected.length;
        combined.rejected.push(
          ...result.rejected.map(r => ({
            ...r,
            index: r.index + baseIndex,
          }))
        );
      }
    }

    // Set final status
    if (combined.rejected_count && combined.rejected_count > 0) {
      combined.status = combined.accepted_count > 0 ? 'partial' : 'rejected';
    }

    return combined;
  }
}

// Convenience function for simple usage
export async function sendEvents(
  events: TelemetryEvent[],
  options: ClientOptions = {}
): Promise<TelemetryResponse> {
  const client = new Client(options);
  return client.sendEvents(events);
}

// Simple telemetry data interface for backward compatibility
export interface TelemetryData {
  provider: string;
  hook: string;
  timestamp: string;
  payload: unknown;
}

// Convenience function for simple telemetry data (matches statsClient interface)
export async function sendTelemetry(
  event: string,
  data: TelemetryData,
  host?: string,
  silent = false,
  showProgress = false
): Promise<void> {
  try {
    const { getUserId } = await import('./settings');
    const client = new Client(host ? { host, silent, showProgress } : { silent, showProgress });

    // Send payload as JSON object (Elixir server expects :map type)
    const telemetryEvent: TelemetryEvent = {
      agent: data.provider,
      user: getUserId(), // Include user ID from settings
      time: normalizeTimestamp(data.timestamp),
      bid: 0,
      mult: 0,
      data: data.payload as Record<string, any>,
    };

    if (!silent && !showProgress) {
      logger.debug(`Built telemetry event:`, telemetryEvent);
    }

    await client.sendEvents([telemetryEvent]);
    
    if (!silent && !showProgress) {
      logger.info(`[TELEMETRY] ${event} sent to ${host || env.HOST}`);
    }
  } catch (error) {
    if (!silent && !showProgress) {
      logger.error(`[TELEMETRY] Failed to send ${event} to ${host || env.HOST}:`, error);
    }
    throw error; // Re-throw for hook handler to catch and handle appropriately
  }
}

// Enhanced convenience function for creating a simple HTTP client with auth
export async function createClient(
  host: string,
  token?: string,
  options: {
    timeout?: number;
    maxRetries?: number;
    insecure?: boolean;
  } = {}
): Promise<KyInstance> {
  const { default: ky } = await import('ky');

  // TASK T10: Add host validation
  validateHost(host, options.insecure || false);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return ky.create({
    prefixUrl: host,
    timeout: options.timeout || 30000,
    retry: {
      limit: options.maxRetries || 3,
      methods: ['get', 'post', 'put', 'delete'],
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
      backoffLimit: 3000,
      delay: (attemptCount: number) => 0.3 * 2 ** (attemptCount - 1) * 1000 + Math.random() * 100,
    },
    headers,
  });
}
