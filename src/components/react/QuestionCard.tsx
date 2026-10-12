import React, { useState } from 'react';
import type { Question } from '../../data/types';
import { AudioPlayer } from './AudioPlayer';
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Flag,
  Loader2,
} from 'lucide-react';
import { getAssetUrl } from '../../lib/assets';

export interface VerifiedAnswer {
  isCorrect: boolean;
  correctLetter: string;
  explanation: string;
}

interface QuestionCardProps {
  question: Question;
  selectedLetter?: string;
  onSelectOption: (letter: string) => void;
  mode?: 'practice' | 'exam';
  showInstantAnswer?: boolean;
  verifiedAnswer?: VerifiedAnswer;
  isVerifying?: boolean;
  isFlagged?: boolean;
  onToggleFlag?: () => void;
  isSavedMistake?: boolean;
  onToggleMistake?: () => void;
  questionIndex?: number;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  selectedLetter,
  onSelectOption,
  mode = 'practice',
  showInstantAnswer = true,
  verifiedAnswer,
  isVerifying = false,
  isFlagged = false,
  onToggleFlag,
  isSavedMistake = false,
  onToggleMistake,
  questionIndex,
}) => {
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  const audioMedia = question.mediaFiles?.find((m) => m.type === 'audio');
  const imageMedia = question.mediaFiles?.find((m) => m.type === 'image');

  // Đáp án đúng chỉ đến từ server (verifiedAnswer) — dữ liệu câu hỏi phía client không chứa đáp án
  const correctLetter = verifiedAnswer?.correctLetter;
  const correctOption = correctLetter
    ? question.options.find((opt) => opt.letter === correctLetter)
    : undefined;

  const showAnswerFeedback = Boolean(
    verifiedAnswer && (mode === 'exam' || showInstantAnswer)
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700">
      {/* Header bar of the question */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 font-bold text-sm flex items-center justify-center border border-sky-100 dark:border-sky-900">
            {questionIndex !== undefined ? questionIndex + 1 : question.questionNumber}
          </span>
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {question.partName}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium hidden sm:inline">
            {question.skill}
          </span>
          {isVerifying && (
            <span className="flex items-center gap-1 text-[11px] text-sky-600 font-medium animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Đang chấm điểm...</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {mode === 'exam' && onToggleFlag && (
            <button
              type="button"
              onClick={onToggleFlag}
              title={isFlagged ? 'Bỏ đánh dấu' : 'Đánh dấu xem lại'}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                isFlagged
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Flag className={`w-4 h-4 ${isFlagged ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline">Xem lại</span>
            </button>
          )}

          {mode === 'practice' && onToggleMistake && (
            <button
              type="button"
              onClick={onToggleMistake}
              title={isSavedMistake ? 'Xóa khỏi Sổ tay câu sai' : 'Lưu vào Sổ tay câu sai'}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                isSavedMistake
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {isSavedMistake ? (
                <>
                  <BookmarkCheck className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span className="hidden sm:inline">Đã lưu sổ tay</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4" />
                  <span className="hidden sm:inline">Lưu câu sai</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Media section (Audio / Image) */}
      <div className="my-5 space-y-4">
        {audioMedia && (
          <AudioPlayer
            src={audioMedia.file}
            title={`Audio câu ${question.questionNumber} (${question.partName})`}
          />
        )}

        {imageMedia && (
          <div className="flex justify-center p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
            <img
              src={getAssetUrl(imageMedia.file)}
              alt={`Hình ảnh minh họa câu ${question.questionNumber}`}
              className="max-h-80 w-auto object-contain rounded-lg shadow-sm"
              loading="lazy"
            />
          </div>
        )}

        {question.passage && (
          <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 font-serif text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-line">
            {question.passage}
          </div>
        )}
      </div>

      {/* Question prompt */}
      <div className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-5 leading-snug">
        {question.question}
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 gap-2.5">
        {question.options.map((opt) => {
          const isSelected = selectedLetter === opt.letter;
          const isOptionCorrect = correctLetter ? opt.letter === correctLetter : false;

          let btnClass =
            'border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-600 bg-slate-50/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200';

          if (isSelected) {
            btnClass =
              'border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 font-semibold ring-2 ring-sky-500/20';
          }

          if (showAnswerFeedback && correctLetter) {
            if (isOptionCorrect) {
              btnClass =
                'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-semibold ring-2 ring-emerald-500/30';
            } else if (isSelected && !isOptionCorrect) {
              btnClass =
                'border-rose-400 bg-rose-50/80 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 font-semibold ring-2 ring-rose-500/30';
            }
          }

          return (
            <button
              key={opt.letter}
              type="button"
              onClick={() => onSelectOption(opt.letter)}
              className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-start gap-3.5 ${btnClass}`}
            >
              <span
                className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center font-bold text-xs uppercase border transition-colors ${
                  showAnswerFeedback && correctLetter && isOptionCorrect
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : showAnswerFeedback && correctLetter && isSelected && !isOptionCorrect
                    ? 'bg-rose-500 text-white border-rose-500'
                    : isSelected
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300'
                }`}
              >
                {opt.letter}
              </span>
              <span className="pt-0.5 text-sm sm:text-base leading-relaxed break-words flex-1">
                {opt.text}
              </span>
              {showAnswerFeedback && correctLetter && isOptionCorrect && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 self-center" />
              )}
              {showAnswerFeedback && correctLetter && isSelected && !isOptionCorrect && (
                <XCircle className="w-5 h-5 text-rose-500 shrink-0 self-center" />
              )}
            </button>
          );
        })}
      </div>

      {/* Explanation toggle for Practice Mode or Post-Exam Review */}
      {showAnswerFeedback && verifiedAnswer?.explanation && (
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowExplanation(!showExplanation)}
            className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            <span>
              {showExplanation
                ? 'Ẩn lời giải thích & Transcript'
                : 'Xem lời giải thích & Transcript'}
            </span>
            {showExplanation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showExplanation && (
            <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Đáp án chính xác:
                </span>
                <span className="px-2 py-0.5 rounded font-extrabold text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  {correctOption ? `${correctLetter}. ${correctOption.text}` : correctLetter}
                </span>
              </div>
              <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                <span className="font-bold text-slate-900 dark:text-white">Giải thích chi tiết: </span>
                {verifiedAnswer?.explanation}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
