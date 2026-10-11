import { describe, it, expect, beforeEach } from 'vitest';
import { Storage } from '../lib/storage';
import type { CandidateInfo, ExamResult } from '../data/types';

describe('Storage Adapter (lib/storage.ts)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Candidate Profile', () => {
    it('saves and retrieves candidate info', () => {
      expect(Storage.getCandidate()).toBeNull();

      const candidate: CandidateInfo = {
        name: 'Nguyễn Văn An',
        emailOrCode: 'an.nguyen@test.com',
        targetScore: '800+',
      };
      Storage.setCandidate(candidate);

      const retrieved = Storage.getCandidate();
      expect(retrieved).toEqual(candidate);
    });
  });

  describe('Mistakes Notebook', () => {
    it('adds mistake without duplicate', () => {
      Storage.addMistake('q-101', 'A');
      Storage.addMistake('q-101', 'A'); // duplicate add
      Storage.addMistake('q-102', 'B');

      const mistakes = Storage.getMistakes();
      expect(mistakes).toHaveLength(2);
      expect(mistakes[0].questionId).toBe('q-102');
    });

    it('removes single mistake and clears all mistakes', () => {
      Storage.addMistake('q-1', 'A');
      Storage.addMistake('q-2', 'B');
      Storage.removeMistake('q-1');

      expect(Storage.getMistakes()).toHaveLength(1);
      expect(Storage.getMistakes()[0].questionId).toBe('q-2');

      Storage.clearMistakes();
      expect(Storage.getMistakes()).toHaveLength(0);
    });
  });

  describe('Settings', () => {
    it('returns default settings when empty', () => {
      const settings = Storage.getSettings();
      expect(settings).toBeDefined();
      expect(settings.autoSync).toBe(true);
      expect(settings.showInstantAnswer).toBe(true);
    });

    it('saves and merges settings updates', () => {
      Storage.saveSettings({
        webhookUrl: 'https://example.com/webhook',
        showInstantAnswer: false,
      });

      const updated = Storage.getSettings();
      expect(updated.webhookUrl).toBe('https://example.com/webhook');
      expect(updated.showInstantAnswer).toBe(false);
    });
  });

  describe('Leaderboard', () => {
    it('returns default mock items if empty', () => {
      const list = Storage.getLeaderboard();
      expect(list.length).toBeGreaterThan(0);
    });

    it('adds result and sorts by score descending, duration ascending', () => {
      const res1: ExamResult = {
        id: 'res-1',
        candidateName: 'Test 1',
        candidateId: 'test1@mail.com',
        targetScore: '650+',
        totalCorrect: 100,
        totalQuestions: 183,
        listeningCorrect: 50,
        readingCorrect: 50,
        scaledListening: 250,
        scaledReading: 250,
        totalScaledScore: 500,
        cefrLevel: 'B1',
        partAccuracy: {},
        timeSpentSeconds: 3000,
        completedAt: '11/10/2026',
      };

      const res2: ExamResult = {
        id: 'res-2',
        candidateName: 'Test 2',
        candidateId: 'test2@mail.com',
        targetScore: '900+',
        totalCorrect: 180,
        totalQuestions: 183,
        listeningCorrect: 90,
        readingCorrect: 90,
        scaledListening: 490,
        scaledReading: 490,
        totalScaledScore: 980,
        cefrLevel: 'C1+',
        partAccuracy: {},
        timeSpentSeconds: 2500,
        completedAt: '11/10/2026',
      };

      Storage.addExamResult(res1);
      Storage.addExamResult(res2);

      const sorted = Storage.getLeaderboard();
      expect(sorted[0].id).toBe('res-2');
    });
  });
});
