#!/usr/bin/env node
/**
 * Chuẩn hóa ngân hàng câu hỏi gốc (src/data/questions.json) thành 2 artifact:
 *
 *   1. src/data/questions.full.json   — Đầy đủ đáp án + giải thích (chỉ dùng để seed Cloudflare D1)
 *   2. src/data/questions.public.json — Đã loại bỏ đáp án (artifact duy nhất được build vào trang web)
 *
 * Việc chuẩn hóa xử lý 2 vấn đề của dữ liệu gốc:
 *   - Câu hỏi Part 6 dạng `mct` chứa nhiều chỗ trống lồng nhau (options = danh sách blank)
 *     khiến giao diện render ra các đáp án rỗng. Mỗi blank được tách thành 1 câu hỏi độc lập.
 *   - Đáp án đúng (`correctLetter`, `isCorrect`, `explanation`) bị đóng gói vào bundle client
 *     nên thí sinh có thể đọc trực tiếp từ JS. Artifact public không còn các trường này.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const RAW_PATH = join(root, 'src/data/questions.json');
const FULL_PATH = join(root, 'src/data/questions.full.json');
const PUBLIC_PATH = join(root, 'src/data/questions.public.json');

/** Tách phần đề bài và phần passage của câu hỏi Part 6 dạng điền đoạn văn */
function splitPassage(rawQuestion) {
  const marker = rawQuestion.indexOf('Passage:');
  if (marker === -1) {
    return { intro: rawQuestion.trim(), passage: '' };
  }
  return {
    intro: rawQuestion.slice(0, marker).trim(),
    passage: rawQuestion.slice(marker + 'Passage:'.length).trim(),
  };
}

function normalizeOptions(options) {
  return options
    .map((opt) => ({
      letter: String(opt.letter || '').trim(),
      text: String(opt.text ?? '').trim(),
      isCorrect: Boolean(opt.isCorrect),
    }))
    .filter((opt) => opt.letter.length > 0);
}

function correctLetterOf(options, fallback) {
  const hit = options.find((opt) => opt.isCorrect);
  return hit ? hit.letter : String(fallback || '').trim();
}

/** Câu hỏi 1 đáp án thông thường (Part 1-5, 7) */
function normalizeSimple(raw) {
  const options = normalizeOptions(raw.options);
  return [
    {
      id: raw.id,
      sourceId: raw.id,
      partId: Number(raw.partId),
      partName: String(raw.partName || ''),
      skill: raw.skill === 'Listening' ? 'Listening' : 'Reading',
      mediaFiles: Array.isArray(raw.mediaFiles) ? raw.mediaFiles : [],
      passage: String(raw.passage || ''),
      question: String(raw.question || '').trim(),
      options,
      correctLetter: correctLetterOf(options, raw.correctLetter),
      explanation: String(raw.explanation || ''),
      sourceNumber: Number(raw.questionNumber) || 0,
      blankNumber: 0,
    },
  ];
}

/** Câu hỏi Part 6 nhiều chỗ trống → tách thành từng câu hỏi độc lập theo blank */
function normalizeMultiBlank(raw) {
  const { intro, passage } = splitPassage(String(raw.question || ''));

  return raw.options.map((blank) => {
    const options = normalizeOptions(blank.options || []);
    const blankNumber = Number(blank.blankNumber) || 1;

    return {
      id: `${raw.id}#${blankNumber}`,
      sourceId: raw.id,
      partId: Number(raw.partId),
      partName: String(raw.partName || ''),
      skill: raw.skill === 'Listening' ? 'Listening' : 'Reading',
      mediaFiles: Array.isArray(raw.mediaFiles) ? raw.mediaFiles : [],
      passage: passage,
      question: `${intro ? intro + '\n\n' : ''}Chọn đáp án đúng cho [___Blank #${blankNumber}___]`,
      options,
      correctLetter: correctLetterOf(options, blank.correctAnswer),
      explanation: String(raw.explanation || ''),
      sourceNumber: Number(raw.questionNumber) || 0,
      blankNumber,
    };
  });
}

export function normalizeQuestionBank(rawBank) {
  const flattened = [];

  for (const raw of rawBank) {
    const isMultiBlank =
      raw.type === 'mct' || (Array.isArray(raw.options) && raw.options.some((opt) => opt && Array.isArray(opt.options)));
    flattened.push(...(isMultiBlank ? normalizeMultiBlank(raw) : normalizeSimple(raw)));
  }

  // Sắp xếp Part 1 -> Part 7, trong Part giữ nguyên thứ tự đề gốc rồi tới thứ tự blank
  flattened.sort((a, b) => {
    if (a.partId !== b.partId) return a.partId - b.partId;
    if (a.sourceNumber !== b.sourceNumber) return a.sourceNumber - b.sourceNumber;
    return a.blankNumber - b.blankNumber;
  });

  return flattened.map((q, idx) => {
    const { sourceNumber, blankNumber, ...rest } = q;
    return { ...rest, questionNumber: idx + 1 };
  });
}

export function toPublicQuestion(question) {
  return {
    id: question.id,
    questionNumber: question.questionNumber,
    partId: question.partId,
    partName: question.partName,
    skill: question.skill,
    mediaFiles: question.mediaFiles,
    passage: question.passage,
    question: question.question,
    options: question.options.map((opt) => ({ letter: opt.letter, text: opt.text })),
  };
}

function validate(bank) {
  const problems = [];
  const seen = new Set();

  for (const q of bank) {
    if (seen.has(q.id)) problems.push(`Trùng id: ${q.id}`);
    seen.add(q.id);

    if (!q.correctLetter) problems.push(`Câu ${q.questionNumber} (${q.id}) thiếu đáp án đúng`);
    if (q.options.length < 2) problems.push(`Câu ${q.questionNumber} (${q.id}) có ít hơn 2 lựa chọn`);
    if (q.correctLetter && !q.options.some((opt) => opt.letter === q.correctLetter)) {
      problems.push(`Câu ${q.questionNumber} (${q.id}) có đáp án đúng "${q.correctLetter}" không nằm trong lựa chọn`);
    }
    if (q.options.some((opt) => !opt.text)) {
      problems.push(`Câu ${q.questionNumber} (${q.id}) có lựa chọn rỗng`);
    }
  }

  return problems;
}

function main() {
  const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));
  const full = normalizeQuestionBank(raw);
  const problems = validate(full);

  if (problems.length > 0) {
    console.error('❌ Ngân hàng câu hỏi không hợp lệ:');
    problems.forEach((p) => console.error('   - ' + p));
    process.exit(1);
  }

  writeFileSync(FULL_PATH, JSON.stringify(full, null, 2) + '\n', 'utf8');
  writeFileSync(PUBLIC_PATH, JSON.stringify(full.map(toPublicQuestion), null, 2) + '\n', 'utf8');

  const byPart = full.reduce((acc, q) => {
    acc[q.partId] = (acc[q.partId] || 0) + 1;
    return acc;
  }, {});

  console.log(`✅ Chuẩn hóa ${raw.length} câu gốc → ${full.length} câu hỏi độc lập`);
  console.log(
    '   Phân bổ:',
    Object.entries(byPart)
      .map(([p, n]) => `P${p}=${n}`)
      .join('  ')
  );
  console.log(`   Listening: ${full.filter((q) => q.skill === 'Listening').length} câu`);
  console.log(`   Reading:   ${full.filter((q) => q.skill === 'Reading').length} câu`);
  console.log(`   → ${FULL_PATH}`);
  console.log(`   → ${PUBLIC_PATH} (không chứa đáp án)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
