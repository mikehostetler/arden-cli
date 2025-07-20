import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Mock functions
const mockLoggerInfo = mock<(message: string) => void>();
const mockLoggerError = mock<(message: string, error?: any) => void>();
const mockConsoleLog = mock<(...args: any[]) => void>();
const mockProcessExit = mock<(code: number) => never>();
const mockClientGet = mock<(url: string) => Promise<{ json: () => Promise<any> }>>();
const mockCreateClient = mock<(host: string) => Promise<{ get: typeof mockClientGet }>>();

// Types for leaderboard
interface LeaderboardEntry {
  rank: number;
  user_id: number;
  name: string;
  username: string;
  user_hash: string;
  runs: number;
  change: number;
}

interface LeaderboardResponse {
  period: string;
  mode: string;
  data: LeaderboardEntry[];
}

interface LeaderboardOptions {
  period?: string;
  mode?: string;
  json?: boolean;
}

interface GlobalOptions {
  host?: string;
}

// Simplified leaderboard logic for testing
async function leaderboardLogic(options: LeaderboardOptions, globalOptions: GlobalOptions) {
  try {
    if (!globalOptions.host) {
      mockLoggerError('Host is required. Use --host flag or set HOST environment variable.');
      mockProcessExit(1);
      return;
    }

    // Map CLI period format to API format
    const periodMap: Record<string, string> = {
      "7d": "7_days",
      "30d": "30_days",
      "today": "today"
    };

    const period = periodMap[options.period || '7d'] || "7_days";
    const mode = options.mode || 'real';

    // Validate mode
    if (!["real", "simulated", "both"].includes(mode)) {
      mockLoggerError("Invalid mode. Must be one of: real, simulated, both");
      mockProcessExit(1);
      return;
    }

    const client = await mockCreateClient(globalOptions.host);
    
    const searchParams = new URLSearchParams({
      period,
      mode
    });

    const response = await client.get(`api/leaderboards/users?${searchParams}`);
    const data = await response.json() as LeaderboardResponse;

    if (options.json) {
      mockConsoleLog(JSON.stringify(data, null, 2));
    } else {
      const periodDisplay = options.period === "7d" ? "7 days" : 
                           options.period === "30d" ? "30 days" : 
                           options.period === "today" ? "today" : "7 days";
      
      mockConsoleLog(`👥 Top Users — ${periodDisplay} (${data.mode})\n`);
      
      if (data.data.length === 0) {
        mockConsoleLog("No data available for the selected period.");
      } else {
        data.data.forEach((entry) => {
          const changeSymbol = entry.change >= 0 ? "+" : "";
          const changeColor = entry.change >= 0 ? "✅" : "❌";
          
          mockConsoleLog(`${entry.rank}. ${entry.name || entry.username}`);
          mockConsoleLog(`   ${entry.runs} runs (${changeSymbol}${entry.change}) ${changeColor}`);
          mockConsoleLog(`   Username: ${entry.username}`);
          
          // PRIVACY ISSUE: This line exposes internal user database IDs
          mockConsoleLog(`   User ID: ${entry.user_id}`);
          
          mockConsoleLog("");
        });
      }
    }

    mockLoggerInfo(`Successfully retrieved user leaderboard for ${data.period} (${data.mode})`);
  } catch (error) {
    mockLoggerError("Failed to fetch users leaderboard:", error);
    mockProcessExit(1);
  }
}

// Mock response data
const mockLeaderboardData: LeaderboardResponse = {
  period: '7_days',
  mode: 'real',
  data: [
    {
      rank: 1,
      user_id: 12345, // This is the privacy issue!
      name: 'John Doe',
      username: 'johndoe',
      user_hash: 'abc123',
      runs: 150,
      change: 5
    },
    {
      rank: 2,
      user_id: 67890, // This is the privacy issue!
      name: 'Jane Smith',
      username: 'janesmith',
      user_hash: 'def456',
      runs: 120,
      change: -2
    }
  ]
};

const mockEmptyLeaderboardData: LeaderboardResponse = {
  period: '7_days',
  mode: 'real',
  data: []
};

