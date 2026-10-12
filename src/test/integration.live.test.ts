import { describe, it, expect, beforeAll } from 'vitest';
import { Storage } from '../lib/storage';
import { checkAnswerOnServer, fetchPublicConfig, fetchLeaderboard, gradeExamOnServer } from '../lib/api';
import { shuffleToeicQuestions, mapAnswersToOriginalLetters, toDisplayedLetter } from '../lib/shuffle';
import publicBank from '../data/questions.public.json';
import fullBank from '../data/questions.full.json';
import type { Question } from '../data/types';

/**
 * Kiểm thử tích hợp thật với Cloudflare Worker API.
 * Chỉ chạy khi có biến môi trường TOEIC_API_URL (CI build tĩnh sẽ bỏ qua):
 *
 *   TOEIC_API_URL=https://toeic-api.<sub>.workers.dev npx vitest run integration.live
 */
const API_URL = process.env.TOEIC_API_URL;
const liveDescribe = API_URL ? describe : describe.skip;

liveDescribe('Tích hợp thật với Cloudflare Worker + D1', () => {
  const questions = publicBank as Question[];
  const answerByQuestionId = new Map(
    (fullBank as { id: string; correctLetter: string }[]).map((q) => [q.id, q.correctLetter])
  );

  beforeAll(() => {
    Storage.saveSettings({ apiBaseUrl: API_URL! });
  });

  it('cấu hình công khai khớp số câu hỏi đã seed vào D1', async () => {
    const config = await fetchPublicConfig();
    expect(config).not.toBeNull();
    expect(config!.totalQuestions).toBe(questions.length);
    expect(config!.examDurationMinutes).toBeGreaterThan(0);
  });

  it('chấm đúng câu Reading sau khi đã xáo trộn nhãn đáp án', async () => {
    const readingQuestion = questions.find((q) => q.partId === 5)!;
    const [shuffled] = shuffleToeicQuestions([readingQuestion], { shuffleReadingOptions: true });

    const originalCorrect = answerByQuestionId.get(shuffled.id)!;
    const displayedCorrect = toDisplayedLetter(shuffled, originalCorrect);

    // Gửi nhãn gốc tương ứng với lựa chọn thí sinh bấm trên giao diện
    const mapped = mapAnswersToOriginalLetters([shuffled], { [shuffled.id]: displayedCorrect });
    const res = await checkAnswerOnServer(shuffled.id, mapped[shuffled.id]);

    expect(res.success).toBe(true);
    expect(res.isCorrect).toBe(true);
    expect(res.correctLetter).toBe(originalCorrect);
    expect(res.explanation).toBeTruthy();
  });

  it('báo sai khi gửi nhãn hiển thị mà chưa quy đổi (hồi quy của bug cũ)', async () => {
    // Tìm một câu Reading mà sau khi xáo trộn nhãn hiển thị khác nhãn gốc
    let mismatch: { question: Question; displayed: string; original: string } | null = null;

    for (let attempt = 0; attempt < 20 && !mismatch; attempt++) {
      for (const question of questions.filter((q) => q.partId === 5).slice(0, 10)) {
        const [shuffled] = shuffleToeicQuestions([question], { shuffleReadingOptions: true });
        const original = answerByQuestionId.get(shuffled.id)!;
        const displayed = toDisplayedLetter(shuffled, original);
        if (displayed !== original) {
          mismatch = { question: shuffled, displayed, original };
          break;
        }
      }
    }

    expect(mismatch).not.toBeNull();
    const res = await checkAnswerOnServer(mismatch!.question.id, mismatch!.displayed);
    expect(res.success).toBe(true);
    expect(res.isCorrect).toBe(false);
  });

  it('nộp bài thi: server chấm điểm và ghi vào Bảng Xếp Hạng', async () => {
    const shuffledExam = shuffleToeicQuestions(questions, {
      keepPartsInOrder: true,
      shuffleReadingOptions: true,
    });

    // Trả lời đúng toàn bộ Listening, bỏ trắng Reading → kiểm tra điểm từng phần
    const displayedAnswers: Record<string, string> = {};
    for (const question of shuffledExam) {
      if (question.skill !== 'Listening') continue;
      const original = answerByQuestionId.get(question.id)!;
      displayedAnswers[question.id] = toDisplayedLetter(question, original);
    }

    const stamp = Date.now();
    const res = await gradeExamOnServer(
      { name: 'ZZ Integration Test', emailOrCode: `it-${stamp}@test.local`, targetScore: '900+' },
      1234,
      mapAnswersToOriginalLetters(shuffledExam, displayedAnswers)
    );

    expect(res.success).toBe(true);
    expect(res.examResult!.totalQuestions).toBe(questions.length);
    expect(res.examResult!.scaledListening).toBe(495);
    expect(res.examResult!.listeningCorrect).toBe(questions.filter((q) => q.skill === 'Listening').length);
    expect(res.examResult!.readingCorrect).toBe(0);
    expect(Object.keys(res.reviewDetails!)).toHaveLength(questions.length);

    const leaderboard = await fetchLeaderboard(500);
    expect(leaderboard.success).toBe(true);
    expect(leaderboard.entries.some((entry) => entry.id === res.examResult!.id)).toBe(true);
  });
});
