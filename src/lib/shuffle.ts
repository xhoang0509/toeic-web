import type { Question, Option } from '../data/types';

/**
 * Thuật toán Fisher-Yates xáo trộn mảng không thiên vị (unbiased shuffle)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface ShuffleOptions {
  /** Giữ nguyên thứ tự Part 1 -> Part 7, chỉ xáo trộn câu hỏi bên trong mỗi Part */
  keepPartsInOrder?: boolean;
  /** Xáo trộn các lựa chọn đáp án (chỉ áp dụng cho Reading Part 5-7 có nội dung chữ) */
  shuffleReadingOptions?: boolean;
}

const DISPLAY_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Nhóm các câu hỏi dùng chung media (audio/hình ảnh) để không làm đứt mạch bài nghe
 */
function groupQuestionsByMedia(questions: Question[]): Question[][] {
  const clusters: Question[][] = [];
  const mediaToClusterIndex = new Map<string, number>();

  for (const q of questions) {
    const primaryMedia = q.mediaFiles?.[0]?.file;
    if (primaryMedia && mediaToClusterIndex.has(primaryMedia)) {
      const idx = mediaToClusterIndex.get(primaryMedia)!;
      clusters[idx].push(q);
    } else {
      const newCluster = [q];
      const newIdx = clusters.length;
      clusters.push(newCluster);
      if (primaryMedia) {
        mediaToClusterIndex.set(primaryMedia, newIdx);
      }
    }
  }

  return clusters;
}

/**
 * Xáo trộn lựa chọn A, B, C, D của câu hỏi Reading.
 *
 * Nhãn hiển thị được gán lại theo vị trí mới, nhưng nhãn gốc được giữ trong
 * `originalLetter` — đây là nhãn bắt buộc phải gửi lên server khi chấm điểm,
 * vì server chỉ lưu đáp án theo nhãn gốc của ngân hàng đề.
 */
function shuffleQuestionOptions(q: Question): Question {
  // Part 1-4 chỉ có nhãn A/B/C/D (nội dung nằm trong audio) nên không xáo trộn được
  if (q.skill !== 'Reading') return q;
  const isSimpleLetters = q.options.every((opt) => opt.text.trim() === opt.letter.trim());
  if (isSimpleLetters) return q;

  const newOptions: Option[] = shuffleArray(q.options).map((opt, idx) => ({
    ...opt,
    letter: DISPLAY_LETTERS[idx] || opt.letter,
    originalLetter: opt.originalLetter || opt.letter,
  }));

  return { ...q, options: newOptions };
}

/**
 * Đổi nhãn đang hiển thị → nhãn gốc trong ngân hàng đề (để gửi lên server chấm điểm)
 */
export function toOriginalLetter(question: Question, displayedLetter: string): string {
  const option = question.options.find((opt) => opt.letter === displayedLetter);
  return option?.originalLetter || displayedLetter;
}

/**
 * Đổi nhãn gốc do server trả về → nhãn đang hiển thị trên giao diện
 */
export function toDisplayedLetter(question: Question, originalLetter: string): string {
  const option = question.options.find(
    (opt) => (opt.originalLetter || opt.letter) === originalLetter
  );
  return option?.letter || originalLetter;
}

/**
 * Chuyển toàn bộ map đáp án người dùng chọn (theo nhãn hiển thị) sang nhãn gốc
 */
export function mapAnswersToOriginalLetters(
  questions: Question[],
  answers: Record<string, string>
): Record<string, string> {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const mapped: Record<string, string> = {};

  for (const [questionId, displayedLetter] of Object.entries(answers)) {
    const question = byId.get(questionId);
    mapped[questionId] = question ? toOriginalLetter(question, displayedLetter) : displayedLetter;
  }

  return mapped;
}

/**
 * Xáo trộn ngân hàng câu hỏi TOEIC thông minh:
 * - Bảo đảm các câu hỏi cùng 1 bài nghe/hội thoại đi liền với nhau
 * - Xáo trộn thứ tự các nhóm câu hỏi trong từng Part
 * - Tùy chọn xáo trộn đáp án đọc hiểu
 */
export function shuffleToeicQuestions(
  questions: Question[],
  options: ShuffleOptions = {}
): Question[] {
  const { keepPartsInOrder = true, shuffleReadingOptions = false } = options;

  if (keepPartsInOrder) {
    const parts = [1, 2, 3, 4, 5, 6, 7] as const;
    const finalQuestions: Question[] = [];

    for (const partId of parts) {
      const partQuestions = questions.filter((q) => q.partId === partId);
      if (partQuestions.length === 0) continue;

      const clusters = groupQuestionsByMedia(partQuestions);
      const shuffledClusters = shuffleArray(clusters);

      for (const cluster of shuffledClusters) {
        for (const q of cluster) {
          finalQuestions.push(shuffleReadingOptions ? shuffleQuestionOptions(q) : q);
        }
      }
    }

    return finalQuestions;
  }

  const clusters = groupQuestionsByMedia(questions);
  const shuffledClusters = shuffleArray(clusters);
  const flat: Question[] = [];

  for (const cluster of shuffledClusters) {
    for (const q of cluster) {
      flat.push(shuffleReadingOptions ? shuffleQuestionOptions(q) : q);
    }
  }

  return flat;
}
