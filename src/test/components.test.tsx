import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RadarSkillChart } from '../components/react/RadarSkillChart';
import { QuestionCard } from '../components/react/QuestionCard';
import { PracticeRunner } from '../components/react/PracticeRunner';
import type { Question } from '../data/types';

describe('React Islands Components', () => {
  describe('RadarSkillChart', () => {
    it('renders 7 skill parts and CEFR badge', () => {
      const accuracy = { 1: 90, 2: 85, 3: 80, 4: 75, 5: 70, 6: 65, 7: 60 };
      render(<RadarSkillChart partAccuracy={accuracy} totalScaledScore={850} />);

      expect(screen.getByText(/Phân Tích 7 Kỹ Năng/i)).toBeInTheDocument();
      expect(screen.getByText('C1')).toBeInTheDocument();
      expect(screen.getByText(/Part 1: Tranh/i)).toBeInTheDocument();
      expect(screen.getByText(/Part 7: Đọc hiểu/i)).toBeInTheDocument();
    });
  });

  describe('QuestionCard', () => {
    const mockQuestion: Question = {
      id: 'q-test-1',
      questionNumber: 1,
      partId: 1,
      partName: 'Part 1 - Mô tả tranh',
      skill: 'Listening',
      type: 'mc',
      question: 'Chọn mô tả phù hợp nhất.',
      options: [
        { letter: 'A', text: 'She is walking.', isCorrect: true },
        { letter: 'B', text: 'She is reading.', isCorrect: false },
      ],
      correctLetter: 'A',
      correctAnswer: 'A. She is walking.',
      explanation: 'Cô gái đang đi bộ.',
    };

    it('renders question prompt and options without revealing answer', () => {
      const onSelect = vi.fn();
      render(
        <QuestionCard
          question={mockQuestion}
          onSelectOption={onSelect}
          mode="practice"
        />
      );

      expect(screen.getByText('Chọn mô tả phù hợp nhất.')).toBeInTheDocument();
      expect(screen.getByText('She is walking.')).toBeInTheDocument();

      fireEvent.click(screen.getByText('She is walking.'));
      expect(onSelect).toHaveBeenCalledWith('A');
    });

    it('displays verified answer and explanation when provided', () => {
      render(
        <QuestionCard
          question={mockQuestion}
          selectedLetter="A"
          onSelectOption={() => {}}
          mode="practice"
          verifiedAnswer={{
            isCorrect: true,
            correctLetter: 'A',
            explanation: 'Cô gái đang đi bộ.',
          }}
        />
      );

      const expBtn = screen.getByText(/Xem lời giải thích/i);
      fireEvent.click(expBtn);
      expect(screen.getByText(/Cô gái đang đi bộ/i)).toBeInTheDocument();
    });

    it('reveals correct answer when showInstantAnswer is true and option is selected', () => {
      render(
        <QuestionCard
          question={mockQuestion}
          selectedLetter="B"
          onSelectOption={() => {}}
          mode="practice"
          showInstantAnswer={true}
        />
      );

      // Should show explanation toggle button because isAnswered is true and showInstantAnswer is true
      expect(screen.getByText(/Xem lời giải thích & Transcript/i)).toBeInTheDocument();
    });
  });

  describe('PracticeRunner', () => {
    const mockQuestions: Question[] = [
      {
        id: 'q-p-1',
        questionNumber: 1,
        partId: 1,
        partName: 'Part 1',
        skill: 'Listening',
        type: 'mc',
        question: 'Practice Question 1',
        options: [
          { letter: 'A', text: 'Option A' },
          { letter: 'B', text: 'Option B' },
        ],
        correctLetter: 'A',
        explanation: 'Detailed explanation for Q1',
      },
    ];

    it('immediately reveals answer on click when Hiện đáp án: BẬT is active', () => {
      render(<PracticeRunner questions={mockQuestions} />);

      expect(screen.getByText('Practice Question 1')).toBeInTheDocument();
      expect(screen.getByText('Hiện đáp án: BẬT')).toBeInTheDocument();

      // Before click, no explanation button
      expect(screen.queryByText(/Xem lời giải thích/i)).not.toBeInTheDocument();

      // Click option A
      fireEvent.click(screen.getByText('Option A'));

      // After click, explanation button is visible immediately
      expect(screen.getByText(/Xem lời giải thích & Transcript/i)).toBeInTheDocument();

      // Click explanation button
      fireEvent.click(screen.getByText(/Xem lời giải thích & Transcript/i));
      expect(screen.getByText(/Detailed explanation for Q1/i)).toBeInTheDocument();
    });

    it('toggles answer visibility when clicking toggle button', () => {
      render(<PracticeRunner questions={mockQuestions} />);

      // Turn OFF instant answer
      const toggleBtn = screen.getByText('Hiện đáp án: BẬT');
      fireEvent.click(toggleBtn);
      expect(screen.getByText('Hiện đáp án: TẮT')).toBeInTheDocument();

      // Click option A while OFF
      fireEvent.click(screen.getByText('Option A'));
      expect(screen.queryByText(/Xem lời giải thích/i)).not.toBeInTheDocument();

      // Turn back ON
      fireEvent.click(screen.getByText('Hiện đáp án: TẮT'));
      expect(screen.getByText('Hiện đáp án: BẬT')).toBeInTheDocument();

      // Now explanation should appear
      expect(screen.getByText(/Xem lời giải thích & Transcript/i)).toBeInTheDocument();
    });
  });
});
