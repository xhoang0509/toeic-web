import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncExamResultToWebhook } from '../lib/webhook';
import { Storage } from '../lib/storage';
import type { ExamResult } from '../data/types';

describe('Webhook Sync (lib/webhook.ts)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const mockResult: ExamResult = {
    id: 'EXAM-99',
    candidateName: 'Trần Văn Bình',
    candidateId: 'binh@test.com',
    targetScore: '800+',
    totalCorrect: 150,
    totalQuestions: 183,
    listeningCorrect: 75,
    readingCorrect: 75,
    scaledListening: 410,
    scaledReading: 400,
    totalScaledScore: 810,
    cefrLevel: 'C1',
    partAccuracy: { 1: 90 },
    timeSpentSeconds: 3600,
    completedAt: '11/10/2026',
  };

  it('returns false if webhookUrl is missing', async () => {
    Storage.saveSettings({ webhookUrl: '', autoSync: true });
    const success = await syncExamResultToWebhook(mockResult);
    expect(success).toBe(false);
  });

  it('generates SHA-256 signature and sends payload if webhookUrl configured', async () => {
    Storage.saveSettings({
      webhookUrl: 'https://script.google.com/test/exec',
      secretToken: 'my_secret_token_123',
      autoSync: true,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as any);

    const success = await syncExamResultToWebhook(mockResult);
    expect(success).toBe(true);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://script.google.com/test/exec',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });
});
