import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { calculateFileChecksum } from '../checksum';

describe('checksum utility', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arden-checksum-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should calculate consistent checksum for same content', () => {
    const filePath = path.join(tempDir, 'test.txt');
    const content = 'Hello, world!';

    fs.writeFileSync(filePath, content);

    const checksum1 = calculateFileChecksum(filePath);
    const checksum2 = calculateFileChecksum(filePath);

    expect(checksum1).toBe(checksum2);
    expect(checksum1).toHaveLength(64); // SHA-256 produces 64 character hex string
  });

  it('should produce different checksums for different content', () => {
    const file1Path = path.join(tempDir, 'file1.txt');
    const file2Path = path.join(tempDir, 'file2.txt');

    fs.writeFileSync(file1Path, 'Content 1');
    fs.writeFileSync(file2Path, 'Content 2');

    const checksum1 = calculateFileChecksum(file1Path);
    const checksum2 = calculateFileChecksum(file2Path);

    expect(checksum1).not.toBe(checksum2);
  });

  it('should handle binary files', () => {
    const filePath = path.join(tempDir, 'binary.bin');
    const binaryData = Buffer.from([0, 1, 2, 3, 255, 254, 253]);

    fs.writeFileSync(filePath, binaryData);

    const checksum = calculateFileChecksum(filePath);
    expect(checksum).toHaveLength(64);
  });

  it('should throw error for non-existent file', () => {
    const nonExistentPath = path.join(tempDir, 'does-not-exist.txt');

    expect(() => calculateFileChecksum(nonExistentPath)).toThrow();
  });
});
