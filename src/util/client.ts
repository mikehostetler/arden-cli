import { TelemetryEvent, validateEvents } from './schema';
import logger from './logger';
import { gzipSync } from 'zlib';
import env from './env';

type KyInstance = any;

export interface ClientOptions {
  host?: string | undefined;
  token?: string | undefined;
  timeout?: number | undefined;
  maxRetries?: number | undefined;
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
  private httpClient: KyInstance;

  constructor(options: ClientOptions = {}) {
    this.host = (options.host?.replace(/\/$/, '') || env.HOST) as string;
    this.token = options.token;
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
  }

  private async getHttpClient(): Promise<KyInstance> {
    if (!this.httpClient) {
      const { default: ky } = await import('ky');
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      
      this.httpClient = ky.create({
        prefixUrl: this.host,
        timeout: this.timeout,
        retry: this.maxRetries,
        headers,
      });
    }
    
    return this.httpClient;
  }

  async sendEvents(events: TelemetryEvent[]): Promise<TelemetryResponse> {
    // Validate all events first
    const validatedEvents = validateEvents(events);
    
    // Process in chunks of 100
    const chunks = this.chunkEvents(validatedEvents, 100);
    const results: TelemetryResponse[] = [];

    for (const chunk of chunks) {
      const result = await this.sendChunk(chunk);
      results.push(result);
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
    
    // Use gzip if body is large
    const shouldGzip = Buffer.byteLength(bodyString, 'utf8') > 1024 * 1024; // 1MB threshold
    
    try {
      const httpClient = await this.getHttpClient();
      const options: any = {
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
      
      logger.debug(`Making POST request to: ${this.host}/api/events`);
      const response = await httpClient.post('api/events', options).json<TelemetryResponse>();
      logger.debug(`Received response: ${JSON.stringify(response)}`);
      return response;
    } catch (error) {
      logger.error('Failed to send telemetry chunk:', error);
      throw error;
    }
  }



  private combineResults(results: TelemetryResponse[]): TelemetryResponse {
    const combined: TelemetryResponse = {
      status: 'accepted',
      accepted_count: 0,
      rejected_count: 0,
      event_ids: [],
      rejected: []
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
        combined.rejected.push(...result.rejected.map(r => ({ 
          ...r, 
          index: r.index + baseIndex 
        })));
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
  host?: string
): Promise<void> {
  try {
    const client = new Client(host ? { host } : {});
    
    const telemetryEvent: TelemetryEvent = {
      agent: data.provider,
      time: parseInt(data.timestamp, 10) || Date.now(),
      bid: 0,
      mult: 0,
      data: typeof data.payload === 'object' && data.payload !== null 
        ? data.payload as Record<string, string | number>
        : { hook: data.hook, payload: JSON.stringify(data.payload) },
    };
    
    await client.sendEvents([telemetryEvent]);
    logger.info(`[TELEMETRY] ${event} sent to ${host || env.HOST}`);
  } catch (error) {
    logger.error(`[TELEMETRY] Failed to send ${event} to ${host || env.HOST}:`, error);
  }
}

// Convenience function for creating a simple HTTP client
export async function createClient(host: string): Promise<KyInstance> {
  const { default: ky } = await import('ky');
  
  return ky.create({
    prefixUrl: host,
    timeout: 30000,
    retry: 3,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });
}
