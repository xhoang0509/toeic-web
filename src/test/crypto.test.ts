import { describe, it, expect } from 'vitest';
import { generateSha256 } from '../lib/crypto';

describe('Crypto Utilities (lib/crypto.ts)', () => {
  it('generates consistent 64-character SHA-256 hex string', async () => {
    const hash1 = await generateSha256('hello-world');
    const hash2 = await generateSha256('hello-world');
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it('produces different hashes for different inputs', async () => {
    const hashA = await generateSha256('inputA');
    const hashB = await generateSha256('inputB');
    expect(hashA).not.toBe(hashB);
  });

  it('handles empty string and UTF-8 characters', async () => {
    const emptyHash = await generateSha256('');
    expect(emptyHash).toBeDefined();

    const vietnameseHash = await generateSha256('Nguyễn Văn An | 183 câu | Điểm: 990');
    expect(vietnameseHash).toBeDefined();
    expect(vietnameseHash.length).toBe(64);
  });
});
