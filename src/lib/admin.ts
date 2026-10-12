import { getApiBaseUrl, NOT_CONFIGURED_ERROR } from './api';
import type { UserAccount } from '../data/types';

/**
 * Lớp gọi API quản trị.
 *
 * Mật khẩu chỉ được gửi duy nhất 1 lần ở bước đăng nhập; sau đó mọi request dùng
 * session token (HMAC-SHA256, hạn 8 giờ) do Worker phát hành. Mật khẩu không bao
 * giờ được lưu vào localStorage/sessionStorage.
 */

export interface AdminLoginResponse {
  success: boolean;
  token?: string;
  expiresAt?: number;
  error?: string;
}

export interface AdminDataResponse {
  success: boolean;
  configs?: Record<string, string>;
  users?: UserAccount[];
  totalResults?: number;
  totalQuestions?: number;
  error?: string;
}

export interface AdminMutationResponse {
  success: boolean;
  message?: string;
  rejected?: string[];
  error?: string;
}

async function adminRequest<T>(path: string, token: string | null, body?: unknown): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) {
    return { success: false, error: NOT_CONFIGURED_ERROR } as T;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const text = await res.text();
    if (!text) {
      return { success: false, error: `Máy chủ không trả về dữ liệu (HTTP ${res.status})` } as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return { success: false, error: `Dữ liệu trả về không hợp lệ (HTTP ${res.status})` } as T;
    }
  } catch (e: any) {
    return { success: false, error: 'Không thể kết nối đến máy chủ: ' + (e?.message || e) } as T;
  }
}

export function authenticateAdmin(password: string): Promise<AdminLoginResponse> {
  return adminRequest<AdminLoginResponse>('/api/admin/login', null, { password });
}

export function fetchAdminData(token: string): Promise<AdminDataResponse> {
  return adminRequest<AdminDataResponse>('/api/admin/data', token);
}

export function updateAdminConfigs(
  token: string,
  newConfigs: Record<string, string>
): Promise<AdminMutationResponse> {
  return adminRequest<AdminMutationResponse>('/api/admin/config', token, { newConfigs });
}

export function setBanStatus(
  token: string,
  email: string,
  isBanned: boolean,
  reason: string
): Promise<AdminMutationResponse> {
  return adminRequest<AdminMutationResponse>('/api/admin/ban', token, { email, isBanned, reason });
}
