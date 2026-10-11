import React, { useState, useEffect } from 'react';
import type { Question } from '../../data/types';
import { QuestionCard } from './QuestionCard';
import { Storage } from '../../lib/storage';
import { BookmarkX, Trash2, CheckCircle, RotateCcw } from 'lucide-react';

interface MistakesRunnerProps {
  allQuestions: Question[];
}

export const MistakesRunner: React.FC<MistakesRunnerProps> = ({ allQuestions }) => {
  const [mistakeList, setMistakeList] = useState<{ questionId: string; selectedLetter: string }[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    setMistakeList(Storage.getMistakes());
  }, []);

  const mistakeQuestions = allQuestions.filter((q) =>
    mistakeList.some((m) => m.questionId === q.id)
  );

  const currentQuestion = mistakeQuestions[currentIndex] || mistakeQuestions[0];

  const handleRemoveMistake = (questionId: string) => {
    Storage.removeMistake(questionId);
    setMistakeList((prev) => prev.filter((m) => m.questionId !== questionId));
    if (currentIndex >= mistakeQuestions.length - 1) {
      setCurrentIndex(Math.max(0, mistakeQuestions.length - 2));
    }
  };

  const handleClearAll = () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ câu hỏi trong Sổ tay câu sai không?')) {
      Storage.clearMistakes();
      setMistakeList([]);
    }
  };

  if (mistakeQuestions.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Sổ Tay Trống — Thật Tuyệt Vời!
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Bạn chưa có câu làm sai nào trong sổ tay. Khi luyện thi hoặc làm bài kiểm tra, các câu bạn trả lời sai sẽ tự động được lưu vào đây để ôn luyện lại.
        </p>
        <a
          href={`${import.meta.env.BASE_URL}/practice`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Bắt đầu luyện tập ngay
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Sổ Tay Câu Sai ({mistakeQuestions.length} câu)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Luyện tập làm lại các câu chưa đúng để củng cố lỗ hổng kiến thức
          </p>
        </div>

        <button
          type="button"
          onClick={handleClearAll}
          className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Xóa tất cả</span>
        </button>
      </div>

      {/* Question Card */}
      {currentQuestion && (
        <div className="space-y-4">
          <QuestionCard
            question={currentQuestion}
            selectedLetter={answers[currentQuestion.id]}
            onSelectOption={(letter) =>
              setAnswers((prev) => ({ ...prev, [currentQuestion.id]: letter }))
            }
            mode="practice"
            showInstantAnswer={true}
            isSavedMistake={true}
            onToggleMistake={() => handleRemoveMistake(currentQuestion.id)}
            questionIndex={currentIndex}
          />

          {/* Controls */}
          <div className="flex items-center justify-between pt-2 gap-3">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Câu trước
            </button>

            <button
              type="button"
              onClick={() => handleRemoveMistake(currentQuestion.id)}
              className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-100 transition-colors"
            >
              <BookmarkX className="w-4 h-4" />
              <span>Đã hiểu — Xóa khỏi sổ</span>
            </button>

            <button
              type="button"
              disabled={currentIndex === mistakeQuestions.length - 1}
              onClick={() => setCurrentIndex((prev) => Math.min(mistakeQuestions.length - 1, prev + 1))}
              className="px-4 py-2.5 rounded-xl bg-sky-600 text-white font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-sky-500 transition-colors shadow-sm"
            >
              Câu tiếp
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
