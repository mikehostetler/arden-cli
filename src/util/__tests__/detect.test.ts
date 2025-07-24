import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { detectAmp, detectClaude, findOnPath, getVersion } from '../detect';

// Mock fs promises
const mockAccess = mock();
mock.module('fs/promises', () => ({
  access: mockAccess,
}));

// Mock child_process
const mockSpawn = mock();
mock.module('child_process', () => ({
  spawn: mockSpawn,
}));

beforeEach(() => {
  mockAccess.mockReset();
  mockSpawn.mockReset();
});

describe('detect utilities', () => {
  describe('findOnPath', () => {
    it('should find executable on PATH', async () => {
      // Mock successful access
      mockAccess.mockResolvedValueOnce(undefined);

      // Mock PATH environment variable
      const originalPath = process.env.PATH;
      process.env.PATH = '/usr/bin:/usr/local/bin';

      const result = await findOnPath('test-cmd');

      expect(result).toBe('/usr/bin/test-cmd');
      expect(mockAccess).toHaveBeenCalledWith('/usr/bin/test-cmd');

      // Restore PATH
      process.env.PATH = originalPath;
    });

    it('should return null if executable not found', async () => {
      // Mock failed access
      mockAccess.mockRejectedValue(new Error('Not found'));

      // Mock PATH environment variable
      const originalPath = process.env.PATH;
      process.env.PATH = '/usr/bin';

      const result = await findOnPath('nonexistent-cmd');

      expect(result).toBeNull();

      // Restore PATH
      process.env.PATH = originalPath;
    });

    it('should handle Windows .exe extension', async () => {
      // Mock successful access
      mockAccess.mockResolvedValueOnce(undefined);

      // Mock Windows platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const originalPath = process.env.PATH;
      process.env.PATH = 'C:\\Windows\\System32';

      const result = await findOnPath('cmd');

      expect(result).toBe('C:\\Windows\\System32/cmd.exe');

      // Restore
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      process.env.PATH = originalPath;
    });
  });

  describe('getVersion', () => {
    it('should get version from command', async () => {
      const mockChild = {
        stdout: {
          on: mock((event: string, callback: (data: Buffer) => void) => {
            if (event === 'data') {
              callback(Buffer.from('v1.0.0\n'));
            }
          }),
        },
        on: mock((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        }),
        kill: mock(),
      };

      mockSpawn.mockReturnValue(mockChild);

      const version = await getVersion('/usr/bin/test-cmd');

      expect(version).toBe('v1.0.0');
      expect(mockSpawn).toHaveBeenCalledWith('/usr/bin/test-cmd', ['--version'], {
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    });

    it('should return undefined for failed command', async () => {
      const mockChild = {
        stdout: {
          on: mock(),
        },
        on: mock((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 10); // Non-zero exit code
          }
        }),
        kill: mock(),
      };

      mockSpawn.mockReturnValue(mockChild);

      const version = await getVersion('/usr/bin/failing-cmd');

      expect(version).toBeUndefined();
    });
  });

  describe('detectClaude', () => {
    it('should detect Claude when present', async () => {
      // Mock findOnPath to return a path
      mockAccess.mockResolvedValueOnce(undefined);

      const mockChild = {
        stdout: {
          on: mock((event: string, callback: (data: Buffer) => void) => {
            if (event === 'data') {
              callback(Buffer.from('claude 0.3.7\n'));
            }
          }),
        },
        on: mock((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        }),
        kill: mock(),
      };

      mockSpawn.mockReturnValue(mockChild);

      const originalPath = process.env.PATH;
      const originalPlatform = process.platform;

      // Ensure we're on Unix-like platform for this test
      Object.defineProperty(process, 'platform', { value: 'linux' });
      process.env.PATH = '/usr/local/bin';

      const result = await detectClaude();

      expect(result.present).toBe(true);
      expect(result.bin).toBe('/usr/local/bin/claude');
      expect(result.version).toBe('claude 0.3.7');

      // Restore
      process.env.PATH = originalPath;
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return not present when Claude not found', async () => {
      mockAccess.mockRejectedValue(new Error('Not found'));

      const originalPath = process.env.PATH;
      process.env.PATH = '/usr/bin';

      const result = await detectClaude();

      expect(result.present).toBe(false);
      expect(result.bin).toBeUndefined();
      expect(result.version).toBeUndefined();

      process.env.PATH = originalPath;
    });
  });

  describe('detectAmp', () => {
    it('should detect Amp when present', async () => {
      mockAccess.mockResolvedValueOnce(undefined);

      const mockChild = {
        stdout: {
          on: mock((event: string, callback: (data: Buffer) => void) => {
            if (event === 'data') {
              callback(Buffer.from('0.0.123\n'));
            }
          }),
        },
        on: mock((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        }),
        kill: mock(),
      };

      mockSpawn.mockReturnValue(mockChild);

      const originalPath = process.env.PATH;
      const originalPlatform = process.platform;

      // Ensure we're on Unix-like platform for this test
      Object.defineProperty(process, 'platform', { value: 'linux' });
      process.env.PATH = '/usr/local/bin';

      const result = await detectAmp();

      expect(result.present).toBe(true);
      expect(result.bin).toBe('/usr/local/bin/amp');
      expect(result.version).toBe('0.0.123');

      // Restore
      process.env.PATH = originalPath;
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });
});
