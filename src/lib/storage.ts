import type { CandidateInfo, ExamResult, MistakeItem } from '../data/types';

const STORAGE_CANDIDATE_KEY = 'toeic_candidate_info_v2';
const STORAGE_HISTORY_KEY = 'toeic_exam_history_v3';
const STORAGE_MISTAKES_KEY = 'toeic_mistakes_notebook_v2';
const STORAGE_SETTINGS_KEY = 'toeic_custom_settings_v3';

/** Địa chỉ Cloudflare Worker API, nhúng lúc build qua biến môi trường PUBLIC_API_BASE_URL */
const BUILD_TIME_API_BASE_URL = ((import.meta.env.PUBLIC_API_BASE_URL as string) || '').replace(/\/+$/, '');

export interface AppSettings {
  /** Cho phép ghi đè endpoint API khi phát triển cục bộ (mặc định lấy từ biến môi trường) */
  apiBaseUrl: string;
  showInstantAnswer: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiBaseUrl: BUILD_TIME_API_BASE_URL,
  showInstantAnswer: true,
};

export const Storage = {
  getCandidate(): CandidateInfo | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(STORAGE_CANDIDATE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setCandidate(info: CandidateInfo): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_CANDIDATE_KEY, JSON.stringify(info));
    } catch (e) {
      console.warn('Error saving candidate info', e);
    }
  },

  /**
   * Lịch sử thi của chính thiết bị này. Bảng Xếp Hạng toàn hệ thống lấy từ Cloudflare D1
   * (xem lib/api.ts → fetchLeaderboard), localStorage chỉ giữ lại kết quả cá nhân.
   */
  getExamHistory(): ExamResult[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  addExamResult(result: ExamResult): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getExamHistory();
      const updated = [result, ...current.filter((item) => item.id !== result.id)];
      updated.sort((a, b) => {
        if (b.totalScaledScore !== a.totalScaledScore) return b.totalScaledScore - a.totalScaledScore;
        return a.timeSpentSeconds - b.timeSpentSeconds;
      });
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updated.slice(0, 50)));
    } catch (e) {
      console.warn('Error saving exam result', e);
    }
  },

  getMistakes(): MistakeItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_MISTAKES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  /**
   * Lưu một câu sai. `meta` chứa đáp án đúng + giải thích do server trả về sau khi chấm,
   * nhờ đó Sổ Tay Câu Sai vẫn ôn lại được mà client không cần giữ sẵn đáp án của cả đề.
   */
  addMistake(
    questionId: string,
    selectedLetter: string,
    meta?: { correctLetter?: string; explanation?: string }
  ): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getMistakes();
      const existing = current.find((m) => m.questionId === questionId);

      if (existing) {
        // Bổ sung đáp án / giải thích nếu lần lưu trước chưa có
        existing.selectedLetter = selectedLetter;
        if (meta?.correctLetter) existing.correctLetter = meta.correctLetter;
        if (meta?.explanation) existing.explanation = meta.explanation;
      } else {
        current.unshift({
          questionId,
          selectedLetter,
          timestamp: Date.now(),
          ...(meta?.correctLetter ? { correctLetter: meta.correctLetter } : {}),
          ...(meta?.explanation ? { explanation: meta.explanation } : {}),
        });
      }

      localStorage.setItem(STORAGE_MISTAKES_KEY, JSON.stringify(current));
    } catch (e) {
      console.warn('Error adding mistake', e);
    }
  },

  removeMistake(questionId: string): void {
    if (typeof window === 'undefined') return;
    try {
      const updated = this.getMistakes().filter((m) => m.questionId !== questionId);
      localStorage.setItem(STORAGE_MISTAKES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Error removing mistake', e);
    }
  },

  clearMistakes(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_MISTAKES_KEY);
    } catch (e) {
      console.warn('Error clearing mistakes', e);
    }
  },

  getSettings(): AppSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        apiBaseUrl: String(parsed.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl).replace(/\/+$/, ''),
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: Partial<AppSettings>): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getSettings();
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
    } catch (e) {
      console.warn('Error saving settings', e);
    }
  },
};
