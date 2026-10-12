import { Storage } from './storage';
import type { ExamResult, CandidateInfo } from '../data/types';

/**
 * Client gọi Cloudflare Worker API (backend D1).
 * Toàn bộ việc chấm điểm, lưu kết quả và xếp hạng đều do server thực hiện —
 * bundle client không chứa đáp án đúng.
 */

export interface ReviewDetail {
  correctLetter: string;
  explanation: string;
  isCorrect: boolean;
}

export interface GradeExamResponse {
  success: boolean;
  examResult?: ExamResult;
  reviewDetails?: Record<string, ReviewDetail>;
  error?: string;
}

export interface CheckAnswerResponse {
  success: boolean;
  isCorrect?: boolean;
  correctLetter?: string;
  explanation?: string;
  error?: string;
}

export interface LeaderboardStats {
  totalAttempts: number;
  bestScore: number;
  averageScore: number;
}

export interface LeaderboardResponse {
  success: boolean;
  entries: ExamResult[];
  stats?: LeaderboardStats;
  hidden?: boolean;
  error?: string;
}

export interface PublicConfig {
  examDurationMinutes: number;
  allowInstantAnswers: boolean;
  showLeaderboard: boolean;
  announcementBanner: string;
  totalQuestions: number;
}

export const NOT_CONFIGURED_ERROR =
  'Hệ thống chưa được kết nối máy chủ chấm điểm. Vui lòng liên hệ Quản trị viên.';

export function getApiBaseUrl(): string {
  return Storage.getSettings().apiBaseUrl || '';
}

async function request<T>(
  path: string,
  init?: RequestInit & { token?: string }
): Promise<T | { success: false; error: string }> {
  const base = getApiBaseUrl();
  if (!base) {
    return { success: false, error: NOT_CONFIGURED_ERROR };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;

  try {
    const res = await fetch(base + path, { ...init, headers: { ...headers, ...(init?.headers as object) } });
    const text = await res.text();

    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        return { success: false, error: `Máy chủ trả về dữ liệu không hợp lệ (HTTP ${res.status})` };
      }
    }

    if (!res.ok && !data.error) {
      return { success: false, error: `Máy chủ trả về lỗi HTTP ${res.status}` };
    }
    return data as T;
  } catch (err: any) {
    return { success: false, error: 'Không thể kết nối đến máy chủ: ' + (err?.message || err) };
  }
}

/** Nộp bài thi để server chấm điểm 100% (client không biết đáp án) */
export async function gradeExamOnServer(
  candidate: CandidateInfo,
  durationSeconds: number,
  answers: Record<string, string>
): Promise<GradeExamResponse> {
  return request<GradeExamResponse>('/api/exam/grade', {
    method: 'POST',
    body: JSON.stringify({
      candidate: {
        name: candidate.name,
        emailOrCode: candidate.emailOrCode,
        targetScore: candidate.targetScore,
      },
      durationSeconds,
      answers,
    }),
  }) as Promise<GradeExamResponse>;
}

/** Chấm 1 câu tức thì trong chế độ Luyện tập */
export async function checkAnswerOnServer(
  questionId: string,
  selectedLetter: string,
  email?: string
): Promise<CheckAnswerResponse> {
  return request<CheckAnswerResponse>('/api/practice/check', {
    method: 'POST',
    body: JSON.stringify({ questionId, selectedLetter, email }),
  }) as Promise<CheckAnswerResponse>;
}

/** Bảng Xếp Hạng thật, lấy từ bảng `results` trên Cloudflare D1 */
export async function fetchLeaderboard(limit = 100, mode: 'best' | 'all' = 'best'): Promise<LeaderboardResponse> {
  const res = (await request<LeaderboardResponse>(
    `/api/leaderboard?limit=${encodeURIComponent(limit)}&mode=${mode}`
  )) as LeaderboardResponse;

  return { ...res, entries: Array.isArray(res.entries) ? res.entries : [] };
}

/** Cấu hình công khai do Quản trị viên đặt (thời gian thi, banner, bật/tắt bảng xếp hạng) */
export async function fetchPublicConfig(): Promise<PublicConfig | null> {
  const res = (await request<any>('/api/config')) as any;
  if (!res?.success) return null;

  return {
    examDurationMinutes: Number(res.exam_duration_minutes || 120),
    allowInstantAnswers: res.allow_instant_answers !== false,
    showLeaderboard: res.show_leaderboard !== false,
    announcementBanner: String(res.announcement_banner || ''),
    totalQuestions: Number(res.total_questions || 0),
  };
}
