import { beforeEach, describe, expect, it, mock } from 'bun:test';

import {
  AmpThread,
  createAmpHistoryEvents,
  findAmpThreads,
  formatThreadSummary,
} from '../amp-history';

// Mock fs/promises
const mockReaddir = mock();
const mockStat = mock();
mock.module('fs/promises', () => ({
  readdir: mockReaddir,
  stat: mockStat,
  readFile: mock(),
}));

// Mock os
mock.module('os', () => ({
  homedir: mock(() => '/home/test'),
}));

describe('amp-history', () => {
  beforeEach(() => {
    mockReaddir.mockReset();
    mockStat.mockReset();
  });

  describe('findAmpThreads', () => {
    it('should return empty array when directory does not exist', async () => {
      mockReaddir.mockRejectedValue(new Error('ENOENT'));

      const result = await findAmpThreads();
      expect(result).toEqual([]);
    });

    it('should find and sort thread directories', async () => {
      const mockEntries = ['T-123', 'T-456', 'other-file', 'T-789'];
      const mockStats = (birthtime: Date, isDir: boolean) => ({
        isDirectory: () => isDir,
        isFile: () => !isDir,
        birthtime,
        size: 1024,
      });

      mockReaddir
        .mockResolvedValueOnce(mockEntries as any)
        .mockResolvedValueOnce([]) // Empty directory for size calculation
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockStat
        .mockResolvedValueOnce(mockStats(new Date('2025-01-03'), true) as any) // T-123
        .mockResolvedValueOnce(mockStats(new Date('2025-01-01'), true) as any) // T-456
        .mockResolvedValueOnce(mockStats(new Date('2025-01-02'), true) as any); // T-789 (other-file is filtered out before stat)

      const result = await findAmpThreads();

      expect(result).toHaveLength(3);
      expect(result[0].threadId).toBe('T-456'); // Oldest first
      expect(result[1].threadId).toBe('T-789');
      expect(result[2].threadId).toBe('T-123'); // Newest last
    });

    it('should filter out non-thread entries', async () => {
      mockReaddir
        .mockResolvedValueOnce(['not-a-thread', 'T-123'] as any) // First call to read amp directory
        .mockResolvedValueOnce([]); // Second call for size calculation

      mockStat.mockResolvedValueOnce({ isDirectory: () => true, birthtime: new Date() } as any); // only T-123 gets stat call

      const result = await findAmpThreads();
      expect(result).toHaveLength(1);
      expect(result[0].threadId).toBe('T-123');
    });
  });

  describe('createAmpHistoryEvents', () => {
    it('should create telemetry events from thread data', () => {
      const threads: AmpThread[] = [
        {
          threadId: 'T-123',
          createdAt: new Date('2025-01-01T10:00:00Z'),
          path: '/path/to/T-123',
          size: 1024,
        },
        {
          threadId: 'T-456',
          createdAt: new Date('2025-01-02T15:30:00Z'),
          path: '/path/to/T-456',
          size: 2048,
        },
      ];

      const events = createAmpHistoryEvents(threads);

      expect(events).toHaveLength(2);

      expect(events[0]).toEqual({
        agent: 'A-AMP',
        time: new Date('2025-01-01T10:00:00Z').getTime(),
        bid: 0,
        mult: 1,
        data: {
          thread_id: 'T-123',
          type: 'historical_thread',
          size_bytes: 1024,
          source: 'amp_file_changes',
        },
      });

      expect(events[1]).toEqual({
        agent: 'A-AMP',
        time: new Date('2025-01-02T15:30:00Z').getTime(),
        bid: 0,
        mult: 1,
        data: {
          thread_id: 'T-456',
          type: 'historical_thread',
          size_bytes: 2048,
          source: 'amp_file_changes',
        },
      });
    });

    it('should handle empty thread array', () => {
      const events = createAmpHistoryEvents([]);
      expect(events).toEqual([]);
    });
  });

  describe('formatThreadSummary', () => {
    it('should format summary for multiple threads', () => {
      const threads: AmpThread[] = [
        {
          threadId: 'T-123',
          createdAt: new Date('2025-01-01'),
          path: '/path',
          size: 1024,
        },
        {
          threadId: 'T-456',
          createdAt: new Date('2025-01-15'),
          path: '/path',
          size: 512,
        },
      ];

      const summary = formatThreadSummary(threads);

      expect(summary).toContain('Found 2 Amp thread(s)');
      expect(summary).toContain('Total size: 1.5 KB');
      expect(summary).toContain('Date range: 1/1/2025 to 1/15/2025');
    });

    it('should handle empty thread array', () => {
      const summary = formatThreadSummary([]);
      expect(summary).toBe('Found 0 Amp thread(s)');
    });

    it('should format bytes correctly', () => {
      const threads: AmpThread[] = [
        {
          threadId: 'T-1',
          createdAt: new Date('2025-01-01'),
          path: '/path',
          size: 500, // 500 B
        },
        {
          threadId: 'T-2',
          createdAt: new Date('2025-01-01'),
          path: '/path',
          size: 1024 * 1.5, // 1.5 KB
        },
        {
          threadId: 'T-3',
          createdAt: new Date('2025-01-01'),
          path: '/path',
          size: 1024 * 1024 * 2.5, // 2.5 MB
        },
      ];

      const summary = formatThreadSummary(threads);
      expect(summary).toContain('Total size: 2.5 MB'); // Should show largest unit
    });
  });
});
