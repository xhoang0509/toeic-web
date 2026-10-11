import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Question, CandidateInfo, ExamResult } from '../../data/types';
import { QuestionCard } from './QuestionCard';
import { CandidateOnboardingModal } from './CandidateOnboardingModal';
import { RadarSkillChart } from './RadarSkillChart';
import { Storage } from '../../lib/storage';
import { calculateScaledToeic, calculateSectionScaledScore, getCefrLevel, formatTime } from '../../lib/score';
import { syncExamResultToWebhook } from '../../lib/webhook';
import { gradeExamOnServer } from '../../lib/api';
import { shuffleToeicQuestions } from '../../lib/shuffle';
import { Portal } from './Portal';
import confetti from 'canvas-confetti';
import {
  Clock,
  CheckCircle,
  Flag,
  ListFilter,
  Send,
  Printer,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trophy,
  Award,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface ExamRunnerProps {
  questions: Question[];
}

export const ExamRunner: React.FC<ExamRunnerProps> = ({ questions }) => {
  const [examQuestions] = useState<Question[]>(() =>
    shuffleToeicQuestions(questions, { keepPartsInOrder: true, shuffleReadingOptions: true })
  );
  const [candidate, setCandidate] = useState<CandidateInfo | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(120 * 60); // 120 minutes
  const [isExamCompleted, setIsExamCompleted] = useState<boolean>(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState<boolean>(false);
  const [showNavigator, setShowNavigator] = useState<boolean>(false);
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [reviewDetails, setReviewDetails] = useState<Record<string, { correctLetter: string; explanation: string; isCorrect: boolean }>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [showCertificate, setShowCertificate] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize candidate
  useEffect(() => {
    const saved = Storage.getCandidate();
    if (!saved) {
      setShowOnboarding(true);
    } else {
      setCandidate(saved);
    }
  }, []);

  // Timer countdown
  useEffect(() => {
    if (isExamCompleted || !candidate) return;

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current as NodeJS.Timeout);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [candidate, isExamCompleted]);

  const currentQuestion = examQuestions[currentIndex] || examQuestions[0];

  const answeredCount = Object.keys(answers).length;
  const flaggedCount = flaggedIds.size;

  const handleSelectOption = (questionId: string, letter: string) => {
    if (isExamCompleted) return;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: letter,
    }));
  };

  const toggleFlag = (questionId: string) => {
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const handleSubmitExam = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsSubmitting(true);
    setSubmitError('');

    const timeSpent = 120 * 60 - secondsRemaining;
    const cand = candidate || { name: 'Thí sinh', emailOrCode: 'HV-0000', targetScore: '650+' };

    const serverRes = await gradeExamOnServer(cand, timeSpent, answers);
    setIsSubmitting(false);

    if (serverRes.success && serverRes.examResult) {
      setShowConfirmSubmit(false);
      setExamResult(serverRes.examResult);
      if (serverRes.reviewDetails) {
        setReviewDetails(serverRes.reviewDetails);
        Object.entries(serverRes.reviewDetails).forEach(([qId, detail]) => {
          if (!detail.isCorrect) {
            Storage.addMistake(qId, answers[qId] || 'NONE');
          }
        });
      }
      setIsExamCompleted(true);
      Storage.addExamResult(serverRes.examResult);
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });
      } catch {}
    } else {
      setSubmitError(serverRes.error || 'Lỗi khi nộp bài thi. Vui lòng kiểm tra lại kết nối.');
    }
  };

  return (
    <div className="relative min-h-screen pb-20">
      {/* Candidate Onboarding Modal */}
      <CandidateOnboardingModal
        isOpen={showOnboarding}
        onClose={(cand) => {
          setCandidate(cand);
          setShowOnboarding(false);
        }}
        required={true}
      />

      {/* Sticky Exam Bar */}
      <div className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm py-3 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Candidate Info */}
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center text-xs">
              {candidate?.name?.charAt(0) || 'U'}
            </span>
            <div className="hidden sm:block">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                {candidate?.name || 'Đang chuẩn bị...'}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">Mục tiêu: {candidate?.targetScore}</div>
            </div>
          </div>

          {/* Timer */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <Clock className={`w-4 h-4 ${secondsRemaining < 600 ? 'text-rose-500 animate-pulse' : 'text-sky-500'}`} />
            <span
              className={`font-mono text-sm font-bold ${
                secondsRemaining < 600 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'
              }`}
            >
              {formatTime(secondsRemaining)}
            </span>
          </div>

          {/* Quick stats & Navigator Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNavigator(true)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
            >
              <ListFilter className="w-4 h-4 text-sky-500" />
              <span className="hidden md:inline">Bảng câu hỏi:</span>
              <span className="font-bold text-sky-600 dark:text-sky-400">
                {answeredCount}/{examQuestions.length}
              </span>
            </button>

            {!isExamCompleted && (
              <button
                type="button"
                onClick={() => setShowConfirmSubmit(true)}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-600/20 flex items-center gap-1.5 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Nộp Bài</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Examination Body */}
      {!isExamCompleted ? (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
          {/* Active Question Card */}
          {currentQuestion && (
            <QuestionCard
              question={currentQuestion}
              selectedLetter={answers[currentQuestion.id]}
              onSelectOption={(letter) => handleSelectOption(currentQuestion.id, letter)}
              mode="exam"
              isFlagged={flaggedIds.has(currentQuestion.id)}
              onToggleFlag={() => toggleFlag(currentQuestion.id)}
              questionIndex={currentIndex}
            />
          )}

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-6 gap-3">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Câu trước</span>
            </button>

            <span className="text-xs font-semibold text-slate-400">
              Câu {currentIndex + 1} trên {examQuestions.length}
            </span>

            <button
              type="button"
              disabled={currentIndex === examQuestions.length - 1}
              onClick={() => setCurrentIndex((prev) => Math.min(examQuestions.length - 1, prev + 1))}
              className="px-4 py-2.5 rounded-xl bg-sky-600 text-white font-semibold text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-sky-500 transition-colors shadow-sm"
            >
              <span>Câu tiếp theo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Result & Celebration Screen */
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-8 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 border border-sky-800/50 rounded-3xl p-6 sm:p-10 text-white shadow-xl text-center relative overflow-hidden">
            <div className="relative z-10 max-w-xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 text-xs font-semibold">
                <Trophy className="w-4 h-4 text-amber-400" />
                Hoàn Thành Bài Thi TOEIC Online
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                Chúc Mừng {examResult?.candidateName}!
              </h1>

              <p className="text-sm text-slate-300">
                Bạn đã hoàn thành bài thi 183 câu với kết quả quy đổi chuẩn quốc tế ETS:
              </p>

              <div className="grid grid-cols-3 gap-3 pt-4">
                <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
                  <div className="text-xs uppercase text-slate-400 font-semibold">Listening</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-sky-300 mt-1">
                    {examResult?.scaledListening}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {examResult?.listeningCorrect}/{examQuestions.filter((q) => q.skill === 'Listening').length} câu
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
                  <div className="text-xs uppercase text-slate-400 font-semibold">Reading</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300 mt-1">
                    {examResult?.scaledReading}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {examResult?.readingCorrect}/{examQuestions.filter((q) => q.skill === 'Reading').length} câu
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/20 backdrop-blur-md border border-amber-400/30">
                  <div className="text-xs uppercase text-amber-300 font-bold">Tổng Điểm</div>
                  <div className="text-2xl sm:text-4xl font-black text-amber-400 mt-1">
                    {examResult?.totalScaledScore}
                  </div>
                  <div className="text-[11px] text-amber-200">Thang điểm 990</div>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCertificate(true)}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                >
                  <Award className="w-4 h-4" />
                  Xem Chứng Chỉ Hoàn Thành
                </button>

                <a
                  href={`${import.meta.env.BASE_URL}/leaderboard`}
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center gap-2 border border-white/20 transition-colors"
                >
                  <Trophy className="w-4 h-4" />
                  Xem Bảng Xếp Hạng
                </a>

                <a
                  href={`${import.meta.env.BASE_URL}/mistakes`}
                  className="px-5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold text-xs flex items-center gap-2 border border-rose-400/30 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Ôn Lại Câu Sai
                </a>
              </div>
            </div>
          </div>

          {/* Radar Chart Component */}
          {examResult && (
            <RadarSkillChart
              partAccuracy={examResult.partAccuracy}
              totalScaledScore={examResult.totalScaledScore}
            />
          )}
        </div>
      )}

      {/* Question Navigator Drawer / Modal */}
      {showNavigator && (
        <Portal>
          <div
            className="fixed inset-0 z-[9999] overflow-y-auto flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowNavigator(false);
            }}
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl p-6 relative my-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Danh Sách Câu Hỏi</h3>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-slate-500">
                    <span className="w-3 h-3 rounded bg-sky-500" /> Đã làm
                  </span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <span className="w-3 h-3 rounded bg-amber-400" /> Cần xem lại
                  </span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <span className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-700" /> Chưa làm
                  </span>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 my-4 grid grid-cols-6 sm:grid-cols-10 gap-2 p-1">
                {examQuestions.map((q, idx) => {
                  const isAns = Boolean(answers[q.id]);
                  const isFlg = flaggedIds.has(q.id);
                  const isCur = idx === currentIndex;

                  let cls = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
                  if (isAns) cls = 'bg-sky-500 text-white border-sky-500 font-bold';
                  if (isFlg) cls = 'bg-amber-400 text-slate-950 border-amber-500 font-bold ring-2 ring-amber-300';
                  if (isCur) cls += ' ring-2 ring-sky-400 ring-offset-2';

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(idx);
                        setShowNavigator(false);
                      }}
                      className={`h-9 rounded-lg text-xs flex items-center justify-center border transition-all ${cls}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setShowNavigator(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold"
              >
                Đóng Danh Sách
              </button>
            </div>
          </div>
        </Portal>
      )}

      {/* Confirm Submit Modal */}
      {showConfirmSubmit && (
        <Portal>
          <div
            className="fixed inset-0 z-[9999] overflow-y-auto flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
            onClick={(e) => {
              if (!isSubmitting && e.target === e.currentTarget) setShowConfirmSubmit(false);
            }}
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 text-center space-y-4 relative my-auto">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Bạn Muốn Nộp Bài Thi?</h3>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bạn đã hoàn thành <span className="font-bold text-slate-800 dark:text-slate-200">{answeredCount}/{examQuestions.length}</span> câu hỏi.
                {examQuestions.length - answeredCount > 0 && (
                  <span className="text-rose-500 block mt-1 font-semibold">
                    (Còn {examQuestions.length - answeredCount} câu chưa trả lời)
                  </span>
                )}
              </p>

              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2 text-left">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowConfirmSubmit(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  Tiếp tục làm bài
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmitExam}
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md shadow-sky-600/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang chấm điểm...</span>
                    </>
                  ) : (
                    <span>Xác nhận nộp bài</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Certificate Modal */}
      {showCertificate && examResult && (
        <Portal>
          <div
            className="fixed inset-0 z-[9999] overflow-y-auto flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCertificate(false);
            }}
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 relative my-auto">
              <button
                onClick={() => setShowCertificate(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-sm p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>

              {/* Certificate Template */}
              <div className="border-4 border-double border-amber-500/70 p-6 sm:p-8 rounded-xl bg-amber-50/20 text-center space-y-4">
                <div className="text-xs font-bold tracking-widest text-amber-700 uppercase">
                  ETS Simulated Online Assessment
                </div>
                <h2 className="text-2xl sm:text-3xl font-serif font-extrabold text-slate-900 dark:text-white">
                  CHỨNG CHỈ HOÀN THÀNH
                </h2>
                <p className="text-xs text-slate-500 italic">Chứng nhận thí sinh đã hoàn thành kỳ kiểm tra năng lực TOEIC</p>

                <div className="py-4">
                  <div className="text-2xl font-serif font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wide">
                    {examResult.candidateName}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Mã xác thực: {examResult.id}</div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-3 border-y border-amber-300/40 text-xs">
                  <div>
                    <div className="text-slate-400 font-medium">Listening</div>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200">{examResult.scaledListening}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium">Reading</div>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200">{examResult.scaledReading}</div>
                  </div>
                  <div>
                    <div className="text-amber-600 font-bold">Tổng Điểm</div>
                    <div className="text-xl font-black text-amber-600">{examResult.totalScaledScore} / 990</div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-500 pt-2">
                  <div>Ngày cấp: {examResult.completedAt}</div>
                  <div>Xếp loại: {examResult.cefrLevel}</div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-sky-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  In / Lưu PDF
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};
