#!/usr/bin/env node
/**
 * Sinh file SQL seed ngân hàng câu hỏi cho Cloudflare D1 từ src/data/questions.full.json
 * (artifact do scripts/normalize-questions.mjs tạo ra — có chứa đáp án & giải thích).
 *
 * Kết quả: cloudflare/migrations/0002_seed_questions.sql
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const FULL_PATH = join(root, 'src/data/questions.full.json');
const OUT_PATH = join(root, 'cloudflare/migrations/0002_seed_questions.sql');

/** Escape chuỗi theo chuẩn SQLite (nhân đôi dấu nháy đơn) */
function q(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

const questions = JSON.parse(readFileSync(FULL_PATH, 'utf8'));
if (!Array.isArray(questions) || questions.length === 0) {
  console.error('❌ Không đọc được questions.full.json — hãy chạy `npm run data:normalize` trước.');
  process.exit(1);
}

const lines = [
  '-- Tự động sinh bởi scripts/build-seed-sql.mjs — KHÔNG sửa tay.',
  `-- Nguồn: src/data/questions.full.json (${questions.length} câu hỏi)`,
  '',
  'DELETE FROM questions;',
  '',
];

// Chia thành từng khối INSERT nhỏ để không vượt giới hạn kích thước câu lệnh của D1
const CHUNK_SIZE = 25;
for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
  const chunk = questions.slice(i, i + CHUNK_SIZE);
  const values = chunk
    .map((item) => {
      const options = item.options.map((opt) => ({ letter: opt.letter, text: opt.text }));
      return `  (${[
        q(item.id),
        Number(item.questionNumber),
        Number(item.partId),
        q(item.partName),
        q(item.skill),
        q(JSON.stringify(item.mediaFiles || [])),
        q(item.passage || ''),
        q(item.question || ''),
        q(JSON.stringify(options)),
        q(item.correctLetter),
        q(item.explanation || ''),
      ].join(', ')})`;
    })
    .join(',\n');

  lines.push(
    'INSERT INTO questions (id, question_number, part_id, part_name, skill, media_files, passage, question, options, correct_letter, explanation) VALUES',
    values + ';',
    ''
  );
}

writeFileSync(OUT_PATH, lines.join('\n'), 'utf8');
console.log(`✅ Đã sinh ${OUT_PATH}`);
console.log(`   ${questions.length} câu hỏi • ${Math.ceil(questions.length / CHUNK_SIZE)} khối INSERT`);
