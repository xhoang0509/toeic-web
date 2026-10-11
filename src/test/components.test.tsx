import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RadarSkillChart } from '../components/react/RadarSkillChart';
import { QuestionCard } from '../components/react/QuestionCard';
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
        { letter: 'A', text: 'She is walking.' },
        { letter: 'B', text: 'She is reading.' },
      ],
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
  });
});
