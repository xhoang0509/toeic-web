import React, { useState, useEffect } from 'react';
import type { Question } from '../../data/types';
import { QuestionCard } from './QuestionCard';
import { Storage } from '../../lib/storage';
import { Eye, EyeOff, ChevronLeft, ChevronRight, Shuffle, AlertTriangle } from 'lucide-react';
import { shuffleToeicQuestions, toOriginalLetter, toDisplayedLetter } from '../../lib/shuffle';
import { checkAnswerOnServer } from '../../lib/api';

interface PracticeRunnerProps {
  questions: Question[];
  initialPartId?: number;
}

export const PracticeRunner: React.FC<PracticeRunnerProps> = ({
  questions,
  initialPartId,
}) => {
  const [selectedPart, setSelectedPart] = useState<number>(initialPartId || 0); // 0 = all
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showInstantAnswer, setShowInstantAnswer] = useState<boolean>(true);
  const [isShuffled, setIsShuffled] = useState<boolean>(false);
  const [savedMistakes, setSavedMistakes] = useState<Set<string>>(new Set());
  const [verifiedAnswers, setVerifiedAnswers] = useState<
    Record<string, { isCorrect: boolean; correctLetter: string; explanation: string }>
  >({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string>('');

  // Load mistake bookmarks & tùy chọn cá nhân
  useEffect(() => {
    const list = Storage.getMistakes();
    setSavedMistakes(new Set(list.map((m) => m.questionId)));
    setShowInstantAnswer(Storage.getSettings().showInstantAnswer);
  }, []);

  // useMemo phải phụ thuộc trực tiếp vào questions/selectedPart: nếu phụ thuộc vào một
  // mảng mới tạo mỗi lần render thì bộ đề sẽ bị xáo trộn lại sau từng lần chọn đáp án.
  const filteredQuestions = React.useMemo(() => {
    const base = selectedPart === 0 ? questions : questions.filter((q) => q.partId === selectedPart);
    return isShuffled
      ? shuffleToeicQuestions(base, { keepPartsInOrder: true, shuffleReadingOptions: true })
      : base;
  }, [questions, selectedPart, isShuffled]);

  const currentQuestion = filteredQuestions[currentIndex] || filteredQuestions[0];

  /** Hỏi server đáp án đúng cho 1 câu (không phụ thuộc state showInstantAnswer) */
  const verifyAnswer = async (questionId: string, letter: string) => {
    const question = filteredQuestions.find((item) => item.id === questionId);
    if (!question) return;

    // Đáp án đúng chỉ tồn tại trên server; nhãn hiển thị có thể đã xáo trộn nên phải quy đổi.
    setVerifyingId(questionId);
    try {
      const candidate = Storage.getCandidate();
      const originalLetter = toOriginalLetter(question, letter);
      const res = await checkAnswerOnServer(questionId, originalLetter, candidate?.emailOrCode);

      if (!res.success || !res.correctLetter) {
        setCheckError(res.error || 'Không chấm được câu này. Vui lòng kiểm tra kết nối mạng.');
        return;
      }

      const isCorrect = Boolean(res.isCorrect);
      setVerifiedAnswers((prev) => ({
        ...prev,
        [questionId]: {
          isCorrect,
          correctLetter: toDisplayedLetter(question, res.correctLetter!),
          explanation: res.explanation || '',
        },
      }));

      if (!isCorrect) {
        // Lưu nhãn gốc: Sổ Tay Câu Sai hiển thị đề chưa xáo trộn đáp án
        Storage.addMistake(questionId, originalLetter, {
          correctLetter: res.correctLetter,
          explanation: res.explanation,
        });
        setSavedMistakes((prev) => new Set(prev).add(questionId));
      }
    } finally {
      setVerifyingId(null);
    }
  };

  const handleSelectOption = (questionId: string, letter: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: letter }));
    setCheckError('');
    if (showInstantAnswer) void verifyAnswer(questionId, letter);
  };

  const handleToggleInstantAnswer = () => {
    const nextVal = !showInstantAnswer;
    setShowInstantAnswer(nextVal);
    setCheckError('');
    Storage.saveSettings({ showInstantAnswer: nextVal });

    // Bật lại chế độ hiện đáp án: chấm lại câu đang xem nếu thí sinh đã chọn đáp án
    const currentId = filteredQuestions[currentIndex]?.id;
    if (nextVal && currentId && answers[currentId] && !verifiedAnswers[currentId]) {
      void verifyAnswer(currentId, answers[currentId]);
    }
  };

  const toggleMistake = (questionId: string) => {
    if (savedMistakes.has(questionId)) {
      Storage.removeMistake(questionId);
      setSavedMistakes((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
    } else {
      const selected = answers[questionId] || 'NONE';
      Storage.addMistake(questionId, selected);
      setSavedMistakes((prev) => new Set(prev).add(questionId));
    }
  };

  const answeredInPart = filteredQuestions.filter((q) => Boolean(answers[q.id])).length;
  const verifiedInPart = filteredQuestions.filter((q) => Boolean(verifiedAnswers[q.id])).length;
  const correctInPart = filteredQuestions.filter((q) => verifiedAnswers[q.id]?.isCorrect).length;

  return (
    <div className="space-y-6">
      {/* Top Filter and Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Part selector */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => {
              setSelectedPart(0);
              setCurrentIndex(0);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors ${
              selectedPart === 0
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Tất Cả ({questions.length})
          </button>
          {[1, 2, 3, 4, 5, 6, 7].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setSelectedPart(p);
                setCurrentIndex(0);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors ${
                selectedPart === p
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Part {p}
            </button>
          ))}
        </div>

        {/* Stats & Answer toggle */}
        <div className="flex items-center justify-between w-full md:w-auto gap-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
            <span>Tiến độ:</span>
            <span className="font-bold text-sky-600 dark:text-sky-400">
              {answeredInPart}/{filteredQuestions.length}
            </span>
            {verifiedInPart > 0 && (
              <span className="text-emerald-600 font-bold ml-1">
                ({Math.round((correctInPart / verifiedInPart) * 100)}% đúng)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsShuffled(!isShuffled);
                setCurrentIndex(0);
              }}
              title="Xáo trộn câu hỏi và đáp án để tăng độ khó"
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-semibold transition-all ${
                isShuffled
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>{isShuffled ? 'Xáo trộn: BẬT' : 'Xáo trộn: TẮT'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleInstantAnswer}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-semibold transition-all ${
                showInstantAnswer
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300'
              }`}
            >
              {showInstantAnswer ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{showInstantAnswer ? 'Hiện đáp án: BẬT' : 'Hiện đáp án: TẮT'}</span>
            </button>
          </div>
        </div>
      </div>

      {checkError && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{checkError}</span>
        </div>
      )}

      {/* Main Question Card */}
      {currentQuestion ? (
        <div className="space-y-4">
          <QuestionCard
            question={currentQuestion}
            selectedLetter={answers[currentQuestion.id]}
            onSelectOption={(letter) => handleSelectOption(currentQuestion.id, letter)}
            mode="practice"
            showInstantAnswer={showInstantAnswer}
            verifiedAnswer={verifiedAnswers[currentQuestion.id]}
            isVerifying={verifyingId === currentQuestion.id}
            isSavedMistake={savedMistakes.has(currentQuestion.id)}
            onToggleMistake={() => toggleMistake(currentQuestion.id)}
            questionIndex={currentIndex}
          />

          {/* Navigation Bar */}
          <div className="flex items-center justify-between pt-2 gap-3">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Câu trước</span>
            </button>

            {/* Quick mini-indicator */}
            <div className="text-xs font-semibold text-slate-500">
              Câu {currentIndex + 1} / {filteredQuestions.length}
            </div>

            <button
              type="button"
              disabled={currentIndex === filteredQuestions.length - 1}
              onClick={() => setCurrentIndex((prev) => Math.min(filteredQuestions.length - 1, prev + 1))}
              className="px-4 py-2.5 rounded-xl bg-sky-600 text-white font-semibold text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-sky-500 transition-colors shadow-sm"
            >
              <span>Câu kế tiếp</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          Không tìm thấy câu hỏi trong mục này.
        </div>
      )}
    </div>
  );
};
