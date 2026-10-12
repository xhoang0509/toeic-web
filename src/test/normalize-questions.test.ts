import { describe, it, expect } from 'vitest';
import { normalizeQuestionBank, toPublicQuestion } from '../../scripts/normalize-questions.mjs';
import publicBank from '../data/questions.public.json';
import fullBank from '../data/questions.full.json';

const rawMultiBlank = {
  id: '{AAA}',
  questionNumber: 152,
  partId: 6,
  partName: 'Part 6 - Điền đoạn văn',
  skill: 'Reading',
  type: 'mct',
  mediaFiles: [],
  question:
    'Choose one correct answer in each drop-down list\n\nPassage:\nBakery news [___Blank #1___] daily and [___Blank #2___] weekly.',
  options: [
    {
      blankNumber: 1,
      options: [
        { letter: 'A', text: 'precise', isCorrect: false },
        { letter: 'B', text: 'precisely', isCorrect: true },
      ],
      correctAnswer: 'B. precisely',
    },
    {
      blankNumber: 2,
      options: [
        { letter: 'A', text: 'inventory', isCorrect: true },
        { letter: 'B', text: 'scheduling', isCorrect: false },
      ],
      correctAnswer: 'A. inventory',
    },
  ],
  explanation: 'Đọc ngữ cảnh toàn đoạn.',
};

const rawSimple = {
  id: '{BBB}',
  questionNumber: 1,
  partId: 1,
  partName: 'Part 1 - Mô tả tranh',
  skill: 'Listening',
  type: 'mc',
  mediaFiles: [{ type: 'audio', file: 'quiz1/a.mp3' }],
  question: 'Chọn mô tả phù hợp.',
  options: [
    { letter: 'A', text: 'A', isCorrect: false },
    { letter: 'B', text: 'B', isCorrect: true },
  ],
  correctLetter: 'B',
  explanation: 'Đáp án B.',
};

describe('Chuẩn hóa ngân hàng câu hỏi (scripts/normalize-questions.mjs)', () => {
  it('tách câu hỏi Part 6 nhiều chỗ trống thành từng câu hỏi độc lập', () => {
    const normalized = normalizeQuestionBank([rawMultiBlank]);

    expect(normalized).toHaveLength(2);
    expect(normalized.map((q: any) => q.id)).toEqual(['{AAA}#1', '{AAA}#2']);

    // Mỗi blank trở thành 1 câu hỏi có đúng 1 đáp án đúng và danh sách lựa chọn phẳng
    expect(normalized[0].correctLetter).toBe('B');
    expect(normalized[1].correctLetter).toBe('A');
    expect(normalized[0].options.every((opt: any) => typeof opt.text === 'string' && opt.letter)).toBe(true);

    // Passage dùng chung được tách khỏi đề bài
    expect(normalized[0].passage).toContain('Bakery news');
    expect(normalized[0].question).toContain('Blank #1');
    expect(normalized[0].question).not.toContain('Passage:');
  });

  it('đánh số lại toàn bộ đề theo thứ tự Part 1 → Part 7', () => {
    const normalized = normalizeQuestionBank([rawMultiBlank, rawSimple]);

    expect(normalized.map((q: any) => q.questionNumber)).toEqual([1, 2, 3]);
    expect(normalized[0].partId).toBe(1);
    expect(normalized[2].partId).toBe(6);
  });

  it('artifact public không chứa đáp án hay giải thích', () => {
    const [normalized] = normalizeQuestionBank([rawSimple]);
    const publicQuestion = toPublicQuestion(normalized) as any;

    expect(publicQuestion.correctLetter).toBeUndefined();
    expect(publicQuestion.explanation).toBeUndefined();
    expect(publicQuestion.options.every((opt: any) => opt.isCorrect === undefined)).toBe(true);
    expect(publicQuestion.question).toBe('Chọn mô tả phù hợp.');
  });
});

describe('Artifact ngân hàng câu hỏi đã commit', () => {
  it('questions.public.json không rò rỉ đáp án', () => {
    const serialized = JSON.stringify(publicBank);
    expect(serialized).not.toContain('correctLetter');
    expect(serialized).not.toContain('isCorrect');
    expect(serialized).not.toContain('explanation');
  });

  it('public và full có cùng số câu hỏi và cùng id', () => {
    expect(publicBank.length).toBe(fullBank.length);
    expect(publicBank.map((q: any) => q.id)).toEqual(fullBank.map((q: any) => q.id));
  });

  it('mọi câu hỏi đều có đáp án đúng nằm trong danh sách lựa chọn', () => {
    for (const question of fullBank as any[]) {
      expect(question.correctLetter, `câu ${question.questionNumber}`).toBeTruthy();
      expect(question.options.some((opt: any) => opt.letter === question.correctLetter)).toBe(true);
    }
  });

  it('mọi lựa chọn hiển thị đều có nhãn và nội dung', () => {
    for (const question of publicBank as any[]) {
      expect(question.options.length).toBeGreaterThanOrEqual(2);
      for (const option of question.options) {
        expect(option.letter).toBeTruthy();
        expect(option.text).toBeTruthy();
      }
    }
  });
});
