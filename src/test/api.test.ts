import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  gradeExamOnServer,
  checkAnswerOnServer,
  fetchAdminData,
  setBanStatus,
} from '../lib/api';
import {
  fetchPublicConfig,
  authenticateAdmin,
  updateAdminConfigs,
} from '../lib/admin';
import { Storage } from '../lib/storage';

describe('API & Admin Client Layer (lib/api.ts & lib/admin.ts)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('gradeExamOnServer', () => {
    it('returns error if webhookUrl is not set', async () => {
      Storage.saveSettings({ webhookUrl: '' });
      const res = await gradeExamOnServer(
        { name: 'Test', emailOrCode: 'test@email.com', targetScore: '650+' },
        1000,
        {}
      );
      expect(res.success).toBe(false);
      expect(res.error).toContain('chưa được kết nối');
    });

    it('submits exam payload and parses response', async () => {
      Storage.saveSettings({ webhookUrl: 'https://script.google.com/test/exec' });

      globalThis.fetch = vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          examResult: {
            id: 'EXAM-123',
            totalScaledScore: 850,
          },
        }),
      } as any);

      const res = await gradeExamOnServer(
        { name: 'An', emailOrCode: 'an@email.com', targetScore: '800+' },
        2000,
        { 'q-1': 'A' }
      );

      expect(res.success).toBe(true);
      expect(res.examResult?.totalScaledScore).toBe(850);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://script.google.com/test/exec',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('checkAnswerOnServer', () => {
    it('calls server to check single answer', async () => {
      Storage.saveSettings({ webhookUrl: 'https://script.google.com/test/exec' });

      globalThis.fetch = vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          isCorrect: true,
          correctLetter: 'B',
          explanation: 'Giải thích đúng',
        }),
      } as any);

      const res = await checkAnswerOnServer('q-1', 'B', 'an@email.com');
      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(true);
      expect(res.correctLetter).toBe('B');
    });
  });

  describe('Admin Operations', () => {
    it('fetches admin data and sets ban status', async () => {
      Storage.saveSettings({ webhookUrl: 'https://script.google.com/test/exec' });

      globalThis.fetch = vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          configs: { exam_duration_minutes: '120' },
          users: [{ email: 'bad@user.com', status: 'ACTIVE' }],
        }),
      } as any);

      const dataRes = await fetchAdminData('admin@pass');
      expect(dataRes.success).toBe(true);
      expect(dataRes.users).toHaveLength(1);

      // Ban user test
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          message: 'Banned',
        }),
      } as any);

      const banRes = await setBanStatus('bad@user.com', true, 'Spam', 'admin@pass');
      expect(banRes.success).toBe(true);
    });

    it('fetches public config safely', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          exam_duration_minutes: 120,
          allow_instant_answers: true,
          show_leaderboard: true,
          announcement_banner: 'Hello',
        }),
      } as any);

      const cfg = await fetchPublicConfig('https://script.google.com/test/exec');
      expect(cfg).toBeDefined();
      expect(cfg?.exam_duration_minutes).toBe(120);
      expect(cfg?.announcement_banner).toBe('Hello');
    });

    it('authenticates admin password', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          token: 'auth-token-123',
        }),
      } as any);

      const auth = await authenticateAdmin('https://script.google.com/test/exec', 'pass123');
      expect(auth.success).toBe(true);
      expect(auth.token).toBe('auth-token-123');
    });
  });
});
