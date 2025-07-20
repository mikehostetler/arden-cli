import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Mock functions
const mockLoggerInfo = mock<(message: string) => void>();
const mockLoggerError = mock<(message: string, error?: any) => void>();
const mockLoggerDebug = mock<(message: string) => void>();
const mockLoggerWarn = mock<(message: string) => void>();
const mockConsoleLog = mock<(...args: any[]) => void>();
const mockProcessExit = mock<(code: number) => never>();
const mockBuildEvent = mock<(data: any) => any>();
const mockValidateEvent = mock<(event: any) => any>();
const mockSendEvents = mock<(events: any[], options: any) => Promise<any>>();
const mockGetUserId = mock<(userId?: string) => string | undefined>();
const mockGetApiToken = mock<(token?: string) => string | undefined>();

// Mock file reading
const mockReadFileSync = mock<(path: any, encoding?: any) => string>();

// Types for send command
interface SendOptions {
  agent?: string;
  user?: string;
  bid?: string;
  mult?: string;
  time?: string;
  data?: string;
  token?: string;
  dryRun?: boolean;
  print?: boolean;
}

interface GlobalOptions {
  host?: string;
}

interface SendResponse {
  status: 'accepted' | 'partial' | 'rejected';
  accepted_count: number;
  rejected_count?: number;
  rejected?: Array<{ error: string; index?: number }>;
}

