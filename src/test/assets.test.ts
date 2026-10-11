import { describe, it, expect } from 'vitest';
import { getAssetUrl } from '../lib/assets';

describe('Assets Utility (lib/assets.ts)', () => {
  it('returns empty string if empty path', () => {
    expect(getAssetUrl('')).toBe('');
  });

  it('preserves http, https, and data URLs', () => {
    expect(getAssetUrl('https://example.com/audio.mp3')).toBe('https://example.com/audio.mp3');
    expect(getAssetUrl('http://example.com/img.jpg')).toBe('http://example.com/img.jpg');
    expect(getAssetUrl('data:image/png;base64,...')).toBe('data:image/png;base64,...');
  });

  it('prepends base url to relative paths cleanly', () => {
    const url = getAssetUrl('quiz1/sound1.mp3');
    expect(url).toContain('quiz1/sound1.mp3');
  });
});
