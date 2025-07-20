import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Mock functions
const mockLoggerInfo = mock<(message: string) => void>();
const mockLoggerError = mock<(message: string, error?: any) => void>();
const mockConsoleLog = mock<(...args: any[]) => void>();
const mockProcessExit = mock<(code: number) => never>();
const mockClientGet = mock<(url: string) => Promise<{ json: () => Promise<any> }>>();
const mockCreateClient = mock<(host: string) => Promise<{ get: typeof mockClientGet }>>();

// Types for agents leaderboard
interface LeaderboardEntry {
  rank: number;
  agent_id: string;
  name: string;
  slug: string;
  runs: number;
  change: number;
  spark_data?: number[];
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

    const period = periodMap[options.period || "7d"] || "7_days";
    const mode = options.mode || "real";

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

    const response = await client.get(`api/leaderboards/agents?${searchParams}`);
    const data = await response.json() as LeaderboardResponse;

    if (options.json) {
      mockConsoleLog(JSON.stringify(data, null, 2));
    } else {
      const periodDisplay = options.period === "7d" ? "7 days" : 
                           options.period === "30d" ? "30 days" : 
                           options.period === "today" ? "today" : "7 days";
      
      mockConsoleLog(`🏆 Top Agents — ${periodDisplay} (${data.mode})\n`);
      
      if (data.data.length === 0) {
        mockConsoleLog("No data available for the selected period.");
      } else {
        data.data.forEach((entry) => {
          const changeSymbol = entry.change >= 0 ? "+" : "";
          const changeColor = entry.change >= 0 ? "✅" : "❌";
          
          mockConsoleLog(`${entry.rank}. ${entry.name}`);
          mockConsoleLog(`   ${entry.runs} runs (${changeSymbol}${entry.change}) ${changeColor}`);
          mockConsoleLog(`   Agent ID: ${entry.agent_id}`);
          mockConsoleLog("");
        });
      }
    }

    mockLoggerInfo(`Successfully retrieved leaderboard for ${data.period} (${data.mode})`);
  } catch (error) {
    mockLoggerError('Failed to fetch agents leaderboard:', error);
    mockProcessExit(1);
  }
}

