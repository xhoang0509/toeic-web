import { describe, it, expect } from 'vitest';
import {
  shuffleArray,
  shuffleToeicQuestions,
  toOriginalLetter,
  toDisplayedLetter,
  mapAnswersToOriginalLetters,
} from '../lib/shuffle';
import type { Question } from '../data/types';

const listeningQuestion = (id: string, questionNumber: number, file: string): Question => ({
  id,
  questionNumber,
  partId: 1,
  partName: 'Part 1',
  skill: 'Listening',
  question: `Q${questionNumber}`,
  options: [
    { letter: 'A', text: 'A' },
    { letter: 'B', text: 'B' },
    { letter: 'C', text: 'C' },
  ],
  mediaFiles: [{ type: 'audio', file }],
});

const readingQuestion: Question = {
  id: 'q4',
  questionNumber: 4,
  partId: 5,
  partName: 'Part 5',
  skill: 'Reading',
  question: 'Q4',
  options: [
    { letter: 'A', text: 'apple' },
    { letter: 'B', text: 'banana' },
    { letter: 'C', text: 'cherry' },
    { letter: 'D', text: 'durian' },
  ],
};

describe('Shuffle Utilities (lib/shuffle.ts)', () => {
  it('shuffleArray preserves length and elements', () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = shuffleArray(list);
    expect(shuffled).toHaveLength(list.length);
    expect(new Set(shuffled)).toEqual(new Set(list));
  });

  it('preserves total count, clusters shared media and keeps parts in order', () => {
    const mockQuestions: Question[] = [
      listeningQuestion('q1', 1, 'sound-shared.mp3'),
      listeningQuestion('q2', 2, 'sound-shared.mp3'),
      listeningQuestion('q3', 3, 'sound-unique.mp3'),
      readingQuestion,
    ];

    const shuffled = shuffleToeicQuestions(mockQuestions, {
      keepPartsInOrder: true,
      shuffleReadingOptions: true,
    });

    expect(shuffled).toHaveLength(mockQuestions.length);

    const idx1 = shuffled.findIndex((q) => q.id === 'q1');
    const idx2 = shuffled.findIndex((q) => q.id === 'q2');
    expect(Math.abs(idx1 - idx2)).toBe(1);

    const idx4 = shuffled.findIndex((q) => q.id === 'q4');
    expect(idx4).toBeGreaterThan(idx1);
    expect(idx4).toBeGreaterThan(idx2);
  });

  it('keeps Listening options untouched (nội dung nằm trong audio)', () => {
    const shuffled = shuffleToeicQuestions([listeningQuestion('q1', 1, 'a.mp3')], {
      shuffleReadingOptions: true,
    });

    expect(shuffled[0].options.map((o) => o.letter)).toEqual(['A', 'B', 'C']);
    expect(shuffled[0].options.every((o) => o.originalLetter === undefined)).toBe(true);
  });

  it('records the original letter of every shuffled Reading option', () => {
    const [shuffled] = shuffleToeicQuestions([readingQuestion], {
      shuffleReadingOptions: true,
    });

    expect(shuffled.options.map((o) => o.letter)).toEqual(['A', 'B', 'C', 'D']);

    // Mỗi nhãn hiển thị phải trỏ về đúng nhãn gốc của nội dung đáp án
    const originalByText = new Map(readingQuestion.options.map((o) => [o.text, o.letter]));
    for (const option of shuffled.options) {
      expect(option.originalLetter).toBe(originalByText.get(option.text));
    }
  });

  it('quy đổi nhãn hiển thị ↔ nhãn gốc để server chấm điểm đúng', () => {
    const [shuffled] = shuffleToeicQuestions([readingQuestion], {
      shuffleReadingOptions: true,
    });

    const cherryDisplayed = shuffled.options.find((o) => o.text === 'cherry')!.letter;

    // Thí sinh bấm nhãn hiển thị → gửi lên server nhãn gốc 'C'
    expect(toOriginalLetter(shuffled, cherryDisplayed)).toBe('C');
    // Server trả về đáp án đúng 'C' → giao diện tô sáng nhãn đang hiển thị
    expect(toDisplayedLetter(shuffled, 'C')).toBe(cherryDisplayed);
  });

  it('mapAnswersToOriginalLetters chuyển toàn bộ bài làm sang nhãn gốc', () => {
    const [shuffled] = shuffleToeicQuestions([readingQuestion], {
      shuffleReadingOptions: true,
    });
    const bananaDisplayed = shuffled.options.find((o) => o.text === 'banana')!.letter;

    const mapped = mapAnswersToOriginalLetters([shuffled], { q4: bananaDisplayed });
    expect(mapped).toEqual({ q4: 'B' });
  });

  it('giữ nguyên nhãn cho câu hỏi không nằm trong danh sách', () => {
    expect(mapAnswersToOriginalLetters([], { 'unknown-q': 'D' })).toEqual({ 'unknown-q': 'D' });
  });
});