// Simplified send logic for testing
async function sendLogic(options: SendOptions, globalOptions: GlobalOptions, remainingArgs: string[] = []) {
  try {
    mockLoggerDebug(`Command options: ${JSON.stringify(options, null, 2)}`);
    mockLoggerDebug(`Global host option: ${globalOptions.host}`);

    // Parse remaining arguments as key=value pairs
    const keyValueData: Record<string, string | number> = {};
    
    for (const arg of remainingArgs) {
      const [key, ...valueParts] = arg.split('=');
      if (valueParts.length === 0) {
        throw new Error(`Invalid key=value pair: ${arg}`);
      }
      
      const value = valueParts.join('=');
      const numValue = Number(value);
      keyValueData[key] = !isNaN(numValue) && value !== '' ? numValue : value;
    }

    // Validate required agent
    if (!options.agent) {
      throw new Error('--agent is required');
    }

    // Parse data option
    let dataPayload: any = {};
    if (options.data) {
      if (options.data === '-') {
        const stdinData = mockReadFileSync(0, 'utf8');
        dataPayload = JSON.parse(stdinData);
      } else if (options.data.startsWith('@')) {
        const filename = options.data.slice(1);
        const fileData = mockReadFileSync(filename, 'utf8');
        dataPayload = JSON.parse(fileData);
      } else {
        dataPayload = JSON.parse(options.data);
      }
    }

    // Merge key=value pairs into data
    const finalData = { ...dataPayload, ...keyValueData };

    // Get user ID
    const userId = mockGetUserId(options.user);

    // Build event with defaults
    const event = mockBuildEvent({
      agent: options.agent,
      user: userId,
      time: options.time ? parseInt(options.time) : undefined,
      bid: parseInt(options.bid || '0'),
      mult: parseInt(options.mult || '0'),
      data: finalData
    });

    // Validate event
    const validatedEvent = mockValidateEvent(event);

    // Print if requested
    if (options.print || process.env.LOG_LEVEL === 'debug') {
      mockConsoleLog(JSON.stringify(validatedEvent, null, 2));
    }

    // Exit if dry run
    if (options.dryRun) {
      mockLoggerInfo('Dry run - event validated successfully');
      return;
    }

    // Send event
    const clientOptions = {
      host: globalOptions.host || 'default-host',
      token: mockGetApiToken(options.token),
    };

    mockLoggerDebug(`Sending event with client options: ${JSON.stringify(clientOptions)}`);
    const response = await mockSendEvents([validatedEvent], clientOptions);
    mockLoggerDebug(`Response: ${JSON.stringify(response)}`);
    
    if (response.status === 'accepted') {
      mockConsoleLog(`✓ Event sent successfully`);
    } else if (response.status === 'partial') {
      mockLoggerWarn(`Event partially processed. Accepted: ${response.accepted_count}, Rejected: ${response.rejected_count}`);
      if (response.rejected) {
        for (const error of response.rejected) {
          mockLoggerError(`Error: ${error.error}`);
        }
      }
    } else {
      mockLoggerError('Event rejected');
      if (response.rejected) {
        for (const error of response.rejected) {
          mockLoggerError(`Error: ${error.error}`);
        }
      }
    }

  } catch (error) {
    mockLoggerError(`Failed to send event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    mockProcessExit(1);
  }
}

describe('events send command', () => {
  const mockEvent = {
    agent: 'test-agent',
    user: 'user-123',
    time: 1642781234567,
    bid: 1000,
    mult: 1,
    data: { key: 'value' }
  };

  const mockValidatedEvent = { ...mockEvent, validated: true };

  beforeEach(() => {
    // Clear all mocks
    mockLoggerInfo.mockClear();
    mockLoggerError.mockClear();
    mockLoggerDebug.mockClear();
    mockLoggerWarn.mockClear();
    mockConsoleLog.mockClear();
    mockProcessExit.mockClear();
    mockBuildEvent.mockClear();
    mockValidateEvent.mockClear();
    mockSendEvents.mockClear();
    mockGetUserId.mockClear();
    mockGetApiToken.mockClear();
    mockReadFileSync.mockClear();

    // Set up default mocks
    mockBuildEvent.mockReturnValue(mockEvent);
    mockValidateEvent.mockReturnValue(mockValidatedEvent);
    mockGetUserId.mockReturnValue('user-123');
    mockGetApiToken.mockReturnValue('token-123');
  });

  describe('successful requests', () => {
    beforeEach(() => {
      mockSendEvents.mockResolvedValue({
        status: 'accepted',
        accepted_count: 1
      });
    });

    it('should handle send command with basic options', async () => {
      await sendLogic({ agent: 'test-agent' }, { host: 'https://test.com' });

      expect(mockBuildEvent).toHaveBeenCalledWith({
        agent: 'test-agent',
        user: 'user-123',
        time: undefined,
        bid: 0,
        mult: 0,
        data: {}
      });
      expect(mockValidateEvent).toHaveBeenCalledWith(mockEvent);
      expect(mockSendEvents).toHaveBeenCalledWith([mockValidatedEvent], {
        host: 'https://test.com',
        token: 'token-123'
      });
      expect(mockConsoleLog).toHaveBeenCalledWith('✓ Event sent successfully');
    });

    it('should handle all command options', async () => {
      const options = {
        agent: 'test-agent',
        user: 'custom-user',
        bid: '2000',
        mult: '2',
        time: '1642781234567',
        data: '{"custom": "data"}',
        token: 'custom-token'
      };

      await sendLogic(options, { host: 'https://test.com' });

      expect(mockBuildEvent).toHaveBeenCalledWith({
        agent: 'test-agent',
        user: 'user-123', // From mockGetUserId
        time: 1642781234567,
        bid: 2000,
        mult: 2,
        data: { custom: 'data' }
      });
      expect(mockGetUserId).toHaveBeenCalledWith('custom-user');
      expect(mockGetApiToken).toHaveBeenCalledWith('custom-token');
    });

    it('should handle key=value arguments', async () => {
      const remainingArgs = ['key1=value1', 'key2=123', 'key3=hello=world'];

      await sendLogic({ agent: 'test-agent' }, { host: 'https://test.com' }, remainingArgs);

      expect(mockBuildEvent).toHaveBeenCalledWith({
        agent: 'test-agent',
        user: 'user-123',
        time: undefined,
        bid: 0,
        mult: 0,
        data: {
          key1: 'value1',
          key2: 123,
          key3: 'hello=world'
        }
      });
    });

    it('should handle stdin data input', async () => {
      mockReadFileSync.mockReturnValue('{"stdin": "data"}');

      await sendLogic({ agent: 'test-agent', data: '-' }, { host: 'https://test.com' });

      expect(mockReadFileSync).toHaveBeenCalledWith(0, 'utf8');
      expect(mockBuildEvent).toHaveBeenCalledWith(expect.objectContaining({
        data: { stdin: 'data' }
      }));
    });

    it('should handle file data input', async () => {
      mockReadFileSync.mockReturnValue('{"file": "data"}');

      await sendLogic({ agent: 'test-agent', data: '@test.json' }, { host: 'https://test.com' });

      expect(mockReadFileSync).toHaveBeenCalledWith('test.json', 'utf8');
      expect(mockBuildEvent).toHaveBeenCalledWith(expect.objectContaining({
        data: { file: 'data' }
      }));
    });

    it('should merge data sources correctly', async () => {
      const remainingArgs = ['override=value'];

      await sendLogic({ 
        agent: 'test-agent', 
        data: '{"base": "data", "override": "old"}' 
      }, { host: 'https://test.com' }, remainingArgs);

      expect(mockBuildEvent).toHaveBeenCalledWith(expect.objectContaining({
        data: {
          base: 'data',
          override: 'value' // Key=value should override JSON data
        }
      }));
    });

    it('should handle dry run', async () => {
      await sendLogic({ agent: 'test-agent', dryRun: true }, { host: 'https://test.com' });

      expect(mockLoggerInfo).toHaveBeenCalledWith('Dry run - event validated successfully');
      expect(mockSendEvents).not.toHaveBeenCalled();
    });

    it('should handle print option', async () => {
      await sendLogic({ agent: 'test-agent', print: true }, { host: 'https://test.com' });

      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(mockValidatedEvent, null, 2));
    });

    it('should handle partial response', async () => {
      mockSendEvents.mockResolvedValue({
        status: 'partial',
        accepted_count: 1,
        rejected_count: 0,
        rejected: []
      });

      await sendLogic({ agent: 'test-agent' }, { host: 'https://test.com' });

      expect(mockLoggerWarn).toHaveBeenCalledWith('Event partially processed. Accepted: 1, Rejected: 0');
    });

    it('should handle rejected response', async () => {
      mockSendEvents.mockResolvedValue({
        status: 'rejected',
        accepted_count: 0,
        rejected_count: 1,
        rejected: [{ error: 'Invalid agent' }]
      });

      await sendLogic({ agent: 'test-agent' }, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Event rejected');
      expect(mockLoggerError).toHaveBeenCalledWith('Error: Invalid agent');
    });
  });

  describe('error handling', () => {
    it('should handle missing agent', async () => {
      await sendLogic({}, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to send event: --agent is required');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle invalid key=value pair', async () => {
      const remainingArgs = ['invalid-arg'];

      await sendLogic({ agent: 'test-agent' }, { host: 'https://test.com' }, remainingArgs);

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to send event: Invalid key=value pair: invalid-arg');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle invalid JSON data', async () => {
      await sendLogic({ agent: 'test-agent', data: 'invalid-json' }, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith(expect.stringContaining('Failed to send event:'));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle network errors', async () => {
      const error = new Error('Network Error');
      mockSendEvents.mockRejectedValue(error);

      await sendLogic({ agent: 'test-agent' }, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to send event: Network Error');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle validation errors', async () => {
      const error = new Error('Validation Error');
      mockValidateEvent.mockImplementation(() => {
        throw error;
      });

      await sendLogic({ agent: 'test-agent' }, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to send event: Validation Error');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
});