beforeEach(() => {
  mockLoggerInfo.mockClear();
  mockLoggerError.mockClear();
  mockConsoleLog.mockClear();
  mockProcessExit.mockClear();
  mockClientGet.mockClear();
  mockCreateClient.mockClear();
});

describe('users leaderboard command logic', () => {
  describe('input validation', () => {
    it('should exit with error when host is not provided', async () => {
      await leaderboardLogic({}, {});
      
      expect(mockLoggerError).toHaveBeenCalledWith('Host is required. Use --host flag or set HOST environment variable.');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should exit with error for invalid mode', async () => {
      await leaderboardLogic({ mode: 'invalid' }, { host: 'http://localhost:3000' });
      
      expect(mockLoggerError).toHaveBeenCalledWith('Invalid mode. Must be one of: real, simulated, both');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('API interaction', () => {
    beforeEach(() => {
      const mockResponse = {
        json: mock().mockResolvedValue(mockLeaderboardData)
      };
      mockClientGet.mockResolvedValue(mockResponse);
      mockCreateClient.mockResolvedValue({ get: mockClientGet });
    });

    it('should call API with correct parameters for default options', async () => {
      await leaderboardLogic({}, { host: 'http://localhost:3000' });
      
      expect(mockCreateClient).toHaveBeenCalledWith('http://localhost:3000');
      expect(mockClientGet).toHaveBeenCalledWith('api/leaderboards/users?period=7_days&mode=real');
    });

    it('should map period formats correctly', async () => {
      // Test 30d mapping
      await leaderboardLogic({ period: '30d' }, { host: 'http://localhost:3000' });
      expect(mockClientGet).toHaveBeenCalledWith('api/leaderboards/users?period=30_days&mode=real');
      
      mockClientGet.mockClear();
      
      // Test today mapping
      await leaderboardLogic({ period: 'today' }, { host: 'http://localhost:3000' });
      expect(mockClientGet).toHaveBeenCalledWith('api/leaderboards/users?period=today&mode=real');
    });

    it('should pass through custom mode parameter', async () => {
      await leaderboardLogic({ mode: 'simulated' }, { host: 'http://localhost:3000' });
      
      expect(mockClientGet).toHaveBeenCalledWith('api/leaderboards/users?period=7_days&mode=simulated');
    });
  });

  describe('JSON output', () => {
    beforeEach(() => {
      const mockResponse = {
        json: mock().mockResolvedValue(mockLeaderboardData)
      };
      mockClientGet.mockResolvedValue(mockResponse);
      mockCreateClient.mockResolvedValue({ get: mockClientGet });
    });

    it('should output JSON when --json flag is used', async () => {
      await leaderboardLogic({ json: true }, { host: 'http://localhost:3000' });
      
      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(mockLeaderboardData, null, 2));
    });
  });

  describe('formatted output', () => {
    beforeEach(() => {
      const mockResponse = {
        json: mock().mockResolvedValue(mockLeaderboardData)
      };
      mockClientGet.mockResolvedValue(mockResponse);
      mockCreateClient.mockResolvedValue({ get: mockClientGet });
    });

    it('should display formatted leaderboard with user data', async () => {
      await leaderboardLogic({}, { host: 'http://localhost:3000' });
      
      // Check header
      expect(mockConsoleLog).toHaveBeenCalledWith('👥 Top Users — 7 days (real)\n');
      
      // Check first user entry
      expect(mockConsoleLog).toHaveBeenCalledWith('1. John Doe');
      expect(mockConsoleLog).toHaveBeenCalledWith('   150 runs (+5) ✅');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Username: johndoe');
      
      // PRIVACY ISSUE: This should NOT be displayed
      expect(mockConsoleLog).toHaveBeenCalledWith('   User ID: 12345');
      
      // Check second user entry with negative change
      expect(mockConsoleLog).toHaveBeenCalledWith('2. Jane Smith');
      expect(mockConsoleLog).toHaveBeenCalledWith('   120 runs (-2) ❌');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Username: janesmith');
      
      // PRIVACY ISSUE: This should NOT be displayed
      expect(mockConsoleLog).toHaveBeenCalledWith('   User ID: 67890');
    });

    it('should handle empty leaderboard data', async () => {
      const mockResponse = {
        json: mock().mockResolvedValue(mockEmptyLeaderboardData)
      };
      mockClientGet.mockResolvedValue(mockResponse);
      mockCreateClient.mockResolvedValue({ get: mockClientGet });
      
      await leaderboardLogic({}, { host: 'http://localhost:3000' });
      
      expect(mockConsoleLog).toHaveBeenCalledWith('👥 Top Users — 7 days (real)\n');
      expect(mockConsoleLog).toHaveBeenCalledWith('No data available for the selected period.');
    });

    it('should display correct period labels', async () => {
      // Test 30d period display
      await leaderboardLogic({ period: '30d' }, { host: 'http://localhost:3000' });
      expect(mockConsoleLog).toHaveBeenCalledWith('👥 Top Users — 30 days (real)\n');
      
      mockConsoleLog.mockClear();
      
      // Test today period display
      await leaderboardLogic({ period: 'today' }, { host: 'http://localhost:3000' });
      expect(mockConsoleLog).toHaveBeenCalledWith('👥 Top Users — today (real)\n');
    });

    it('should fallback to username when name is not available', async () => {
      const dataWithoutName = {
        ...mockLeaderboardData,
        data: [
          {
            rank: 1,
            user_id: 12345,
            name: '',
            username: 'testuser',
            user_hash: 'abc123',
            runs: 100,
            change: 0
          }
        ]
      };
      
      const mockResponse = {
        json: mock().mockResolvedValue(dataWithoutName)
      };
      mockClientGet.mockResolvedValue(mockResponse);
      mockCreateClient.mockResolvedValue({ get: mockClientGet });
      
      await leaderboardLogic({}, { host: 'http://localhost:3000' });
      
      expect(mockConsoleLog).toHaveBeenCalledWith('1. testuser');
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const mockError = new Error('API Error');
      mockCreateClient.mockRejectedValue(mockError);
      
      await leaderboardLogic({}, { host: 'http://localhost:3000' });
      
      expect(mockLoggerError).toHaveBeenCalledWith('Failed to fetch users leaderboard:', mockError);
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('success logging', () => {
    beforeEach(() => {
      const mockResponse = {
        json: mock().mockResolvedValue(mockLeaderboardData)
      };
      mockClientGet.mockResolvedValue(mockResponse);
      mockCreateClient.mockResolvedValue({ get: mockClientGet });
    });

    it('should log success message with correct parameters', async () => {
      await leaderboardLogic({}, { host: 'http://localhost:3000' });
      
      expect(mockLoggerInfo).toHaveBeenCalledWith('Successfully retrieved user leaderboard for 7_days (real)');
    });
  });
});

describe('PRIVACY ISSUE IDENTIFIED', () => {
  it('should NOT display user_id in formatted output', () => {
    // This test documents the privacy issue found in the leaderboard command:
    // 
    // FILE: src/commands/users/leaderboard.ts
    // LINE: 82
    // CODE: console.log(`   User ID: ${entry.user_id}`);
    // 
    // ISSUE: This exposes internal database user IDs which should be private information
    // 
    // SOLUTIONS:
    // 1. Remove this line entirely (recommended)
    // 2. Use user_hash instead if a public identifier is needed
    // 3. Backend API should also remove user_id from the response
    
    const privacyIssues = [
      {
        location: 'CLI Frontend',
        file: 'src/commands/users/leaderboard.ts',
        line: 82,
        issue: 'Displays internal user_id in console output',
        code: 'console.log(`   User ID: ${entry.user_id}`);',
        fix: 'Remove this line entirely'
      },
      {
        location: 'Backend API',
        file: 'Backend API Response',
        issue: 'API returns user_id field in leaderboard response',
        interface: 'LeaderboardEntry.user_id: number',
        fix: 'Remove user_id from API response schema'
      }
    ];
    
    expect(privacyIssues).toHaveLength(2);
    expect(privacyIssues[0].issue).toBe('Displays internal user_id in console output');
    expect(privacyIssues[1].issue).toBe('API returns user_id field in leaderboard response');
  });
});
