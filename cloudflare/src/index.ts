/**
 * TOEIC Online Assessment — Cloudflare Worker API (D1 backend)
 *
 * Thay thế backend Google Apps Script: không còn phải cấp quyền thủ công,
 * không bị giới hạn quota Sheets, không bị chặn CORS preflight.
 *
 * Nguyên tắc bảo mật:
 *   - Đáp án đúng & lời giải thích chỉ nằm trong D1, không bao giờ nằm trong bundle client.
 *   - Chấm điểm 100% phía server (`/api/exam/grade`).
 *   - Admin đăng nhập bằng mật khẩu băm SHA-256 → nhận session token HMAC có hạn,
 *     mật khẩu không được gửi lại trong các request tiếp theo.
 */

// ---------------------------------------------------------------------------
// Kiểu dữ liệu D1 tối giản (không cần @cloudflare/workers-types khi build)
// ---------------------------------------------------------------------------
interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

export interface Env {
  DB: D1Database;
  /** Khóa bí mật ký session token của Admin (wrangler secret put ADMIN_SESSION_SECRET) */
  ADMIN_SESSION_SECRET?: string;
  /** Danh sách origin được phép, phân tách bằng dấu phẩy. Mặc định cho phép tất cả. */
  ALLOWED_ORIGINS?: string;
}

interface ClientQuestionRow {
  id: string;
  question_number: number;
  part_id: number;
  part_name: string;
  skill: string;
  media_files: string;
  passage: string;
  question: string;
  options: string;
}

const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 giờ
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** Chống dò mật khẩu admin ở mức best-effort trong vòng đời isolate */
const loginAttempts = new Map<string, { count: number; firstAt: number }>();

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------
function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowList = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  let allowOrigin = '*';
  if (allowList.length > 0) {
    allowOrigin = allowList.includes(origin) ? origin : allowList[0];
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data: unknown, request: Request, env: Env, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(request, env),
    },
  });
}

function fail(error: string, request: Request, env: Env, status = 400): Response {
  return json({ success: false, error }, request, env, status);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  return toHex(await crypto.subtle.digest('SHA-256', data));
}

/** So sánh chuỗi theo thời gian hằng số để tránh timing attack */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

function sessionSecret(env: Env): string {
  // Không có secret cấu hình thì vẫn hoạt động được nhưng token chỉ sống trong 1 bản deploy
  return env.ADMIN_SESSION_SECRET || 'toeic-dev-session-secret-change-me';
}

async function issueAdminToken(env: Env): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = base64UrlEncode(JSON.stringify({ sub: 'admin', exp: expiresAt }));
  const signature = await hmacHex(sessionSecret(env), payload);
  return { token: `${payload}.${signature}`, expiresAt };
}

