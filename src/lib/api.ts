import { Storage } from './storage';
import type { ExamResult, CandidateInfo, UserAccount } from '../data/types';

export interface GradeExamResponse {
  success: boolean;
  examResult?: ExamResult;
  reviewDetails?: Record<
    string,
    {
      correctLetter: string;
      explanation: string;
      isCorrect: boolean;
    }
  >;
  error?: string;
}

export interface CheckAnswerResponse {
  success: boolean;
  isCorrect?: boolean;
  correctLetter?: string;
  explanation?: string;
  error?: string;
}

export interface AdminDataResponse {
  success: boolean;
  configs?: Record<string, string>;
  users?: UserAccount[];
  totalResults?: number;
  error?: string;
}

/**
 * Gửi bài thi lên Google Sheet Backend để chấm điểm (Zero-knowledge client)
 */
export async function gradeExamOnServer(
  candidate: CandidateInfo,
  durationSeconds: number,
  answers: Record<string, string>
): Promise<GradeExamResponse> {
  const settings = Storage.getSettings();
  if (!settings.webhookUrl) {
    return {
      success: false,
      error: 'Hệ thống chưa được kết nối Webhook Google Sheet. Vui lòng liên hệ Quản trị viên.',
    };
  }

  try {
    const res = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      body: JSON.stringify({
        action: 'gradeExam',
        candidate: {
          name: candidate.name,
          emailOrCode: candidate.emailOrCode,
          targetScore: candidate.targetScore,
        },
        durationSeconds,
        answers,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: 'Không thể kết nối đến máy chủ chấm điểm: ' + (err?.message || err),
    };
  }
}

/**
 * Kiểm tra 1 câu hỏi tức thì trong chế độ Luyện tập (Hỏi Server, không lộ đáp án ở client)
 */
export async function checkAnswerOnServer(
  questionId: string,
  selectedLetter: string,
  email?: string
): Promise<CheckAnswerResponse> {
  const settings = Storage.getSettings();
  if (!settings.webhookUrl) {
    return {
      success: false,
      error: 'Chưa kết nối Webhook.',
    };
  }

  try {
    const res = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      body: JSON.stringify({
        action: 'checkAnswer',
        questionId,
        selectedLetter,
        email,
      }),
    });

    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Lỗi kiểm tra đáp án',
    };
  }
}

/**
 * Lấy toàn bộ dữ liệu quản trị (Configs + Users + Results) từ Google Sheet
 */
export async function fetchAdminData(password: string): Promise<AdminDataResponse> {
  const settings = Storage.getSettings();
  if (!settings.webhookUrl) {
    return { success: false, error: 'Chưa cấu hình Webhook URL' };
  }

  try {
    const res = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      body: JSON.stringify({
        action: 'getAdminData',
        password,
      }),
    });

    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Lỗi kết nối' };
  }
}

/**
 * Khóa (BAN) hoặc Mở khóa (UNBAN) học viên theo Email
 */
export async function setBanStatus(
  email: string,
  isBanned: boolean,
  reason: string,
  password: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const settings = Storage.getSettings();
  if (!settings.webhookUrl) {
    return { success: false, error: 'Chưa cấu hình Webhook URL' };
  }

  try {
    const res = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      body: JSON.stringify({
        action: 'setBanStatus',
        email,
        isBanned,
        reason,
        password,
      }),
    });

    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Lỗi cập nhật' };
  }
}
