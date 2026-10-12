import React, { useState, useEffect } from 'react';
import { authenticateAdmin, fetchAdminData, updateAdminConfigs, setBanStatus } from '../../lib/admin';
import { getApiBaseUrl } from '../../lib/api';
import type { UserAccount } from '../../data/types';
import {
  Lock,
  Unlock,
  Key,
  ShieldCheck,
  Save,
  Check,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
  LogOut,
  Sliders,
  Database,
  AlertTriangle,
  Users,
  UserX,
  UserCheck,
  Search,
  ShieldAlert,
} from 'lucide-react';

/** Chỉ lưu session token do server phát hành — không bao giờ lưu mật khẩu Admin */
const SESSION_TOKEN_KEY = 'toeic_admin_session_token_v2';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000;

export const AdminDashboard: React.FC = () => {
  const apiBaseUrl = getApiBaseUrl();
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [token, setToken] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockedUntil, setLockedUntil] = useState<number>(0);

  // Tabs
  const [activeTab, setActiveTab] = useState<'configs' | 'users'>('configs');

  // Cấu hình & danh sách thí sinh lấy từ Cloudflare D1
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [userSearch, setUserSearch] = useState<string>('');
  const [totalSubmissions, setTotalSubmissions] = useState<number>(0);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [newAdminPassword, setNewAdminPassword] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [banActionLoading, setBanActionLoading] = useState<string | null>(null);

  // Khôi phục phiên quản trị từ session token (token hết hạn thì server tự từ chối)
  useEffect(() => {
    const savedToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (savedToken) loadDashboard(savedToken);
  }, []);

  const loadDashboard = async (sessionToken: string) => {
    setIsLoading(true);
    setLoginError('');
    const res = await fetchAdminData(sessionToken);
    setIsLoading(false);

    if (res.success && res.configs) {
      setIsAuthenticated(true);
      setToken(sessionToken);
      setPassword('');
      sessionStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
      setConfigs(res.configs);
      setUsers(res.users || []);
      setTotalSubmissions(res.totalResults || 0);
      setTotalQuestions(res.totalQuestions || 0);
    } else {
      setIsAuthenticated(false);
      setToken('');
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      setLoginError(res.error || 'Không tải được dữ liệu quản trị');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setLoginError('Vui lòng nhập mật khẩu quản trị viên');
      return;
    }

    if (Date.now() < lockedUntil) {
      const seconds = Math.ceil((lockedUntil - Date.now()) / 1000);
      setLoginError(`Bạn đã nhập sai quá ${MAX_FAILED_ATTEMPTS} lần. Vui lòng thử lại sau ${seconds} giây.`);
      return;
    }

    setIsLoading(true);
    const authRes = await authenticateAdmin(password.trim());

    if (authRes.success && authRes.token) {
      setFailedAttempts(0);
      setLockedUntil(0);
      await loadDashboard(authRes.token);
    } else {
      setIsLoading(false);
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        setFailedAttempts(0);
        setLockedUntil(Date.now() + LOCKOUT_MS);
      }
      setLoginError(authRes.error || 'Sai mật khẩu quản trị viên');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setToken('');
    setPassword('');
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  };

  const handleConfigChange = (key: string, value: string) => {
    setConfigs((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveConfigs = async () => {
    const nextPassword = newAdminPassword.trim();
    if (nextPassword && nextPassword.length < 8) {
      setSaveStatus('❌ Mật khẩu quản trị viên mới phải có tối thiểu 8 ký tự.');
      return;
    }

    setIsLoading(true);
    setSaveStatus('Đang lưu cấu hình lên Cloudflare D1...');

    const payloadToSave: Record<string, string> = { ...configs };
    if (nextPassword) payloadToSave.admin_password = nextPassword;

    const res = await updateAdminConfigs(token, payloadToSave);
    setIsLoading(false);

    if (res.success) {
      setSaveStatus(
        '✅ Đã lưu cấu hình thành công' + (nextPassword ? ' và đổi mật khẩu quản trị viên!' : '!')
      );
      setNewAdminPassword('');
      setTimeout(() => setSaveStatus(''), 4000);
    } else {
      setSaveStatus('❌ Lỗi: ' + (res.error || 'Không thể lưu cấu hình'));
    }
  };

  const handleToggleBan = async (email: string, currentStatus: string) => {
    const isCurrentlyBanned = currentStatus.toUpperCase() === 'BANNED';
    let reason = '';
    if (!isCurrentlyBanned) {
      const input = prompt(`Nhập lý do khóa tài khoản ${email}:`, 'Vi phạm quy chế thi');
      if (input === null) return;
      reason = input || 'Vi phạm quy chế thi';
    }

    setBanActionLoading(email);
    const res = await setBanStatus(token, email, !isCurrentlyBanned, reason);
    setBanActionLoading(null);

    if (res.success) {
      setUsers((prev) =>
        prev.map((u) =>
          u.email.toLowerCase() === email.toLowerCase()
            ? { ...u, status: isCurrentlyBanned ? 'ACTIVE' : 'BANNED', bannedReason: reason }
            : u
        )
      );
      setSaveStatus(`✅ Đã cập nhật trạng thái cho ${email}`);
      setTimeout(() => setSaveStatus(''), 3000);
    } else {
      alert('Lỗi: ' + (res.error || 'Không thể cập nhật'));
    }
  };

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  // -------------------------------------------------------------
  // RENDER LOGIN SCREEN (Khi chưa đăng nhập)
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white mx-auto flex items-center justify-center shadow-md">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
            Cổng Quản Trị Hệ Thống
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Khu vực bảo mật chỉ dành cho Quản trị viên quản lý cấu hình kỳ thi & thí sinh
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {loginError && (
            <div className="p-3 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Máy chủ API (Cloudflare Worker)
            </label>
            <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-mono break-all">
              {apiBaseUrl || 'Chưa cấu hình PUBLIC_API_BASE_URL khi build'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Mật Khẩu Quản Trị Viên
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu Admin..."
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Mật khẩu mặc định: <span className="font-mono font-bold text-slate-600 dark:text-slate-300">admin@toeic2026</span>
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
            <span>Đăng Nhập Vào Trang Quản Trị</span>
          </button>
        </form>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER ADMIN DASHBOARD (Sau khi đã đăng nhập)
  // -------------------------------------------------------------
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Bảng Điều Khiển Quản Trị</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Đã Xác Thực
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cấu hình kỳ thi • {totalQuestions} câu hỏi • {users.length} thí sinh (Cloudflare D1)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadDashboard(token)}
            title="Làm mới dữ liệu từ Cloudflare D1"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="px-3.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('configs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'configs'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Cấu Hình Hệ Thống & Bảo Mật</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'users'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Quản Lý Thí Sinh & Khóa User ({users.length})</span>
        </button>
      </div>

      {saveStatus && (
        <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-xs font-bold text-sky-800 dark:text-sky-200 animate-in fade-in">
          {saveStatus}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-medium">Tổng Lượt Thi Đã Nộp</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {totalSubmissions} lượt
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-medium">Tổng Số Thí Sinh (Email)</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {users.length} tài khoản
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-medium">Tài Khoản Đang Bị Khóa</div>
            <div className="text-2xl font-bold text-rose-600 mt-0.5">
              {users.filter((u) => u.status === 'BANNED').length} bị BAN
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <UserX className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* TAB 1: CONFIGS */}
      {activeTab === 'configs' && (
        <div className="space-y-6">
          {/* Security Configurations */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Key className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Bảo Mật Hệ Thống & Mật Khẩu Quản Trị
              </h2>
            </div>

            <div className="p-3.5 rounded-xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900 text-[11px] text-sky-900 dark:text-sky-200 leading-relaxed">
              Session quản trị dùng token HMAC-SHA256 do Cloudflare Worker phát hành (hạn 8 giờ).
              Mật khẩu chỉ được gửi 1 lần lúc đăng nhập và không được lưu trên trình duyệt.
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Đổi Mật Khẩu Admin (Để trống nếu không đổi)
              </label>
              <input
                type="password"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự..."
                minLength={8}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Public Examination Configurations */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Sliders className="w-5 h-5 text-sky-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Cấu Hình Quy Định Kỳ Thi (Đồng bộ cho Thí sinh)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Thời Gian Làm Bài Thi Thử (Phút)
                </label>
                <input
                  type="number"
                  min={10}
                  max={180}
                  value={configs.exam_duration_minutes || '120'}
                  onChange={(e) => handleConfigChange('exam_duration_minutes', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Số Thí Sinh Hiển Thị Trên Bảng Xếp Hạng
                </label>
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={configs.leaderboard_size || '100'}
                  onChange={(e) => handleConfigChange('leaderboard_size', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Hiện Bảng Xếp Hạng</div>
                  <div className="text-[11px] text-slate-400">Cho phép thí sinh xem Leaderboard</div>
                </div>
                <input
                  type="checkbox"
                  checked={configs.show_leaderboard === 'true'}
                  onChange={(e) => handleConfigChange('show_leaderboard', e.target.checked ? 'true' : 'false')}
                  className="w-4 h-4 rounded text-sky-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Cho Phép Xem Đáp Án Tức Thì</div>
                <div className="text-[11px] text-slate-400">Cho phép học viên bật chế độ giải thích trong khi ôn tập</div>
              </div>
              <input
                type="checkbox"
                checked={configs.allow_instant_answers === 'true'}
                onChange={(e) => handleConfigChange('allow_instant_answers', e.target.checked ? 'true' : 'false')}
                className="w-4 h-4 rounded text-sky-600 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Thông Báo Banner Chung (Hiển thị đầu trang)
              </label>
              <input
                type="text"
                value={configs.announcement_banner || ''}
                onChange={(e) => handleConfigChange('announcement_banner', e.target.value)}
                placeholder="Thông báo từ ban tổ chức..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={isLoading}
                onClick={handleSaveConfigs}
                className="px-6 py-3 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-600/25 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Lưu Cấu Hình</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT (VIEW & BAN/UNBAN BY EMAIL) */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Tìm thí sinh theo email hoặc tên..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="text-xs text-slate-500">
              Hiển thị: <span className="font-bold">{filteredUsers.length}</span> thí sinh
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Email / Thí Sinh</th>
                    <th className="py-3 px-4 text-center">Trạng Thái</th>
                    <th className="py-3 px-4 text-center">Số Lượt Thi</th>
                    <th className="py-3 px-4 text-center">Điểm Cao Nhất</th>
                    <th className="py-3 px-4">Hoạt Động Gần Nhất</th>
                    <th className="py-3 px-4 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => {
                      const isBanned = u.status.toUpperCase() === 'BANNED';
                      const isActing = banActionLoading === u.email;

                      return (
                        <tr key={u.email} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white font-mono">{u.email}</div>
                            <div className="text-slate-400 text-[11px]">{u.name}</div>
                            {u.bannedReason && (
                              <div className="text-[10px] text-rose-500 mt-0.5">Lý do: {u.bannedReason}</div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                isBanned
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                              }`}
                            >
                              {isBanned ? '🚫 BANNED' : '✅ ACTIVE'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-slate-300">
                            {u.totalExams} lần
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className="font-extrabold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200">
                              {u.bestScore} / 990
                            </span>
                          </td>

                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {u.lastActive || 'Chưa thi'}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() => handleToggleBan(u.email, u.status)}
                              className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1.5 ml-auto ${
                                isBanned
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100'
                              }`}
                            >
                              {isActing ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : isBanned ? (
                                <>
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Mở khóa</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Khóa (BAN)</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Chưa có thí sinh nào trong danh sách. Khi thí sinh nộp bài, tài khoản email sẽ tự động xuất hiện tại đây.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
