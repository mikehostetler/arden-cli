import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Mock functions
const mockLoggerInfo = mock<(message: string) => void>();
const mockLoggerError = mock<(message: string, error?: any) => void>();
const mockConsoleLog = mock<(...args: any[]) => void>();
const mockProcessExit = mock<(code: number) => never>();
const mockClientGet = mock<(url: string) => Promise<{ json: () => Promise<any> }>>();
const mockCreateClient = mock<(host: string) => Promise<{ get: typeof mockClientGet }>>();

// Types for agents list
interface Agent {
  id: number;
  name: string;
  slug: string;
  agent_id: string;
  website_url: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AgentsResponse {
  agents: Agent[];
  total_count: number;
  limit: number;
  offset: number;
}

interface ListOptions {
  json?: boolean;
  limit?: string;
  offset?: string;
}

interface GlobalOptions {
  host?: string;
}

// Simplified list logic for testing
async function listLogic(options: ListOptions, globalOptions: GlobalOptions) {
  try {
    if (!globalOptions.host) {
      mockLoggerError('Host is required. Use --host flag or set HOST environment variable.');
      mockProcessExit(1);
      return;
    }

    const client = await mockCreateClient(globalOptions.host);
    
    const searchParams = new URLSearchParams({
      limit: options.limit || "50",
      offset: options.offset || "0"
    });

    const response = await client.get(`api/agents?${searchParams}`);
    const data = await response.json() as AgentsResponse;

    if (options.json) {
      mockConsoleLog(JSON.stringify(data, null, 2));
    } else {
      mockConsoleLog(`Found ${data.total_count} agents (showing ${data.agents.length}):\n`);
      
      const offsetNum = parseInt(options.offset || "0");
      const limitNum = parseInt(options.limit || "50");
      
      data.agents.forEach((agent, index) => {
        mockConsoleLog(`${index + 1 + offsetNum}. ${agent.name}`);
        mockConsoleLog(`   ID: ${agent.agent_id}`);
        mockConsoleLog(`   Slug: ${agent.slug}`);
        mockConsoleLog(`   Active: ${agent.is_active ? "Yes" : "No"}`);
        if (agent.website_url) {
          mockConsoleLog(`   Website: ${agent.website_url}`);
        }
        mockConsoleLog(`   Created: ${new Date(agent.created_at).toLocaleDateString()}`);
        mockConsoleLog("");
      });

      if (data.total_count > offsetNum + limitNum) {
        const nextOffset = offsetNum + limitNum;
        mockConsoleLog(`Use --offset ${nextOffset} to see more results.`);
      }
    }

    mockLoggerInfo(`Successfully retrieved ${data.agents.length} agents`);
  } catch (error) {
    mockLoggerError('Failed to fetch agents:', error);
    mockProcessExit(1);
  }
}

describe('agents list command', () => {
  const mockAgentData: AgentsResponse = {
    agents: [
      {
        id: 1,
        name: 'Test Agent 1',
        slug: 'test-agent-1',
        agent_id: 'agent-123',
        website_url: 'https://example.com',
        logo_url: null,
        is_active: true,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z'
      },
      {
        id: 2,
        name: 'Test Agent 2',
        slug: 'test-agent-2',
        agent_id: 'agent-456',
        website_url: null,
        logo_url: null,
        is_active: false,
        created_at: '2024-01-16T10:00:00Z',
        updated_at: '2024-01-16T10:00:00Z'
      }
    ],
    total_count: 2,
    limit: 50,
    offset: 0
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
        json: async () => mockAgentData
      });
    });

    it('should handle list command with default options', async () => {
      await listLogic({}, { host: 'https://test.com' });

      expect(mockCreateClient).toHaveBeenCalledWith('https://test.com');
      expect(mockClientGet).toHaveBeenCalledWith('api/agents?limit=50&offset=0');
      
      // Check for key console outputs
      const consoleCalls = mockConsoleLog.mock.calls.map(call => call[0]);
      expect(consoleCalls).toContain('Found 2 agents (showing 2):\n');
      expect(consoleCalls).toContain('1. Test Agent 1');
      expect(consoleCalls).toContain('   ID: agent-123');
      expect(consoleCalls).toContain('   Active: Yes');
      expect(consoleCalls).toContain('   Website: https://example.com');
      expect(consoleCalls).toContain('2. Test Agent 2');
      expect(consoleCalls).toContain('   Active: No');
    });

    it('should handle list command with custom limit and offset', async () => {
      await listLogic({ limit: '10', offset: '5' }, { host: 'https://test.com' });

      expect(mockClientGet).toHaveBeenCalledWith('api/agents?limit=10&offset=5');
      expect(mockConsoleLog).toHaveBeenCalledWith('6. Test Agent 1'); // 1 + 5 offset
      expect(mockConsoleLog).toHaveBeenCalledWith('7. Test Agent 2'); // 2 + 5 offset
    });

    it('should handle JSON output', async () => {
      await listLogic({ json: true }, { host: 'https://test.com' });

      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(mockAgentData, null, 2));
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Found'));
    });

    it('should handle agent without website', async () => {
      await listLogic({}, { host: 'https://test.com' });

      expect(mockConsoleLog).toHaveBeenCalledWith('2. Test Agent 2');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Active: No');
      // Should not log website for agent 2
      const websiteCalls = mockConsoleLog.mock.calls.filter(call => 
        call[0]?.toString().includes('Website:')
      );
      expect(websiteCalls.length).toBe(1); // Only for agent 1
    });

    it('should show pagination hint when more results available', async () => {
      const paginatedData = {
        agents: mockAgentData.agents, // 2 agents
        total_count: 100,
        limit: 10,
        offset: 0
      };
      mockClientGet.mockResolvedValue({
        json: async () => paginatedData
      });

      await listLogic({ limit: '10', offset: '0' }, { host: 'https://test.com' });

      // Check that the pagination hint appears in the console.log calls
      const consoleCalls = mockConsoleLog.mock.calls.map(call => call[0]);
      expect(consoleCalls).toContain('Use --offset 10 to see more results.');
    });

    it('should not show pagination hint when no more results', async () => {
      await listLogic({}, { host: 'https://test.com' });

      const paginationCalls = mockConsoleLog.mock.calls.filter(call => 
        call[0]?.toString().includes('Use --offset')
      );
      expect(paginationCalls.length).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle missing host', async () => {
      await listLogic({}, {});

      expect(mockLoggerError).toHaveBeenCalledWith('Host is required. Use --host flag or set HOST environment variable.');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      mockCreateClient.mockRejectedValue(error);

      await listLogic({}, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to fetch agents:', error);
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle network errors', async () => {
      const error = new Error('Network Error');
      mockCreateClient.mockResolvedValue({ get: mockClientGet });
      mockClientGet.mockRejectedValue(error);

      await listLogic({}, { host: 'https://test.com' });

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to fetch agents:', error);
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
});
