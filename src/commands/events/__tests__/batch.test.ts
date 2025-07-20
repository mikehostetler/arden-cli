import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Mock functions
const mockLoggerInfo = mock<(message: string) => void>();
const mockLoggerError = mock<(message: string, error?: any) => void>();
const mockLoggerWarn = mock<(message: string) => void>();
const mockConsoleLog = mock<(...args: any[]) => void>();
const mockProcessExit = mock<(code: number) => never>();
const mockValidateEvents = mock<(events: any[]) => any[]>();
const mockSendEvents = mock<(events: any[], options: any) => Promise<any>>();
const mockReadFileSync = mock<(path: string) => string | Buffer>();
const mockGunzipSync = mock<(data: Buffer) => Buffer>();

// Types for batch command
interface BatchOptions {
  file: string;
  chunk?: string;
  token?: string;
  dryRun?: boolean;
  print?: boolean;
}

interface GlobalOptions {
  host?: string;
}

interface BatchResponse {
  status: 'accepted' | 'partial' | 'rejected';
  accepted_count: number;
  rejected_count?: number;
  rejected?: Array<{ error: string; index: number }>;
  event_ids?: string[];
}

// Simplified batch logic for testing
async function batchLogic(options: BatchOptions, globalOptions: GlobalOptions) {
  try {
    // Read file
    let fileData: Buffer | string;
    if (options.file.endsWith('.gz')) {
      const compressed = mockReadFileSync(options.file) as Buffer;
      fileData = mockGunzipSync(compressed).toString('utf8');
    } else {
      fileData = mockReadFileSync(options.file) as string;
    }

    // Parse JSON
    const jsonData = JSON.parse(fileData as string);
    
    // Normalize to array
    const events = Array.isArray(jsonData) ? jsonData : [jsonData];
    
    mockLoggerInfo(`Processing ${events.length} events from ${options.file}`);

    // Validate events
    const validatedEvents = mockValidateEvents(events);
    
    // Print if requested
    if (options.print || process.env.LOG_LEVEL === 'debug') {
      mockConsoleLog(JSON.stringify(validatedEvents, null, 2));
    }

    // Exit if dry run
    if (options.dryRun) {
      mockLoggerInfo(`Dry run - ${validatedEvents.length} events validated successfully`);
      return;
    }

    // Send events
    const clientOptions = {
      host: globalOptions.host || 'default-host',
      token: options.token || process.env.ARDEN_API_TOKEN,
    };

    const response = await mockSendEvents(validatedEvents, clientOptions);
    
    if (response.status === 'accepted') {
      mockLoggerInfo(`All ${response.accepted_count} events sent successfully`);
    } else if (response.status === 'partial') {
      mockLoggerWarn(`Partial success. Accepted: ${response.accepted_count}, Rejected: ${response.rejected_count}`);
      if (response.rejected) {
        for (const error of response.rejected) {
          mockLoggerError(`Event ${error.index}: ${error.error}`);
        }
      }
    } else {
      mockLoggerError(`All events rejected. Count: ${response.rejected_count}`);
      if (response.rejected) {
        for (const error of response.rejected) {
          mockLoggerError(`Event ${error.index}: ${error.error}`);
        }
      }
    }

    // Log event IDs if available
    if (response.event_ids && response.event_ids.length > 0) {
      mockLoggerInfo(`Event IDs: ${response.event_ids.join(', ')}`);
    }

  } catch (error) {
    mockLoggerError(`Failed to process batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    mockProcessExit(1);
  }
}

describe('events batch command', () => {
  const mockEvents = [
    { agent: 'test-agent-1', user: 'user-1', bid: 100 },
    { agent: 'test-agent-2', user: 'user-2', bid: 200 }
  ];

  const mockValidatedEvents = mockEvents.map(e => ({ ...e, validated: true }));

  beforeEach(() => {
    // Clear all mocks
    mockLoggerInfo.mockClear();
    mockLoggerError.mockClear();
    mockLoggerWarn.mockClear();
    mockConsoleLog.mockClear();
    mockProcessExit.mockClear();
    mockValidateEvents.mockClear();
    mockSendEvents.mockClear();
    mockReadFileSync.mockClear();
    mockGunzipSync.mockClear();

    // Set up default mocks
    mockValidateEvents.mockReturnValue(mockValidatedEvents);
  });

  describe('successful requests', () => {
    beforeEach(() => {
      mockSendEvents.mockResolvedValue({
        status: 'accepted',
        accepted_count: 2,
        event_ids: ['event-1', 'event-2']
      });
    });

    it('should handle batch command with JSON file', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));

      await batchLogic({ file: 'events.json' }, { host: 'https://test.com' });

      expect(mockReadFileSync).toHaveBeenCalledWith('events.json');
      expect(mockLoggerInfo).toHaveBeenCalledWith('Processing 2 events from events.json');
      expect(mockValidateEvents).toHaveBeenCalledWith(mockEvents);
      expect(mockSendEvents).toHaveBeenCalledWith(mockValidatedEvents, {
        host: 'https://test.com',
        token: undefined
      });
      expect(mockLoggerInfo).toHaveBeenCalledWith('All 2 events sent successfully');
      expect(mockLoggerInfo).toHaveBeenCalledWith('Event IDs: event-1, event-2');
    });

    it('should handle gzipped files', async () => {
      const compressedData = Buffer.from('compressed');
      const uncompressedData = Buffer.from(JSON.stringify(mockEvents));
      
      mockReadFileSync.mockReturnValue(compressedData);
      mockGunzipSync.mockReturnValue(uncompressedData);

      await batchLogic({ file: 'events.json.gz' }, { host: 'https://test.com' });

      expect(mockReadFileSync).toHaveBeenCalledWith('events.json.gz');
      expect(mockGunzipSync).toHaveBeenCalledWith(compressedData);
      expect(mockValidateEvents).toHaveBeenCalledWith(mockEvents);
    });

    it('should handle single event object', async () => {
      const singleEvent = mockEvents[0];
      mockReadFileSync.mockReturnValue(JSON.stringify(singleEvent));

      await batchLogic({ file: 'single.json' }, { host: 'https://test.com' });

      expect(mockLoggerInfo).toHaveBeenCalledWith('Processing 1 events from single.json');
      expect(mockValidateEvents).toHaveBeenCalledWith([singleEvent]);
    });

    it('should handle custom token', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));

      await batchLogic({ 
        file: 'events.json', 
        token: 'custom-token' 
      }, { host: 'https://test.com' });

      expect(mockSendEvents).toHaveBeenCalledWith(mockValidatedEvents, {
        host: 'https://test.com',
        token: 'custom-token'
      });
    });

    it('should handle dry run', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));

      await batchLogic({ 
        file: 'events.json', 
        dryRun: true 
      }, { host: 'https://test.com' });

      expect(mockLoggerInfo).toHaveBeenCalledWith('Dry run - 2 events validated successfully');
      expect(mockSendEvents).not.toHaveBeenCalled();
    });

    it('should handle print option', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));

      await batchLogic({ 
        file: 'events.json', 
        print: true 
      }, { host: 'https://test.com' });

      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(mockValidatedEvents, null, 2));
    });

    it('should handle partial response', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));
      mockSendEvents.mockResolvedValue({
        status: 'partial',
        accepted_count: 1,
        rejected_count: 1,
        rejected: [{ error: 'Invalid agent', index: 1 }]
      });

      await batchLogic({ file: 'events.json' }, { host: 'https://test.com' });

      expect(mockLoggerWarn).toHaveBeenCalledWith('Partial success. Accepted: 1, Rejected: 1');
      expect(mockLoggerError).toHaveBeenCalledWith('Event 1: Invalid agent');
    });

    it('should handle rejected response', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));
      mockSendEvents.mockResolvedValue({
        status: 'rejected',
        accepted_count: 0,
        rejected_count: 2,
        rejected: [
          { error: 'Invalid agent 1', index: 0 },
          { error: 'Invalid agent 2', index: 1 }
        ]
      });

      await batchLogic({ file: 'events.json' }, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('All events rejected. Count: 2');
      expect(mockLoggerError).toHaveBeenCalledWith('Event 0: Invalid agent 1');
      expect(mockLoggerError).toHaveBeenCalledWith('Event 1: Invalid agent 2');
    });

    it('should handle missing event IDs', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));
      mockSendEvents.mockResolvedValue({
        status: 'accepted',
        accepted_count: 2
        // No event_ids field
      });

      await batchLogic({ file: 'events.json' }, { host: 'https://test.com' });

      expect(mockLoggerInfo).toHaveBeenCalledWith('All 2 events sent successfully');
      // Should not call event IDs log
      const eventIdCalls = mockLoggerInfo.mock.calls.filter(call => 
        call[0]?.toString().includes('Event IDs:')
      );
      expect(eventIdCalls.length).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle file read errors', async () => {
      const error = new Error('File not found');
      mockReadFileSync.mockImplementation(() => {
        throw error;
      });

      await batchLogic({ file: 'missing.json' }, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to process batch: File not found');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle invalid JSON', async () => {
      mockReadFileSync.mockReturnValue('invalid json');

      await batchLogic({ file: 'invalid.json' }, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith(expect.stringContaining('Failed to process batch:'));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle validation errors', async () => {
      const error = new Error('Validation failed');
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));
      mockValidateEvents.mockImplementation(() => {
        throw error;
      });

      await batchLogic({ file: 'events.json' }, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to process batch: Validation failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));
      mockSendEvents.mockRejectedValue(error);

      await batchLogic({ file: 'events.json' }, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to process batch: Network error');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle gzip decompression errors', async () => {
      const error = new Error('Decompression failed');
      mockReadFileSync.mockReturnValue(Buffer.from('compressed'));
      mockGunzipSync.mockImplementation(() => {
        throw error;
      });

      await batchLogic({ file: 'events.json.gz' }, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to process batch: Decompression failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
});
