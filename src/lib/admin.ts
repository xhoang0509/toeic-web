import { generateSha256 } from './crypto';

export interface PublicConfig {
  exam_duration_minutes: number;
  allow_instant_answers: boolean;
  show_leaderboard: boolean;
  announcement_banner: string;
}

export interface AdminConfigResponse {
  success: boolean;
  configs?: Record<string, string>;
  totalSubmissions?: number;
  error?: string;
}

/**
 * Tải cấu hình công khai từ Google Sheet cho thí sinh (không bao giờ lộ token/mật khẩu)
 */
export async function fetchPublicConfig(webhookUrl: string): Promise<PublicConfig | null> {
  if (!webhookUrl) return null;
  try {
    const url = new URL(webhookUrl);
    url.searchParams.set('action', 'getPublicConfig');
    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success) {
      return {
        exam_duration_minutes: Number(data.exam_duration_minutes || 120),
        allow_instant_answers: Boolean(data.allow_instant_answers),
        show_leaderboard: Boolean(data.show_leaderboard),
        announcement_banner: String(data.announcement_banner || ''),
      };
    }
    return null;
  } catch (e) {
    console.warn('Could not load public config:', e);
    return null;
  }
}

/**
 * Xác thực mật khẩu Quản Trị Viên với Google Apps Script
 */
export async function authenticateAdmin(
  webhookUrl: string,
  password: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (!webhookUrl) {
    return { success: false, error: 'Chưa cấu hình Webhook URL Google Apps Script' };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'adminLogin',
        password,
      }),
    });

    const data = await res.json();
    return data;
  } catch (e: any) {
    return { success: false, error: 'Không thể kết nối đến Webhook: ' + (e?.message || e) };
  }
}

/**
 * Lấy toàn bộ cấu hình từ Sheet Config (yêu cầu mật khẩu Admin)
 */
export async function fetchAdminConfigs(
  webhookUrl: string,
  password: string
): Promise<AdminConfigResponse> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getAdminConfig',
        password,
      }),
    });

    return await res.json();
  } catch (e: any) {
    return { success: false, error: e?.message || 'Lỗi kết nối' };
  }
}

/**
 * Cập nhật cấu hình lên Sheet Config (yêu cầu mật khẩu Admin)
 */
export async function updateAdminConfigs(
  webhookUrl: string,
  password: string,
  newConfigs: Record<string, string>
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updateAdminConfig',
        password,
        newConfigs,
      }),
    });

    return await res.json();
  } catch (e: any) {
    return { success: false, error: e?.message || 'Lỗi kết nối' };
  }
}
