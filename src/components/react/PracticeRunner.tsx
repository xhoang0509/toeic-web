import React, { useState, useEffect } from 'react';
import type { Question } from '../../data/types';
import { QuestionCard } from './QuestionCard';
import { Storage } from '../../lib/storage';
import { Eye, EyeOff, RotateCcw, CheckCircle2, ChevronLeft, ChevronRight, Layers, Shuffle } from 'lucide-react';
import { shuffleToeicQuestions } from '../../lib/shuffle';
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

  // Load mistake bookmarks
  useEffect(() => {
    const list = Storage.getMistakes();
    setSavedMistakes(new Set(list.map((m) => m.questionId)));
  }, []);

  const baseQuestions = selectedPart === 0
    ? questions
    : questions.filter((q) => q.partId === selectedPart);

  const filteredQuestions = React.useMemo(() => {
    return isShuffled
      ? shuffleToeicQuestions(baseQuestions, { keepPartsInOrder: true, shuffleReadingOptions: true })
      : baseQuestions;
  }, [baseQuestions, isShuffled]);

  const currentQuestion = filteredQuestions[currentIndex] || filteredQuestions[0];

  const handleSelectOption = async (questionId: string, letter: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: letter,
    }));

    if (showInstantAnswer) {
      setVerifyingId(questionId);
      const cand = Storage.getCandidate();
      const res = await checkAnswerOnServer(questionId, letter, cand?.emailOrCode);
      setVerifyingId(null);

      if (res.success && res.correctLetter) {
        const isRight = Boolean(res.isCorrect);
        setVerifiedAnswers((prev) => ({
          ...prev,
          [questionId]: {
            isCorrect: isRight,
            correctLetter: res.correctLetter!,
            explanation: res.explanation || '',
          },
        }));

        if (!isRight) {
          Storage.addMistake(questionId, letter);
          setSavedMistakes((prev) => new Set(prev).add(questionId));
        }
      }
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
            Tất Cả (183)
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
            {answeredInPart > 0 && (
              <span className="text-emerald-600 font-bold ml-1">
                ({Math.round((correctInPart / answeredInPart) * 100)}% đúng)
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
              onClick={() => setShowInstantAnswer(!showInstantAnswer)}
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
