import type { CandidateInfo, ExamResult, MistakeItem } from '../data/types';

const STORAGE_CANDIDATE_KEY = 'toeic_candidate_info_v2';
const STORAGE_LEADERBOARD_KEY = 'toeic_leaderboard_records_v2';
const STORAGE_MISTAKES_KEY = 'toeic_mistakes_notebook_v2';
const STORAGE_SETTINGS_KEY = 'toeic_custom_settings_v2';

const DEFAULT_WEBHOOK_URL = (import.meta.env.PUBLIC_WEBHOOK_URL as string) || '';
const DEFAULT_SECRET_TOKEN = (import.meta.env.PUBLIC_SECRET_TOKEN as string) || '';

export interface AppSettings {
  webhookUrl: string;
  secretToken?: string;
  autoSync: boolean;
  showInstantAnswer: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  webhookUrl: DEFAULT_WEBHOOK_URL,
  secretToken: DEFAULT_SECRET_TOKEN,
  autoSync: true,
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

  getLeaderboard(): ExamResult[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_LEADERBOARD_KEY);
      if (!raw) {
        // Return default mockup entries
        return [
          {
            id: 'mock-1',
            candidateName: 'Đặng Tuấn Anh',
            candidateId: 'HV-8902',
            targetScore: '900+',
            totalCorrect: 172,
            totalQuestions: 183,
            listeningCorrect: 88,
            readingCorrect: 84,
            scaledListening: 485,
            scaledReading: 470,
            totalScaledScore: 955,
            cefrLevel: 'C1+',
            partAccuracy: { 1: 100, 2: 98, 3: 93, 4: 93, 5: 95, 6: 88, 7: 92 },
            timeSpentSeconds: 5820,
            completedAt: '11/10/2026 09:15',
          },
          {
            id: 'mock-2',
            candidateName: 'Trần Thị Mai',
            candidateId: 'HV-4412',
            targetScore: '800+',
            totalCorrect: 156,
            totalQuestions: 183,
            listeningCorrect: 81,
            readingCorrect: 75,
            scaledListening: 450,
            scaledReading: 425,
            totalScaledScore: 875,
            cefrLevel: 'C1',
            partAccuracy: { 1: 92, 2: 90, 3: 87, 4: 87, 5: 85, 6: 75, 7: 83 },
            timeSpentSeconds: 6140,
            completedAt: '10/10/2026 16:40',
          },
          {
            id: 'mock-3',
            candidateName: 'Lê Hoàng Nam',
            candidateId: 'HV-3109',
            targetScore: '800+',
            totalCorrect: 142,
            totalQuestions: 183,
            listeningCorrect: 76,
            readingCorrect: 66,
            scaledListening: 420,
            scaledReading: 380,
            totalScaledScore: 800,
            cefrLevel: 'C1',
            partAccuracy: { 1: 92, 2: 86, 3: 80, 4: 80, 5: 78, 6: 75, 7: 75 },
            timeSpentSeconds: 6480,
            completedAt: '09/10/2026 14:22',
          },
        ];
      }
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  addExamResult(result: ExamResult): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getLeaderboard();
      const updated = [result, ...current.filter((item) => item.id !== result.id)];
      // Sort by totalScaledScore desc, then timeSpentSeconds asc
      updated.sort((a, b) => {
        if (b.totalScaledScore !== a.totalScaledScore) {
          return b.totalScaledScore - a.totalScaledScore;
        }
        return a.timeSpentSeconds - b.timeSpentSeconds;
      });
      localStorage.setItem(STORAGE_LEADERBOARD_KEY, JSON.stringify(updated.slice(0, 100)));
    } catch (e) {
      console.warn('Error saving exam result', e);
    }
  },

  getMistakes(): MistakeItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_MISTAKES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  addMistake(questionId: string, selectedLetter: string): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getMistakes();
      if (!current.some((m) => m.questionId === questionId)) {
        current.unshift({ questionId, selectedLetter, timestamp: Date.now() });
        localStorage.setItem(STORAGE_MISTAKES_KEY, JSON.stringify(current));
      }
    } catch (e) {
      console.warn('Error adding mistake', e);
    }
  },

  removeMistake(questionId: string): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getMistakes();
      const updated = current.filter((m) => m.questionId !== questionId);
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
        webhookUrl: parsed.webhookUrl || DEFAULT_SETTINGS.webhookUrl,
        secretToken: parsed.secretToken || DEFAULT_SETTINGS.secretToken,
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
