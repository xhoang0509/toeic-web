-- ====================================================================
-- TOEIC Online Assessment — Cloudflare D1 schema (SQLite)
-- Thay thế hoàn toàn backend Google Apps Script / Google Sheets.
--
-- 4 bảng:
--   questions — ngân hàng câu hỏi + đáp án bí mật (không bao giờ gửi về client)
--   results   — lịch sử nộp bài đã chấm điểm (nguồn dữ liệu Bảng Xếp Hạng)
--   users     — học viên duy nhất theo email, thống kê & BAN/UNBAN
--   config    — cấu hình hệ thống (mật khẩu admin đã hash, banner, thời gian thi…)
-- ====================================================================

DROP TABLE IF EXISTS questions;
CREATE TABLE questions (
  id              TEXT PRIMARY KEY,
  question_number INTEGER NOT NULL,
  part_id         INTEGER NOT NULL,
  part_name       TEXT    NOT NULL DEFAULT '',
  skill           TEXT    NOT NULL CHECK (skill IN ('Listening', 'Reading')),
  media_files     TEXT    NOT NULL DEFAULT '[]',
  passage         TEXT    NOT NULL DEFAULT '',
  question        TEXT    NOT NULL DEFAULT '',
  options         TEXT    NOT NULL DEFAULT '[]',
  correct_letter  TEXT    NOT NULL,
  explanation     TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX idx_questions_part ON questions (part_id, question_number);

DROP TABLE IF EXISTS results;
CREATE TABLE results (
  id                TEXT PRIMARY KEY,
  created_at        INTEGER NOT NULL,
  candidate_name    TEXT    NOT NULL,
  candidate_email   TEXT    NOT NULL DEFAULT '',
  target_score      TEXT    NOT NULL DEFAULT '650+',
  total_correct     INTEGER NOT NULL DEFAULT 0,
  total_questions   INTEGER NOT NULL DEFAULT 0,
  listening_correct INTEGER NOT NULL DEFAULT 0,
  reading_correct   INTEGER NOT NULL DEFAULT 0,
  scaled_listening  INTEGER NOT NULL DEFAULT 0,
  scaled_reading    INTEGER NOT NULL DEFAULT 0,
  total_scaled      INTEGER NOT NULL DEFAULT 0,
  cefr_level        TEXT    NOT NULL DEFAULT 'A1',
  part_accuracy     TEXT    NOT NULL DEFAULT '{}',
  duration_seconds  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_results_rank ON results (total_scaled DESC, duration_seconds ASC, created_at ASC);
CREATE INDEX idx_results_email ON results (candidate_email);

DROP TABLE IF EXISTS users;
CREATE TABLE users (
  email         TEXT PRIMARY KEY,
  name          TEXT    NOT NULL DEFAULT '',
  status        TEXT    NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BANNED')),
  total_exams   INTEGER NOT NULL DEFAULT 0,
  best_score    INTEGER NOT NULL DEFAULT 0,
  last_active   INTEGER NOT NULL DEFAULT 0,
  banned_reason TEXT    NOT NULL DEFAULT ''
);

DROP TABLE IF EXISTS config;
CREATE TABLE config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT ''
);

-- Mật khẩu admin mặc định: admin@toeic2026 (SHA-256). Đổi ngay sau lần đăng nhập đầu tiên.
INSERT INTO config (key, value, description) VALUES
  ('admin_password_hash', 'a702afda70969bec292450dcbac6d502c7f3c884eaf942d15d711fe65e81f63c', 'Mật khẩu Quản trị viên đã băm SHA-256 (mặc định: admin@toeic2026)'),
  ('exam_duration_minutes', '120', 'Thời gian làm bài thi thử (phút)'),
  ('allow_instant_answers', 'true', 'Cho phép chấm đáp án tức thì trong chế độ luyện tập'),
  ('show_leaderboard', 'true', 'Hiển thị Bảng Xếp Hạng công khai'),
  ('leaderboard_size', '100', 'Số thí sinh hiển thị tối đa trên Bảng Xếp Hạng'),
  ('announcement_banner', 'Chào mừng bạn đến với hệ thống thi thử TOEIC Online chuẩn ETS 2026!', 'Thông báo chạy trên thanh Top Bar');
