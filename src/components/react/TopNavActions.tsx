import React, { useState, useEffect } from 'react';
import { Storage } from '../../lib/storage';
import { CandidateOnboardingModal } from './CandidateOnboardingModal';
import { SettingsModal } from './SettingsModal';
import { User, Bookmark, Settings, Award } from 'lucide-react';

export const TopNavActions: React.FC = () => {
  const [candidateName, setCandidateName] = useState<string>('');
  const [mistakeCount, setMistakeCount] = useState<number>(0);
  const [showCandidateModal, setShowCandidateModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  useEffect(() => {
    const cand = Storage.getCandidate();
    if (cand?.name) setCandidateName(cand.name);

    const mistakes = Storage.getMistakes();
    setMistakeCount(mistakes.length);
  }, []);

  return (
    <div className="flex items-center gap-2">
      {/* Candidate Profile Chip */}
      <button
        type="button"
        onClick={() => setShowCandidateModal(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
      >
        <span className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center text-[10px] font-bold">
          {candidateName ? candidateName.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
        </span>
        <span className="max-w-[100px] truncate hidden sm:inline">
          {candidateName || 'Đăng ký thí sinh'}
        </span>
      </button>

      {/* Mistake Notebook Badge */}
      <a
        href={`${import.meta.env.BASE_URL}/mistakes`}
        title="Sổ tay câu sai"
        className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Bookmark className="w-4 h-4" />
        {mistakeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-sm">
            {mistakeCount > 99 ? '99+' : mistakeCount}
          </span>
        )}
      </a>

      {/* Settings Modal Button */}
      <button
        type="button"
        onClick={() => setShowSettingsModal(true)}
        title="Cài đặt hệ thống"
        className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Settings className="w-4 h-4" />
      </button>

      {/* Modals */}
      <CandidateOnboardingModal
        isOpen={showCandidateModal}
        onClose={(c) => {
          setCandidateName(c.name);
          setShowCandidateModal(false);
        }}
        required={false}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  );
};