describe('agents leaderboard command', () => {
  const mockLeaderboardData: LeaderboardResponse = {
    period: '7_days',
    mode: 'real',
    data: [
      {
        rank: 1,
        agent_id: 'agent-123',
        name: 'Test Agent 1',
        slug: 'test-agent-1',
        runs: 150,
        change: 25,
        spark_data: [100, 110, 120, 130, 140, 150]
      },
      {
        rank: 2,
        agent_id: 'agent-456',
        name: 'Test Agent 2',
        slug: 'test-agent-2',
        runs: 75,
        change: -10,
        spark_data: [85, 80, 78, 76, 75]
      }
    ]
  };

  beforeEach(() => {
    // Clear all mocks
    mockLoggerInfo.mockClear();
    mockLoggerError.mockClear();
    mockConsoleLog.mockClear();
    mockProcessExit.mockClear();
    mockClientGet.mockClear();
    mockCreateClient.mockClear();
  });

  describe('successful requests', () => {
    beforeEach(() => {
      mockCreateClient.mockResolvedValue({ get: mockClientGet });
      mockClientGet.mockResolvedValue({
        json: async () => mockLeaderboardData
      });
    });

    it('should handle leaderboard command with default options', async () => {
      await leaderboardLogic({}, { host: 'https://test.com' });

      expect(mockCreateClient).toHaveBeenCalledWith('https://test.com');
      expect(mockClientGet).toHaveBeenCalledWith('api/leaderboards/agents?period=7_days&mode=real');
      
      // Check for key console outputs
      const consoleCalls = mockConsoleLog.mock.calls.map(call => call[0]);
      expect(consoleCalls).toContain('🏆 Top Agents — 7 days (real)\n');
      expect(consoleCalls).toContain('1. Test Agent 1');
      expect(consoleCalls).toContain('   150 runs (+25) ✅');
      expect(consoleCalls).toContain('   Agent ID: agent-123');
      expect(consoleCalls).toContain('2. Test Agent 2');
      expect(consoleCalls).toContain('   75 runs (-10) ❌');
      expect(consoleCalls).toContain('   Agent ID: agent-456');
      
      expect(mockLoggerInfo).toHaveBeenCalledWith('Successfully retrieved leaderboard for 7_days (real)');
    });

    it('should handle different time periods', async () => {
      await leaderboardLogic({ period: '30d' }, { host: 'https://test.com' });

      expect(mockClientGet).toHaveBeenCalledWith('api/leaderboards/agents?period=30_days&mode=real');
      expect(mockConsoleLog).toHaveBeenCalledWith('🏆 Top Agents — 30 days (real)\n');
    });

    it('should handle today period', async () => {
      await leaderboardLogic({ period: 'today' }, { host: 'https://test.com' });

      expect(mockClientGet).toHaveBeenCalledWith('api/leaderboards/agents?period=today&mode=real');
      expect(mockConsoleLog).toHaveBeenCalledWith('🏆 Top Agents — today (real)\n');
    });

    it('should handle different modes', async () => {
      await leaderboardLogic({ mode: 'simulated' }, { host: 'https://test.com' });

      expect(mockClientGet).toHaveBeenCalledWith('api/leaderboards/agents?period=7_days&mode=simulated');
    });

    it('should handle JSON output', async () => {
      await leaderboardLogic({ json: true }, { host: 'https://test.com' });

      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(mockLeaderboardData, null, 2));
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('🏆'));
    });

    it('should handle negative changes correctly', async () => {
      await leaderboardLogic({}, { host: 'https://test.com' });

      expect(mockConsoleLog).toHaveBeenCalledWith('2. Test Agent 2');
      expect(mockConsoleLog).toHaveBeenCalledWith('   75 runs (-10) ❌');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Agent ID: agent-456');
    });

    it('should handle empty leaderboard', async () => {
      const emptyData: LeaderboardResponse = {
        period: '7_days',
        mode: 'real',
        data: []
      };
      mockClientGet.mockResolvedValue({
        json: async () => emptyData
      });

      await leaderboardLogic({}, { host: 'https://test.com' });

      expect(mockConsoleLog).toHaveBeenCalledWith('No data available for the selected period.');
    });

    it('should handle zero change correctly', async () => {
      const zeroChangeData: LeaderboardResponse = {
        period: '7_days',
        mode: 'real',
        data: [{
          rank: 1,
          agent_id: 'agent-123',
          name: 'Test Agent',
          slug: 'test-agent',
          runs: 100,
          change: 0
        }]
      };
      mockClientGet.mockResolvedValue({
        json: async () => zeroChangeData
      });

      await leaderboardLogic({}, { host: 'https://test.com' });

      expect(mockConsoleLog).toHaveBeenCalledWith('   100 runs (+0) ✅');
    });
  });

  describe('error handling', () => {
    it('should handle missing host', async () => {
      await leaderboardLogic({}, {});

      expect(mockLoggerError).toHaveBeenCalledWith('Host is required. Use --host flag or set HOST environment variable.');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle invalid mode', async () => {
      await leaderboardLogic({ mode: 'invalid' }, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Invalid mode. Must be one of: real, simulated, both');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      mockCreateClient.mockRejectedValue(error);

      await leaderboardLogic({}, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to fetch agents leaderboard:', error);
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle network errors', async () => {
      const error = new Error('Network Error');
      mockCreateClient.mockResolvedValue({ get: mockClientGet });
      mockClientGet.mockRejectedValue(error);

      await leaderboardLogic({}, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to fetch agents leaderboard:', error);
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should map unknown period to default', async () => {
      mockCreateClient.mockResolvedValue({ get: mockClientGet });
      mockClientGet.mockResolvedValue({
        json: async () => mockLeaderboardData
      });

      await leaderboardLogic({ period: 'unknown' }, { host: 'https://test.com' });

      expect(mockClientGet).toHaveBeenCalledWith('api/leaderboards/agents?period=7_days&mode=real');
    });
  });
});
