import { describe, it, expect } from 'vitest';
import {
  calculateScaledToeic,
  calculateSectionScaledScore,
  getCefrLevel,
  formatTime,
} from '../lib/score';

describe('Score Utilities (lib/score.ts)', () => {
  describe('calculateScaledToeic', () => {
    it('returns minimum 10 points for 0% or negative percent', () => {
      expect(calculateScaledToeic(0)).toBe(10);
      expect(calculateScaledToeic(-10)).toBe(10);
      expect(calculateScaledToeic(NaN)).toBe(10);
    });

    it('returns maximum 990 points for 100%', () => {
      expect(calculateScaledToeic(100)).toBe(990);
    });

    it('scales scores proportionally and rounds to nearest 5', () => {
      const mid = calculateScaledToeic(50);
      expect(mid % 5).toBe(0);
      expect(mid).toBeGreaterThanOrEqual(490);
      expect(mid).toBeLessThanOrEqual(510);
    });
  });

  describe('calculateSectionScaledScore', () => {
    it('returns 5 points for 0 correct answers', () => {
      expect(calculateSectionScaledScore(0, 100)).toBe(5);
      expect(calculateSectionScaledScore(-1, 100)).toBe(5);
    });

    it('returns 495 points for 100% correct answers', () => {
      expect(calculateSectionScaledScore(100, 100)).toBe(495);
    });

    it('returns multiples of 5 within 5 to 495 range', () => {
      const val = calculateSectionScaledScore(75, 100);
      expect(val % 5).toBe(0);
      expect(val).toBeGreaterThan(300);
    });
  });

  describe('getCefrLevel', () => {
    it('correctly maps scores to CEFR bands', () => {
      expect(getCefrLevel(950).level).toBe('C1+');
      expect(getCefrLevel(850).level).toBe('C1');
      expect(getCefrLevel(650).level).toBe('B2');
      expect(getCefrLevel(450).level).toBe('B1');
      expect(getCefrLevel(300).level).toBe('A2');
      expect(getCefrLevel(150).level).toBe('A1');
    });

    it('provides titles, descriptions, and styling colors', () => {
      const info = getCefrLevel(990);
      expect(info.title).toContain('Master');
      expect(info.color).toBeDefined();
      expect(info.badgeBg).toBeDefined();
    });
  });

  describe('formatTime', () => {
    it('formats seconds to mm:ss', () => {
      expect(formatTime(0)).toBe('00:00');
      expect(formatTime(9)).toBe('00:09');
      expect(formatTime(65)).toBe('01:05');
      expect(formatTime(7200)).toBe('120:00');
    });
  });
});
