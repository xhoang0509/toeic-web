import React, { useState, useEffect } from 'react';
import { Storage, type AppSettings } from '../../lib/storage';
import { Portal } from './Portal';
import { Settings, Save, Check, ShieldAlert, X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<AppSettings>(Storage.getSettings());
  const [saved, setSaved] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(Storage.getSettings());
      setSaved(false);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    Storage.saveSettings(settings);
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[9999] overflow-y-auto flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-7 relative my-auto animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Cài Đặt Cá Nhân</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tùy chỉnh trải nghiệm học tập và ôn thi</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Chế độ giải thích tức thì</div>
                <div className="text-[11px] text-slate-500">Hiển thị đáp án và transcript ngay khi chọn câu trả lời</div>
              </div>
              <input
                type="checkbox"
                checked={settings.showInstantAnswer}
                onChange={(e) => setSettings({ ...settings, showInstantAnswer: e.target.checked })}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300 font-medium">
                <ShieldAlert className="w-4 h-4 text-sky-600" />
                <span>Dành cho Quản trị viên</span>
              </div>
              <a
                href={`${import.meta.env.BASE_URL}/admin`}
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] shadow-sm transition-colors"
              >
                Vào trang Admin →
              </a>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-sky-600/20"
              >
                {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>{saved ? 'Đã lưu!' : 'Lưu Thay Đổi'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
};
