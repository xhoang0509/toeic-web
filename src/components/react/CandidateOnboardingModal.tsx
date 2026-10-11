import React, { useState, useEffect } from 'react';
import { User, Mail, Target, Award, X } from 'lucide-react';
import { Storage } from '../../lib/storage';
import { Portal } from './Portal';
import type { CandidateInfo } from '../../data/types';

interface CandidateModalProps {
  isOpen: boolean;
  onClose: (candidate: CandidateInfo) => void;
  required?: boolean;
}

export const CandidateOnboardingModal: React.FC<CandidateModalProps> = ({
  isOpen,
  onClose,
  required = true,
}) => {
  const [name, setName] = useState<string>('');
  const [emailOrCode, setEmailOrCode] = useState<string>('');
  const [targetScore, setTargetScore] = useState<string>('650+');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const existing = Storage.getCandidate();
    if (existing) {
      setName(existing.name || '');
      setEmailOrCode(existing.emailOrCode || '');
      setTargetScore(existing.targetScore || '650+');
    }

    if (isOpen && !required) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose(Storage.getCandidate() || { name: 'Thí sinh', emailOrCode: '', targetScore: '650+' });
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, required]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập họ và tên của bạn để bắt đầu.');
      return;
    }

    const info: CandidateInfo = {
      name: name.trim(),
      emailOrCode: emailOrCode.trim() || `HV-${Math.floor(1000 + Math.random() * 9000)}`,
      targetScore,
      startTime: Date.now(),
    };

    Storage.setCandidate(info);
    onClose(info);
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[9999] overflow-y-auto flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
        onClick={(e) => {
          if (!required && e.target === e.currentTarget) {
            onClose(Storage.getCandidate() || { name: 'Thí sinh', emailOrCode: '', targetScore: '650+' });
          }
        }}
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-8 relative my-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Thông Tin Thí Sinh</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Xác thực kết quả và ghi danh Bảng Xếp Hạng</p>
              </div>
            </div>
            {!required && (
              <button
                type="button"
                onClick={() =>
                  onClose(Storage.getCandidate() || { name: 'Thí sinh', emailOrCode: '', targetScore: '650+' })
                }
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="p-3 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Họ và tên thí sinh <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email hoặc Mã học viên
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={emailOrCode}
                  onChange={(e) => setEmailOrCode(e.target.value)}
                  placeholder="student@example.com hoặc HV-1234"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Mục tiêu điểm số TOEIC
              </label>
              <div className="grid grid-cols-4 gap-2">
                {['500+', '650+', '800+', '900+'].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setTargetScore(score)}
                    className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all ${
                      targetScore === score
                        ? 'bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/20'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 active:scale-[0.99] transition-all text-white font-bold rounded-xl shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2 text-sm"
              >
                <Target className="w-4 h-4" />
                Xác Nhận & Bắt Đầu
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
};
