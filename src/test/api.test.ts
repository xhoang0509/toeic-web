import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  gradeExamOnServer,
  checkAnswerOnServer,
  fetchLeaderboard,
  fetchPublicConfig,
  getApiBaseUrl,
} from '../lib/api';
import { authenticateAdmin, fetchAdminData, setBanStatus, updateAdminConfigs } from '../lib/admin';
import { Storage } from '../lib/storage';

const API = 'https://toeic-api.example.workers.dev';

function mockJson(payload: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    text: async () => JSON.stringify(payload),
  } as any);
}

describe('API Client (lib/api.ts & lib/admin.ts)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    Storage.saveSettings({ apiBaseUrl: API });
  });

  it('đọc được endpoint API từ settings', () => {
    expect(getApiBaseUrl()).toBe(API);
  });

  describe('gradeExamOnServer', () => {
    it('trả lỗi rõ ràng khi chưa cấu hình API', async () => {
      Storage.saveSettings({ apiBaseUrl: '' });
      const res = await gradeExamOnServer(
        { name: 'Test', emailOrCode: 'test@email.com', targetScore: '650+' },
        1000,
        {}
      );
      expect(res.success).toBe(false);
      expect(res.error).toContain('chưa được kết nối');
    });

    it('gửi bài thi tới /api/exam/grade và đọc kết quả chấm', async () => {
      globalThis.fetch = mockJson({
        success: true,
        examResult: { id: 'EXAM-123', totalScaledScore: 850 },
        reviewDetails: { 'q-1': { correctLetter: 'B', explanation: 'vì vậy', isCorrect: false } },
      });

      const res = await gradeExamOnServer(
        { name: 'An', emailOrCode: 'an@email.com', targetScore: '800+' },
        2000,
        { 'q-1': 'A' }
      );

      expect(res.success).toBe(true);
      expect(res.examResult?.totalScaledScore).toBe(850);
      expect(res.reviewDetails?.['q-1'].correctLetter).toBe('B');

      const [url, init] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toBe(`${API}/api/exam/grade`);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toMatchObject({
        durationSeconds: 2000,
        answers: { 'q-1': 'A' },
        candidate: { emailOrCode: 'an@email.com' },
      });
    });

    it('báo lỗi khi máy chủ trả về dữ liệu không phải JSON', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '<html>502</html>',
      } as any);

      const res = await gradeExamOnServer({ name: 'A', emailOrCode: '', targetScore: '650+' }, 0, {});
      expect(res.success).toBe(false);
      expect(res.error).toContain('không hợp lệ');
    });

    it('báo lỗi khi mất kết nối mạng', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
      const res = await gradeExamOnServer({ name: 'A', emailOrCode: '', targetScore: '650+' }, 0, {});
      expect(res.success).toBe(false);
      expect(res.error).toContain('Không thể kết nối');
    });
  });

  describe('checkAnswerOnServer', () => {
    it('chấm 1 câu qua /api/practice/check', async () => {
      globalThis.fetch = mockJson({
        success: true,
        isCorrect: true,
        correctLetter: 'B',
        explanation: 'Giải thích đúng',
      });

      const res = await checkAnswerOnServer('q-1', 'B', 'an@email.com');
      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(true);
      expect((globalThis.fetch as any).mock.calls[0][0]).toBe(`${API}/api/practice/check`);
    });
  });

  describe('fetchLeaderboard', () => {
    it('đọc bảng xếp hạng thật từ server', async () => {
      globalThis.fetch = mockJson({
        success: true,
        entries: [{ id: 'EXAM-1', candidateName: 'An', totalScaledScore: 900 }],
        stats: { totalAttempts: 3, bestScore: 900, averageScore: 700 },
      });

      const res = await fetchLeaderboard(50);
      expect(res.success).toBe(true);
      expect(res.entries).toHaveLength(1);
      expect(res.stats?.bestScore).toBe(900);
      expect((globalThis.fetch as any).mock.calls[0][0]).toContain('/api/leaderboard?limit=50&mode=best');
    });

    it('luôn trả về mảng entries dù server lỗi', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));
      const res = await fetchLeaderboard();
      expect(res.success).toBeFalsy();
      expect(res.entries).toEqual([]);
    });
  });

  describe('fetchPublicConfig', () => {
    it('đọc cấu hình công khai', async () => {
      globalThis.fetch = mockJson({
        success: true,
        exam_duration_minutes: 90,
        allow_instant_answers: true,
        show_leaderboard: false,
        announcement_banner: 'Hello',
        total_questions: 199,
      });

      const cfg = await fetchPublicConfig();
      expect(cfg?.examDurationMinutes).toBe(90);
      expect(cfg?.showLeaderboard).toBe(false);
      expect(cfg?.totalQuestions).toBe(199);
    });

    it('trả về null khi không gọi được', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));
      expect(await fetchPublicConfig()).toBeNull();
    });
  });

  describe('Admin operations', () => {
    it('đăng nhập nhận session token, các request sau dùng Bearer token', async () => {
      globalThis.fetch = mockJson({ success: true, token: 'tok-123', expiresAt: 999 });
      const auth = await authenticateAdmin('admin@toeic2026');
      expect(auth.success).toBe(true);
      expect(auth.token).toBe('tok-123');

      const loginInit = (globalThis.fetch as any).mock.calls[0][1];
      expect(loginInit.headers.Authorization).toBeUndefined();

      globalThis.fetch = mockJson({ success: true, configs: { exam_duration_minutes: '120' }, users: [] });
      const data = await fetchAdminData('tok-123');
      expect(data.success).toBe(true);

      const [dataUrl, dataInit] = (globalThis.fetch as any).mock.calls[0];
      expect(dataUrl).toBe(`${API}/api/admin/data`);
      expect(dataInit.method).toBe('GET');
      expect(dataInit.headers.Authorization).toBe('Bearer tok-123');
    });

    it('khóa / mở khóa học viên bằng token', async () => {
      globalThis.fetch = mockJson({ success: true, message: 'Banned' });
      const res = await setBanStatus('tok-123', 'bad@user.com', true, 'Spam');
      expect(res.success).toBe(true);

      const [url, init] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toBe(`${API}/api/admin/ban`);
      expect(init.headers.Authorization).toBe('Bearer tok-123');
      expect(JSON.parse(init.body)).toEqual({ email: 'bad@user.com', isBanned: true, reason: 'Spam' });
    });

    it('cập nhật cấu hình hệ thống', async () => {
      globalThis.fetch = mockJson({ success: true, rejected: [] });
      const res = await updateAdminConfigs('tok-123', { exam_duration_minutes: '90' });
      expect(res.success).toBe(true);
      expect((globalThis.fetch as any).mock.calls[0][0]).toBe(`${API}/api/admin/config`);
    });

    it('từ chối khi chưa cấu hình API', async () => {
      Storage.saveSettings({ apiBaseUrl: '' });
      const res = await fetchAdminData('tok-123');
      expect(res.success).toBe(false);
    });
  });
});
