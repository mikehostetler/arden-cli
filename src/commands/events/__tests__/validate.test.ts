import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Mock functions
const mockLoggerInfo = mock<(message: string) => void>();
const mockLoggerError = mock<(message: string, error?: any) => void>();
const mockConsoleLog = mock<(...args: any[]) => void>();
const mockProcessExit = mock<(code: number) => never>();
const mockValidateEvents = mock<(events: any[]) => any[]>();
const mockReadFileSync = mock<(path: string | number, encoding?: string) => string | Buffer>();
const mockGunzipSync = mock<(data: Buffer) => Buffer>();

// Types for validate command
interface ValidateOptions {
  file?: string;
  print?: boolean;
}

interface ValidatedEvent {
  agent: string;
  user?: string;
  bid: number;
  [key: string]: any;
}

// Simplified validate logic for testing
async function validateLogic(options: ValidateOptions) {
  try {
    let jsonData: any;

    if (options.file) {
      if (options.file === '-') {
        // Read from stdin
        const stdinData = mockReadFileSync(0, 'utf8') as string;
        if (!stdinData.trim()) {
          throw new Error('No data received from stdin');
        }
        jsonData = JSON.parse(stdinData);
      } else {
        // Read from file
        let fileData: Buffer | string;
        if (options.file.endsWith('.gz')) {
          const compressed = mockReadFileSync(options.file) as Buffer;
          fileData = mockGunzipSync(compressed).toString('utf8');
        } else {
          fileData = mockReadFileSync(options.file, 'utf8') as string;
        }
        jsonData = JSON.parse(fileData);
      }
    } else {
      // Read from stdin by default
      const stdinData = mockReadFileSync(0, 'utf8') as string;
      if (!stdinData.trim()) {
        throw new Error('No data provided. Use --file <path> or pipe JSON to stdin');
      }
      jsonData = JSON.parse(stdinData);
    }

    // Normalize to array
    const events = Array.isArray(jsonData) ? jsonData : [jsonData];
    
    mockLoggerInfo(`Validating ${events.length} events...`);

    // Validate events
    const validatedEvents = mockValidateEvents(events) as ValidatedEvent[];
    
    // Print if requested
    if (options.print) {
      mockConsoleLog(JSON.stringify(validatedEvents, null, 2));
    }

    mockLoggerInfo(`✓ All ${validatedEvents.length} events are valid`);
    
    // Summary
    const summary = validatedEvents.reduce((acc, event) => {
      acc.agents.add(event.agent);
      if (event.user) acc.users.add(event.user);
      acc.totalBid += event.bid;
      return acc;
    }, { agents: new Set(), users: new Set(), totalBid: 0 });

    mockLoggerInfo(`Summary: ${summary.agents.size} agents, ${summary.users.size} users, ${summary.totalBid} total bid`);

  } catch (error) {
    mockLoggerError(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    mockProcessExit(1);
  }
}

describe('events validate command', () => {
  const mockEvents = [
    { agent: 'test-agent-1', user: 'user-1', bid: 100 },
    { agent: 'test-agent-2', user: 'user-2', bid: 200 },
    { agent: 'test-agent-1', bid: 50 } // No user
  ];

  const mockValidatedEvents = mockEvents.map(e => ({ ...e, validated: true }));

  beforeEach(() => {
    // Clear all mocks
    mockLoggerInfo.mockClear();
    mockLoggerError.mockClear();
    mockConsoleLog.mockClear();
    mockProcessExit.mockClear();
    mockValidateEvents.mockClear();
    mockReadFileSync.mockClear();
    mockGunzipSync.mockClear();

    // Set up default mocks
    mockValidateEvents.mockReturnValue(mockValidatedEvents);
  });

  describe('successful validation', () => {
    it('should handle validation from file', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));

      await validateLogic({ file: 'events.json' });

      expect(mockReadFileSync).toHaveBeenCalledWith('events.json', 'utf8');
      expect(mockLoggerInfo).toHaveBeenCalledWith('Validating 3 events...');
      expect(mockValidateEvents).toHaveBeenCalledWith(mockEvents);
      expect(mockLoggerInfo).toHaveBeenCalledWith('✓ All 3 events are valid');
      expect(mockLoggerInfo).toHaveBeenCalledWith('Summary: 2 agents, 2 users, 350 total bid');
    });

    it('should handle validation from stdin with file flag', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));

      await validateLogic({ file: '-' });

      expect(mockReadFileSync).toHaveBeenCalledWith(0, 'utf8');
      expect(mockValidateEvents).toHaveBeenCalledWith(mockEvents);
    });

    it('should handle validation from stdin by default', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));

      await validateLogic({});

      expect(mockReadFileSync).toHaveBeenCalledWith(0, 'utf8');
      expect(mockValidateEvents).toHaveBeenCalledWith(mockEvents);
    });

    it('should handle gzipped files', async () => {
      const compressedData = Buffer.from('compressed');
      const uncompressedData = Buffer.from(JSON.stringify(mockEvents));
      
      mockReadFileSync.mockReturnValue(compressedData);
      mockGunzipSync.mockReturnValue(uncompressedData);

      await validateLogic({ file: 'events.json.gz' });

      expect(mockReadFileSync).toHaveBeenCalledWith('events.json.gz');
      expect(mockGunzipSync).toHaveBeenCalledWith(compressedData);
      expect(mockValidateEvents).toHaveBeenCalledWith(mockEvents);
    });

    it('should handle single event object', async () => {
      const singleEvent = mockEvents[0];
      mockReadFileSync.mockReturnValue(JSON.stringify(singleEvent));

      await validateLogic({ file: 'single.json' });

      expect(mockLoggerInfo).toHaveBeenCalledWith('Validating 1 events...');
      expect(mockValidateEvents).toHaveBeenCalledWith([singleEvent]);
    });

    it('should handle print option', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));

      await validateLogic({ file: 'events.json', print: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(mockValidatedEvents, null, 2));
    });

    it('should calculate summary correctly', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));

      await validateLogic({ file: 'events.json' });

      // 2 unique agents (test-agent-1, test-agent-2)
      // 2 unique users (user-1, user-2) - third event has no user
      // Total bid: 100 + 200 + 50 = 350
      expect(mockLoggerInfo).toHaveBeenCalledWith('Summary: 2 agents, 2 users, 350 total bid');
    });

    it('should handle events with no users', async () => {
      const eventsWithoutUsers = [
        { agent: 'test-agent-1', bid: 100 },
        { agent: 'test-agent-2', bid: 200 }
      ];
      mockReadFileSync.mockReturnValue(JSON.stringify(eventsWithoutUsers));
      mockValidateEvents.mockReturnValue(eventsWithoutUsers);

      await validateLogic({ file: 'events.json' });

      expect(mockLoggerInfo).toHaveBeenCalledWith('Summary: 2 agents, 0 users, 300 total bid');
    });

    it('should handle duplicate agents and users correctly', async () => {
      const duplicateEvents = [
        { agent: 'agent-1', user: 'user-1', bid: 100 },
        { agent: 'agent-1', user: 'user-1', bid: 200 },
        { agent: 'agent-1', user: 'user-2', bid: 50 }
      ];
      mockReadFileSync.mockReturnValue(JSON.stringify(duplicateEvents));
      mockValidateEvents.mockReturnValue(duplicateEvents);

      await validateLogic({ file: 'events.json' });

      // 1 unique agent, 2 unique users
      expect(mockLoggerInfo).toHaveBeenCalledWith('Summary: 1 agents, 2 users, 350 total bid');
    });
  });

  describe('error handling', () => {
    it('should handle empty stdin with file flag', async () => {
      mockReadFileSync.mockReturnValue('');

      await validateLogic({ file: '-' });

      expect(mockLoggerError).toHaveBeenCalledWith('Validation failed: No data received from stdin');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle empty stdin by default', async () => {
      mockReadFileSync.mockReturnValue('');

      await validateLogic({});

      expect(mockLoggerError).toHaveBeenCalledWith('Validation failed: No data provided. Use --file <path> or pipe JSON to stdin');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle whitespace-only stdin', async () => {
      mockReadFileSync.mockReturnValue('   \n\t  ');

      await validateLogic({ file: '-' });

      expect(mockLoggerError).toHaveBeenCalledWith('Validation failed: No data received from stdin');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle file read errors', async () => {
      const error = new Error('File not found');
      mockReadFileSync.mockImplementation(() => {
        throw error;
      });

      await validateLogic({ file: 'missing.json' });

      expect(mockLoggerError).toHaveBeenCalledWith('Validation failed: File not found');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle invalid JSON', async () => {
      mockReadFileSync.mockReturnValue('invalid json');

      await validateLogic({ file: 'invalid.json' });

      expect(mockLoggerError).toHaveBeenCalledWith(expect.stringContaining('Validation failed:'));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle validation errors', async () => {
      const error = new Error('Invalid event schema');
      mockReadFileSync.mockReturnValue(JSON.stringify(mockEvents));
      mockValidateEvents.mockImplementation(() => {
        throw error;
      });

      await validateLogic({ file: 'events.json' });

      expect(mockLoggerError).toHaveBeenCalledWith('Validation failed: Invalid event schema');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle gzip decompression errors', async () => {
      const error = new Error('Decompression failed');
      mockReadFileSync.mockReturnValue(Buffer.from('compressed'));
      mockGunzipSync.mockImplementation(() => {
        throw error;
      });

      await validateLogic({ file: 'events.json.gz' });

      expect(mockLoggerError).toHaveBeenCalledWith('Validation failed: Decompression failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle JSON parse errors from gzipped file', async () => {
      const compressedData = Buffer.from('compressed');
      const invalidJson = Buffer.from('invalid json');
      
      mockReadFileSync.mockReturnValue(compressedData);
      mockGunzipSync.mockReturnValue(invalidJson);

      await validateLogic({ file: 'events.json.gz' });

      expect(mockLoggerError).toHaveBeenCalledWith(expect.stringContaining('Validation failed:'));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle unknown error types', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw 'String error'; // Non-Error object
      });

      await validateLogic({ file: 'events.json' });

      expect(mockLoggerError).toHaveBeenCalledWith('Validation failed: Unknown error');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
});