async function verifyAdminToken(env: Env, token: string | null): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = await hmacHex(sessionSecret(env), payload);
  if (!timingSafeEqual(signature, expected)) return false;

  try {
    const decoded = JSON.parse(base64UrlDecode(payload)) as { sub?: string; exp?: number };
    return decoded.sub === 'admin' && typeof decoded.exp === 'number' && decoded.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

async function requireAdmin(request: Request, env: Env): Promise<Response | null> {
  const ok = await verifyAdminToken(env, bearerToken(request));
  return ok ? null : fail('Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.', request, env, 401);
}

function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

function isLoginThrottled(ip: string): boolean {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_LOGIN_ATTEMPTS;
}

function recordLoginFailure(ip: string): void {
  const entry = loginAttempts.get(ip);
  if (!entry || Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
}

// ---------------------------------------------------------------------------
// Truy vấn dữ liệu
// ---------------------------------------------------------------------------
async function readConfig(env: Env): Promise<Record<string, string>> {
  const { results } = await env.DB.prepare('SELECT key, value FROM config').all<{ key: string; value: string }>();
  const map: Record<string, string> = {};
  for (const row of results) map[row.key] = row.value;
  return map;
}

function parseOptions(raw: string): { letter: string; text: string }[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseMedia(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Câu hỏi gửi cho client: KHÔNG chứa correct_letter / explanation */
function toClientQuestion(row: ClientQuestionRow) {
  return {
    id: row.id,
    questionNumber: row.question_number,
    partId: row.part_id,
    partName: row.part_name,
    skill: row.skill,
    mediaFiles: parseMedia(row.media_files),
    passage: row.passage,
    question: row.question,
    options: parseOptions(row.options),
  };
}

function scaledSection(correct: number, total: number): number {
  if (total <= 0) return 5;
  const raw = 5 + (correct / total) * 490;
  return Math.min(495, Math.max(5, Math.round(raw / 5) * 5));
}

function cefrOf(totalScaled: number): string {
  if (totalScaled >= 905) return 'C1+';
  if (totalScaled >= 785) return 'C1';
  if (totalScaled >= 605) return 'B2';
  if (totalScaled >= 405) return 'B1';
  if (totalScaled >= 255) return 'A2';
  return 'A1';
}

function formatVietnamTime(epochMs: number): string {
  // Asia/Ho_Chi_Minh = UTC+7 (không có DST)
  const d = new Date(epochMs + 7 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(
    d.getUTCMinutes()
  )}`;
}

async function isBanned(env: Env, email: string): Promise<boolean> {
  if (!email) return false;
  const row = await env.DB.prepare('SELECT status FROM users WHERE email = ?').bind(email).first<{ status: string }>();
  return row?.status === 'BANNED';
}

function normalizeEmail(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .slice(0, 160);
}

function sanitizeText(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
async function handleQuestions(request: Request, env: Env, url: URL): Promise<Response> {
  const partIdRaw = url.searchParams.get('partId');
  const partId = partIdRaw ? Number(partIdRaw) : 0;

  const columns = 'id, question_number, part_id, part_name, skill, media_files, passage, question, options';
  const statement =
    partId > 0
      ? env.DB.prepare(`SELECT ${columns} FROM questions WHERE part_id = ? ORDER BY question_number`).bind(partId)
      : env.DB.prepare(`SELECT ${columns} FROM questions ORDER BY question_number`);

  const { results } = await statement.all<ClientQuestionRow>();
  return json({ success: true, total: results.length, questions: results.map(toClientQuestion) }, request, env);
}

async function handlePublicConfig(request: Request, env: Env): Promise<Response> {
  const configs = await readConfig(env);
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM questions').first<{ n: number }>();

  return json(
    {
      success: true,
      exam_duration_minutes: Number(configs.exam_duration_minutes || 120),
      allow_instant_answers: configs.allow_instant_answers !== 'false',
      show_leaderboard: configs.show_leaderboard !== 'false',
      announcement_banner: configs.announcement_banner || '',
      total_questions: Number(total?.n || 0),
    },
    request,
    env
  );
}

async function handleLeaderboard(request: Request, env: Env, url: URL): Promise<Response> {
  const configs = await readConfig(env);
  if (configs.show_leaderboard === 'false') {
    return json({ success: true, entries: [], hidden: true }, request, env);
  }

  const requested = Number(url.searchParams.get('limit') || configs.leaderboard_size || 100);
  const limit = Math.min(500, Math.max(1, Number.isFinite(requested) ? requested : 100));
  const mode = url.searchParams.get('mode') === 'all' ? 'all' : 'best';

  // Xếp hạng đa tiêu chí: điểm cao hơn ➔ làm bài nhanh hơn ➔ nộp sớm hơn.
  // mode=best chỉ giữ lần thi tốt nhất của mỗi thí sinh (theo email) để tránh spam bảng điểm.
  const query =
    mode === 'best'
      ? `SELECT * FROM (
           SELECT *, ROW_NUMBER() OVER (
             PARTITION BY CASE WHEN candidate_email = '' THEN id ELSE candidate_email END
             ORDER BY total_scaled DESC, duration_seconds ASC, created_at ASC
           ) AS rn
           FROM results
         ) WHERE rn = 1
         ORDER BY total_scaled DESC, duration_seconds ASC, created_at ASC
         LIMIT ?`
      : `SELECT * FROM results ORDER BY total_scaled DESC, duration_seconds ASC, created_at ASC LIMIT ?`;

  const { results } = await env.DB.prepare(query).bind(limit).all<Record<string, any>>();
  const stats = await env.DB.prepare(
    'SELECT COUNT(*) AS attempts, MAX(total_scaled) AS best, AVG(total_scaled) AS average FROM results'
  ).first<{ attempts: number; best: number | null; average: number | null }>();

  const entries = results.map((row) => ({
    id: String(row.id),
    candidateName: String(row.candidate_name),
    candidateId: String(row.candidate_email || ''),
    targetScore: String(row.target_score || ''),
    totalCorrect: Number(row.total_correct),
    totalQuestions: Number(row.total_questions),
    listeningCorrect: Number(row.listening_correct),
    readingCorrect: Number(row.reading_correct),
    scaledListening: Number(row.scaled_listening),
    scaledReading: Number(row.scaled_reading),
    totalScaledScore: Number(row.total_scaled),
    cefrLevel: String(row.cefr_level),
    partAccuracy: JSON.parse(String(row.part_accuracy || '{}')),
    timeSpentSeconds: Number(row.duration_seconds),
    completedAt: formatVietnamTime(Number(row.created_at)),
  }));

  return json(
    {
      success: true,
      entries,
      stats: {
        totalAttempts: Number(stats?.attempts || 0),
        bestScore: Number(stats?.best || 0),
        averageScore: Math.round(Number(stats?.average || 0)),
      },
    },
    request,
    env
  );
}

async function handleCheckAnswer(request: Request, env: Env, body: Record<string, unknown>): Promise<Response> {
  const configs = await readConfig(env);
  if (configs.allow_instant_answers === 'false') {
    return fail('Quản trị viên đã tắt chế độ xem đáp án tức thì.', request, env, 403);
  }

  const questionId = String(body.questionId || '');
  const selected = String(body.selectedLetter || '')
    .trim()
    .toUpperCase();
  const email = normalizeEmail(body.email);

  if (!questionId) return fail('Thiếu mã câu hỏi', request, env);
  if (await isBanned(env, email)) {
    return fail('Tài khoản của bạn đã bị khóa truy cập bởi Quản trị viên.', request, env, 403);
  }

  const row = await env.DB.prepare('SELECT correct_letter, explanation FROM questions WHERE id = ?')
    .bind(questionId)
    .first<{ correct_letter: string; explanation: string }>();

  if (!row) return fail('Không tìm thấy câu hỏi', request, env, 404);

  return json(
    {
      success: true,
      isCorrect: selected === row.correct_letter.trim().toUpperCase(),
      correctLetter: row.correct_letter,
      explanation: row.explanation,
    },
    request,
    env
  );
}

async function handleGradeExam(request: Request, env: Env, body: Record<string, unknown>): Promise<Response> {
  const candidate = (body.candidate || {}) as Record<string, unknown>;
  const email = normalizeEmail(candidate.emailOrCode);
  const name = sanitizeText(candidate.name, 80) || 'Thí sinh';
  const targetScore = sanitizeText(candidate.targetScore, 16) || '650+';

  if (await isBanned(env, email)) {
    return fail('Tài khoản này đã bị khóa quyền nộp bài thi bởi Quản trị viên.', request, env, 403);
  }

  const submitted = (body.answers || {}) as Record<string, string>;
  const { results: rows } = await env.DB.prepare(
    'SELECT id, part_id, skill, correct_letter, explanation FROM questions'
  ).all<{ id: string; part_id: number; skill: string; correct_letter: string; explanation: string }>();

  if (rows.length === 0) {
    return fail('Ngân hàng câu hỏi trống. Vui lòng liên hệ Quản trị viên.', request, env, 503);
  }

  let totalCorrect = 0;
  let listeningTotal = 0;
  let listeningCorrect = 0;
  let readingTotal = 0;
  let readingCorrect = 0;
  const partTotal: Record<number, number> = {};
  const partCorrect: Record<number, number> = {};
  const reviewDetails: Record<string, { correctLetter: string; explanation: string; isCorrect: boolean }> = {};

  for (const row of rows) {
    const correctLetter = String(row.correct_letter).trim().toUpperCase();
    const choice = String(submitted[row.id] || '')
      .trim()
      .toUpperCase();
    const isCorrect = choice !== '' && choice === correctLetter;

    partTotal[row.part_id] = (partTotal[row.part_id] || 0) + 1;
    if (row.skill === 'Listening') listeningTotal++;
    else readingTotal++;

    if (isCorrect) {
      totalCorrect++;
      partCorrect[row.part_id] = (partCorrect[row.part_id] || 0) + 1;
      if (row.skill === 'Listening') listeningCorrect++;
      else readingCorrect++;
    }

    reviewDetails[row.id] = { correctLetter, explanation: row.explanation, isCorrect };
  }

  const scaledListening = scaledSection(listeningCorrect, listeningTotal);
  const scaledReading = scaledSection(readingCorrect, readingTotal);
  const totalScaled = scaledListening + scaledReading;
  const cefrLevel = cefrOf(totalScaled);

  const partAccuracy: Record<number, number> = {};
  for (const partIdKey of Object.keys(partTotal)) {
    const partId = Number(partIdKey);
    partAccuracy[partId] = Math.round(((partCorrect[partId] || 0) / partTotal[partId]) * 100);
  }

  const durationRaw = Number(body.durationSeconds || 0);
  const durationSeconds = Math.min(24 * 60 * 60, Math.max(0, Math.round(Number.isFinite(durationRaw) ? durationRaw : 0)));
  const now = Date.now();
  const examId = `EXAM-${now}-${Math.floor(Math.random() * 1e4)
    .toString()
    .padStart(4, '0')}`;

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO results (
         id, created_at, candidate_name, candidate_email, target_score,
         total_correct, total_questions, listening_correct, reading_correct,
         scaled_listening, scaled_reading, total_scaled, cefr_level, part_accuracy, duration_seconds
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      examId,
      now,
      name,
      email,
      targetScore,
      totalCorrect,
      rows.length,
      listeningCorrect,
      readingCorrect,
      scaledListening,
      scaledReading,
      totalScaled,
      cefrLevel,
      JSON.stringify(partAccuracy),
      durationSeconds
    ),
  ];

  if (email) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO users (email, name, status, total_exams, best_score, last_active, banned_reason)
         VALUES (?, ?, 'ACTIVE', 1, ?, ?, '')
         ON CONFLICT(email) DO UPDATE SET
           name = excluded.name,
           total_exams = users.total_exams + 1,
           best_score = MAX(users.best_score, excluded.best_score),
           last_active = excluded.last_active`
      ).bind(email, name, totalScaled, now)
    );
  }

  await env.DB.batch(statements);

  return json(
    {
      success: true,
      examResult: {
        id: examId,
        candidateName: name,
        candidateId: email,
        targetScore,
        totalCorrect,
        totalQuestions: rows.length,
        listeningCorrect,
        readingCorrect,
        scaledListening,
        scaledReading,
        totalScaledScore: totalScaled,
        cefrLevel,
        partAccuracy,
        timeSpentSeconds: durationSeconds,
        completedAt: formatVietnamTime(now),
      },
      reviewDetails,
    },
    request,
    env
  );
}

async function handleAdminLogin(request: Request, env: Env, body: Record<string, unknown>): Promise<Response> {
  const ip = clientIp(request);
  if (isLoginThrottled(ip)) {
    return fail('Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.', request, env, 429);
  }

  const configs = await readConfig(env);
  const storedHash = String(configs.admin_password_hash || '').toLowerCase();
  const inputHash = await sha256Hex(String(body.password || ''));

  if (!storedHash || !timingSafeEqual(inputHash, storedHash)) {
    recordLoginFailure(ip);
    return fail('Sai mật khẩu quản trị viên', request, env, 401);
  }

  loginAttempts.delete(ip);
  const { token, expiresAt } = await issueAdminToken(env);
  return json({ success: true, token, expiresAt }, request, env);
}

async function handleAdminData(request: Request, env: Env): Promise<Response> {
  const configs = await readConfig(env);
  const { results: users } = await env.DB.prepare(
    'SELECT email, name, status, total_exams, best_score, last_active, banned_reason FROM users ORDER BY last_active DESC'
  ).all<Record<string, any>>();
  const totals = await env.DB.prepare(
    'SELECT (SELECT COUNT(*) FROM results) AS results, (SELECT COUNT(*) FROM questions) AS questions'
  ).first<{ results: number; questions: number }>();

  // admin_password_hash không bao giờ được trả về client
  const { admin_password_hash: _hidden, ...publicConfigs } = configs;

  return json(
    {
      success: true,
      configs: publicConfigs,
      users: users.map((row) => ({
        email: String(row.email),
        name: String(row.name),
        status: String(row.status),
        totalExams: Number(row.total_exams),
        bestScore: Number(row.best_score),
        lastActive: row.last_active ? formatVietnamTime(Number(row.last_active)) : '',
        bannedReason: String(row.banned_reason || ''),
      })),
      totalResults: Number(totals?.results || 0),
      totalQuestions: Number(totals?.questions || 0),
    },
    request,
    env
  );
}

const EDITABLE_CONFIG_KEYS = new Set([
  'exam_duration_minutes',
  'allow_instant_answers',
  'show_leaderboard',
  'leaderboard_size',
  'announcement_banner',
]);

async function handleAdminUpdateConfig(request: Request, env: Env, body: Record<string, unknown>): Promise<Response> {
  const incoming = (body.newConfigs || {}) as Record<string, unknown>;
  const statements: D1PreparedStatement[] = [];
  const rejected: string[] = [];

  for (const [key, rawValue] of Object.entries(incoming)) {
    if (key === 'admin_password') {
      const newPassword = String(rawValue || '');
      if (newPassword.length < 8) {
        return fail('Mật khẩu quản trị viên mới phải có tối thiểu 8 ký tự.', request, env);
      }
      statements.push(
        env.DB.prepare(
          `INSERT INTO config (key, value, description) VALUES ('admin_password_hash', ?, 'Mật khẩu Quản trị viên đã băm SHA-256')
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind(await sha256Hex(newPassword))
      );
      continue;
    }

    if (!EDITABLE_CONFIG_KEYS.has(key)) {
      rejected.push(key);
      continue;
    }

    statements.push(
      env.DB.prepare(
        `INSERT INTO config (key, value, description) VALUES (?, ?, 'Cập nhật qua Admin Dashboard')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).bind(key, sanitizeText(rawValue, 500))
    );
  }

  if (statements.length > 0) await env.DB.batch(statements);

  return json(
    {
      success: true,
      message: 'Đã lưu cấu hình hệ thống',
      rejected,
    },
    request,
    env
  );
}

async function handleAdminBan(request: Request, env: Env, body: Record<string, unknown>): Promise<Response> {
  const email = normalizeEmail(body.email);
  if (!email) return fail('Thiếu email học viên', request, env);

  const status = body.isBanned ? 'BANNED' : 'ACTIVE';
  const reason = sanitizeText(body.reason, 300);

  await env.DB.prepare(
    `INSERT INTO users (email, name, status, total_exams, best_score, last_active, banned_reason)
     VALUES (?, 'Học viên', ?, 0, 0, ?, ?)
     ON CONFLICT(email) DO UPDATE SET status = excluded.status, banned_reason = excluded.banned_reason`
  )
    .bind(email, status, Date.now(), reason)
    .run();

  return json({ success: true, message: `Đã chuyển ${email} sang trạng thái ${status}` }, request, env);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      // ---- Public GET ----
      if (request.method === 'GET') {
        if (path === '/' || path === '/api' || path === '/api/health') {
          return json({ success: true, service: 'toeic-api', timestamp: Date.now() }, request, env);
        }
        if (path === '/api/questions') return handleQuestions(request, env, url);
        if (path === '/api/config') return handlePublicConfig(request, env);
        if (path === '/api/leaderboard') return handleLeaderboard(request, env, url);
        if (path === '/api/admin/data') {
          const denied = await requireAdmin(request, env);
          return denied || handleAdminData(request, env);
        }
        return fail('Không tìm thấy endpoint: ' + path, request, env, 404);
      }

      if (request.method !== 'POST') {
        return fail('Phương thức không được hỗ trợ', request, env, 405);
      }

      // ---- POST ----
      let body: Record<string, unknown> = {};
      const rawBody = await request.text();
      if (rawBody) {
        try {
          body = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          return fail('Payload JSON không hợp lệ', request, env);
        }
      }

      if (path === '/api/exam/grade') return handleGradeExam(request, env, body);
      if (path === '/api/practice/check') return handleCheckAnswer(request, env, body);
      if (path === '/api/admin/login') return handleAdminLogin(request, env, body);

      if (path === '/api/admin/config') {
        const denied = await requireAdmin(request, env);
        return denied || handleAdminUpdateConfig(request, env, body);
      }
      if (path === '/api/admin/ban') {
        const denied = await requireAdmin(request, env);
        return denied || handleAdminBan(request, env, body);
      }

      return fail('Không tìm thấy endpoint: ' + path, request, env, 404);
    } catch (error: any) {
      console.error('Worker error', error?.stack || error);
      return fail('Lỗi máy chủ: ' + (error?.message || String(error)), request, env, 500);
    }
  },
};
