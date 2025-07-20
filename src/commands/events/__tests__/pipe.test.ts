import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Mock functions
const mockLoggerInfo = mock<(message: string) => void>();
const mockLoggerError = mock<(message: string, error?: any) => void>();
const mockLoggerWarn = mock<(message: string) => void>();
const mockConsoleLog = mock<(...args: any[]) => void>();
const mockProcessExit = mock<(code: number) => never>();
const mockValidateEvents = mock<(events: any[]) => any[]>();
const mockSendEvents = mock<(events: any[], options: any) => Promise<any>>();
const mockReadFileSync = mock<(fd: number, encoding: string) => string>();

// Types for pipe command
interface PipeOptions {
  token?: string;
  dryRun?: boolean;
  print?: boolean;
}

interface GlobalOptions {
  host?: string;
}

interface PipeResponse {
  status: 'accepted' | 'partial' | 'rejected';
  accepted_count: number;
  rejected_count?: number;
  rejected?: Array<{ error: string; index: number }>;
  event_ids?: string[];
}

// Simplified pipe logic for testing
async function pipeLogic(options: PipeOptions, globalOptions: GlobalOptions) {
  try {
    // Read from stdin
    const stdinData = mockReadFileSync(0, 'utf8');

    if (!stdinData.trim()) {
      throw new Error('No data received from stdin');
    }

    // Parse JSON
    const jsonData = JSON.parse(stdinData);

    // Normalize to array
    const events = Array.isArray(jsonData) ? jsonData : [jsonData];

    mockLoggerInfo(`Processing ${events.length} events from stdin`);

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
    mockLoggerError(`Failed to process piped events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    mockProcessExit(1);
  }
}

describe('events pipe command', () => {
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

    it('should handle pipe command with event array', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));

      await pipeLogic({}, { host: 'https://test.com' });

      expect(mockReadFileSync).toHaveBeenCalledWith(0, 'utf8');
      expect(mockLoggerInfo).toHaveBeenCalledWith('Processing 2 events from stdin');
      expect(mockValidateEvents).toHaveBeenCalledWith(mockEvents);
      expect(mockSendEvents).toHaveBeenCalledWith(mockValidatedEvents, {
        host: 'https://test.com',
        token: undefined
      });
      expect(mockLoggerInfo).toHaveBeenCalledWith('All 2 events sent successfully');
      expect(mockLoggerInfo).toHaveBeenCalledWith('Event IDs: event-1, event-2');
    });

    it('should handle single event object', async () => {
      const singleEvent = mockEvents[0];
      mockReadFileSync.mockReturnValue(JSON.stringify(singleEvent));

      await pipeLogic({}, { host: 'https://test.com' });

      expect(mockLoggerInfo).toHaveBeenCalledWith('Processing 1 events from stdin');
      expect(mockValidateEvents).toHaveBeenCalledWith([singleEvent]);
    });

    it('should handle custom token', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));

      await pipeLogic({ token: 'custom-token' }, { host: 'https://test.com' });

      expect(mockSendEvents).toHaveBeenCalledWith(mockValidatedEvents, {
        host: 'https://test.com',
        token: 'custom-token'
      });
    });

    it('should handle environment token', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));
      process.env.ARDEN_API_TOKEN = 'env-token';

      await pipeLogic({}, { host: 'https://test.com' });

      expect(mockSendEvents).toHaveBeenCalledWith(mockValidatedEvents, {
        host: 'https://test.com',
        token: 'env-token'
      });

      delete process.env.ARDEN_API_TOKEN;
    });

    it('should handle dry run', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));

      await pipeLogic({ dryRun: true }, { host: 'https://test.com' });

      expect(mockLoggerInfo).toHaveBeenCalledWith('Dry run - 2 events validated successfully');
      expect(mockSendEvents).not.toHaveBeenCalled();
    });

    it('should handle print option', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));

      await pipeLogic({ print: true }, { host: 'https://test.com' });

      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(mockValidatedEvents, null, 2));
    });

    it('should handle debug log level', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));
      process.env.LOG_LEVEL = 'debug';

      await pipeLogic({}, { host: 'https://test.com' });

      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(mockValidatedEvents, null, 2));

      delete process.env.LOG_LEVEL;
    });

    it('should handle partial response', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));
      mockSendEvents.mockResolvedValue({
        status: 'partial',
        accepted_count: 1,
        rejected_count: 1,
        rejected: [{ error: 'Invalid agent', index: 1 }]
      });

      await pipeLogic({}, { host: 'https://test.com' });

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

      await pipeLogic({}, { host: 'https://test.com' });

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

      await pipeLogic({}, { host: 'https://test.com' });

      expect(mockLoggerInfo).toHaveBeenCalledWith('All 2 events sent successfully');
      // Should not call event IDs log
      const eventIdCalls = mockLoggerInfo.mock.calls.filter(call => 
        call[0]?.toString().includes('Event IDs:')
      );
      expect(eventIdCalls.length).toBe(0);
    });

    it('should handle empty event IDs array', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));
      mockSendEvents.mockResolvedValue({
        status: 'accepted',
        accepted_count: 2,
        event_ids: []
      });

      await pipeLogic({}, { host: 'https://test.com' });

      expect(mockLoggerInfo).toHaveBeenCalledWith('All 2 events sent successfully');
      // Should not call event IDs log for empty array
      const eventIdCalls = mockLoggerInfo.mock.calls.filter(call => 
        call[0]?.toString().includes('Event IDs:')
      );
      expect(eventIdCalls.length).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle empty stdin', async () => {
      mockReadFileSync.mockReturnValue('');

      await pipeLogic({}, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to process piped events: No data received from stdin');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle whitespace-only stdin', async () => {
      mockReadFileSync.mockReturnValue('   \n\t  ');

      await pipeLogic({}, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to process piped events: No data received from stdin');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle invalid JSON', async () => {
      mockReadFileSync.mockReturnValue('invalid json');

      await pipeLogic({}, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith(expect.stringContaining('Failed to process piped events:'));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle validation errors', async () => {
      const error = new Error('Validation failed');
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));
      mockValidateEvents.mockImplementation(() => {
        throw error;
      });

      await pipeLogic({}, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to process piped events: Validation failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));
      mockSendEvents.mockRejectedValue(error);

      await pipeLogic({}, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to process piped events: Network error');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle stdin read errors', async () => {
      const error = new Error('Read error');
      mockReadFileSync.mockImplementation(() => {
        throw error;
      });

      await pipeLogic({}, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to process piped events: Read error');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
});
