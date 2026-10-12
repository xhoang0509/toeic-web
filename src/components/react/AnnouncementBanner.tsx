import React, { useEffect, useState } from 'react';
import { fetchPublicConfig } from '../../lib/api';
import { Megaphone, X } from 'lucide-react';

const DISMISS_KEY = 'toeic_dismissed_announcement_v1';

/**
 * Thanh thông báo chung do Quản trị viên đặt trong cấu hình hệ thống (bảng `config` trên D1).
 * Thí sinh có thể đóng; thông báo chỉ hiện lại khi nội dung thay đổi.
 */
export const AnnouncementBanner: React.FC = () => {
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    fetchPublicConfig().then((config) => {
      if (cancelled || !config?.announcementBanner) return;

      let dismissed = '';
      try {
        dismissed = localStorage.getItem(DISMISS_KEY) || '';
      } catch {
        dismissed = '';
      }

      if (dismissed !== config.announcementBanner) {
        setMessage(config.announcementBanner);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!message) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, message);
    } catch {
      /* chế độ riêng tư: chỉ ẩn trong phiên này */
    }
    setMessage('');
  };

  return (
    <div className="bg-sky-600 text-white text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-3">
        <Megaphone className="w-4 h-4 shrink-0" />
        <p className="flex-1 font-semibold leading-relaxed">{message}</p>
        <button
          type="button"
          onClick={dismiss}
          title="Đóng thông báo"
          className="p-1 rounded-lg hover:bg-white/20 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
