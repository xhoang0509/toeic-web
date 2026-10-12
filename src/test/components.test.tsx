import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RadarSkillChart } from '../components/react/RadarSkillChart';
import { QuestionCard } from '../components/react/QuestionCard';
import { PracticeRunner } from '../components/react/PracticeRunner';
import { Storage } from '../lib/storage';
import type { Question } from '../data/types';

const API = 'https://toeic-api.example.workers.dev';

function mockFetch(payload: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  } as any);
}

describe('React Islands Components', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    Storage.saveSettings({ apiBaseUrl: API });
  });

  describe('RadarSkillChart', () => {
    it('renders 7 skill parts and CEFR badge', () => {
      const accuracy = { 1: 90, 2: 85, 3: 80, 4: 75, 5: 70, 6: 65, 7: 60 };
      render(<RadarSkillChart partAccuracy={accuracy} totalScaledScore={850} />);

      expect(screen.getByText(/Phân Tích 7 Kỹ Năng/i)).toBeInTheDocument();
      expect(screen.getByText('C1')).toBeInTheDocument();
      expect(screen.getByText(/Part 1: Tranh/i)).toBeInTheDocument();
      expect(screen.getByText(/Part 7: Đọc hiểu/i)).toBeInTheDocument();
    });

    it('vẽ nhãn từng Part trên biểu đồ radar kèm tỉ lệ đúng', () => {
      render(<RadarSkillChart partAccuracy={{ 3: 42 }} totalScaledScore={500} />);

      // Trước đây nhãn SVG đọc sai thuộc tính nên hiển thị "undefined (42%)"
      expect(screen.getByText('Part 3 (42%)')).toBeInTheDocument();
      expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
    });
  });

  describe('QuestionCard', () => {
    const mockQuestion: Question = {
      id: 'q-test-1',
      questionNumber: 1,
      partId: 1,
      partName: 'Part 1 - Mô tả tranh',
      skill: 'Listening',
      question: 'Chọn mô tả phù hợp nhất.',
      options: [
        { letter: 'A', text: 'She is walking.' },
        { letter: 'B', text: 'She is reading.' },
      ],
    };

    it('renders question prompt and options', () => {
      const onSelect = vi.fn();
      render(<QuestionCard question={mockQuestion} onSelectOption={onSelect} mode="practice" />);

      expect(screen.getByText('Chọn mô tả phù hợp nhất.')).toBeInTheDocument();
      expect(screen.getByText('She is walking.')).toBeInTheDocument();

      fireEvent.click(screen.getByText('She is walking.'));
      expect(onSelect).toHaveBeenCalledWith('A');
    });

    it('không tiết lộ đáp án khi server chưa chấm', () => {
      render(
        <QuestionCard
          question={mockQuestion}
          selectedLetter="B"
          onSelectOption={() => {}}
          mode="practice"
          showInstantAnswer={true}
        />
      );

      expect(screen.queryByText(/Xem lời giải thích/i)).not.toBeInTheDocument();
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

      fireEvent.click(screen.getByText(/Xem lời giải thích/i));
      expect(screen.getByText(/Cô gái đang đi bộ/i)).toBeInTheDocument();
      expect(screen.getByText('A. She is walking.')).toBeInTheDocument();
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
        question: 'Practice Question 1',
        options: [
          { letter: 'A', text: 'Option A' },
          { letter: 'B', text: 'Option B' },
        ],
      },
    ];

    it('chấm đáp án qua server rồi hiển thị giải thích', async () => {
      globalThis.fetch = mockFetch({
        success: true,
        isCorrect: false,
        correctLetter: 'B',
        explanation: 'Detailed explanation for Q1',
      });

      render(<PracticeRunner questions={mockQuestions} />);

      expect(screen.getByText('Practice Question 1')).toBeInTheDocument();
      expect(screen.getByText('Hiện đáp án: BẬT')).toBeInTheDocument();
      expect(screen.queryByText(/Xem lời giải thích/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Option A'));

      await waitFor(() => expect(screen.getByText(/Xem lời giải thích/i)).toBeInTheDocument());

      fireEvent.click(screen.getByText(/Xem lời giải thích/i));
      expect(screen.getByText(/Detailed explanation for Q1/i)).toBeInTheDocument();

      // Câu trả lời sai phải được ghi vào Sổ Tay Câu Sai kèm đáp án đúng
      const mistakes = Storage.getMistakes();
      expect(mistakes).toHaveLength(1);
      expect(mistakes[0].correctLetter).toBe('B');
    });

    it('hiện thông báo lỗi khi không chấm được đáp án', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

      render(<PracticeRunner questions={mockQuestions} />);
      fireEvent.click(screen.getByText('Option A'));

      await waitFor(() => expect(screen.getByText(/Không thể kết nối/i)).toBeInTheDocument());
      expect(screen.queryByText(/Xem lời giải thích/i)).not.toBeInTheDocument();
    });

    it('tắt chế độ hiện đáp án thì không gọi server', async () => {
      globalThis.fetch = mockFetch({ success: true, isCorrect: true, correctLetter: 'A', explanation: 'x' });

      render(<PracticeRunner questions={mockQuestions} />);

      fireEvent.click(screen.getByText('Hiện đáp án: BẬT'));
      expect(screen.getByText('Hiện đáp án: TẮT')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Option A'));
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(screen.queryByText(/Xem lời giải thích/i)).not.toBeInTheDocument();

      // Bật lại thì chấm nốt câu đang xem
      fireEvent.click(screen.getByText('Hiện đáp án: TẮT'));
      await waitFor(() => expect(screen.getByText(/Xem lời giải thích/i)).toBeInTheDocument());
    });

    it('không xáo trộn lại bộ đề sau mỗi lần chọn đáp án', async () => {
      globalThis.fetch = mockFetch({ success: true, isCorrect: true, correctLetter: 'A', explanation: 'x' });

      const readingQuestions: Question[] = Array.from({ length: 6 }, (_, i) => ({
        id: `q-r-${i}`,
        questionNumber: i + 1,
        partId: 5,
        partName: 'Part 5',
        skill: 'Reading',
        question: `Reading question ${i + 1}`,
        options: [
          { letter: 'A', text: `apple ${i}` },
          { letter: 'B', text: `banana ${i}` },
        ],
      }));

      render(<PracticeRunner questions={readingQuestions} />);
      fireEvent.click(screen.getByText('Xáo trộn: TẮT'));

      const firstQuestion = screen.getByText(/Reading question/i).textContent;
      fireEvent.click(screen.getAllByText(/apple|banana/i)[0]);

      await waitFor(() => expect(screen.getByText(/Xem lời giải thích/i)).toBeInTheDocument());
      expect(screen.getByText(/Reading question/i).textContent).toBe(firstQuestion);
    });
  });
});
