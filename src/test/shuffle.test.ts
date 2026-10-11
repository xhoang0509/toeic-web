import { describe, it, expect } from 'vitest';
import { shuffleArray, shuffleToeicQuestions } from '../lib/shuffle';
import type { Question } from '../data/types';

describe('Shuffle Utilities (lib/shuffle.ts)', () => {
  it('shuffleArray preserves length and elements', () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = shuffleArray(list);
    expect(shuffled).toHaveLength(list.length);
    expect(new Set(shuffled)).toEqual(new Set(list));
  });

  it('shuffleToeicQuestions preserves total count and clusters shared media', () => {
    const mockQuestions: Question[] = [
      {
        id: 'q1',
        questionNumber: 1,
        partId: 1,
        partName: 'Part 1',
        skill: 'Listening',
        type: 'mc',
        question: 'Q1',
        options: [{ letter: 'A', text: 'Opt A' }],
        mediaFiles: [{ type: 'audio', file: 'sound-shared.mp3' }],
      },
      {
        id: 'q2',
        questionNumber: 2,
        partId: 1,
        partName: 'Part 1',
        skill: 'Listening',
        type: 'mc',
        question: 'Q2',
        options: [{ letter: 'A', text: 'Opt A' }],
        mediaFiles: [{ type: 'audio', file: 'sound-shared.mp3' }],
      },
      {
        id: 'q3',
        questionNumber: 3,
        partId: 1,
        partName: 'Part 1',
        skill: 'Listening',
        type: 'mc',
        question: 'Q3',
        options: [{ letter: 'A', text: 'Opt A' }],
        mediaFiles: [{ type: 'audio', file: 'sound-unique.mp3' }],
      },
      {
        id: 'q4',
        questionNumber: 4,
        partId: 5,
        partName: 'Part 5',
        skill: 'Reading',
        type: 'mc',
        question: 'Q4',
        options: [
          { letter: 'A', text: 'apple' },
          { letter: 'B', text: 'banana' },
          { letter: 'C', text: 'cherry', isCorrect: true },
        ],
        correctLetter: 'C',
      },
    ];

    const shuffled = shuffleToeicQuestions(mockQuestions, {
      keepPartsInOrder: true,
      shuffleReadingOptions: true,
    });

    expect(shuffled).toHaveLength(mockQuestions.length);

    // Q1 and Q2 share 'sound-shared.mp3', so they must remain adjacent in the array
    const idx1 = shuffled.findIndex((q) => q.id === 'q1');
    const idx2 = shuffled.findIndex((q) => q.id === 'q2');
    expect(Math.abs(idx1 - idx2)).toBe(1);

    // Part 1 questions must precede Part 5 question
    const idx4 = shuffled.findIndex((q) => q.id === 'q4');
    expect(idx4).toBeGreaterThan(idx1);
    expect(idx4).toBeGreaterThan(idx2);
  });
});
