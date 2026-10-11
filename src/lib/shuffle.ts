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
 * Xáo trộn các lựa chọn A, B, C, D của câu hỏi Reading (nếu cần) và cập nhật lại correctLetter
 */
function shuffleQuestionOptions(q: Question): Question {
  // Chỉ xáo trộn Part 5, 6, 7 và khi options có nội dung thực tế (không phải chỉ chữ cái A, B, C, D)
  if (q.skill !== 'Reading') return q;
  const isSimpleLetters = q.options.every((opt) => opt.text.trim() === opt.letter.trim());
  if (isSimpleLetters) return q;

  const shuffledOpts = shuffleArray(q.options);
  const letters = ['A', 'B', 'C', 'D'];

  const newOptions: Option[] = shuffledOpts.map((opt, idx) => ({
    ...opt,
    letter: letters[idx] || opt.letter,
  }));

  const correctOpt = newOptions.find((opt) => opt.isCorrect);
  const correctLetter = correctOpt ? correctOpt.letter : q.correctLetter;

  return {
    ...q,
    options: newOptions,
    correctLetter,
    correctAnswer: correctOpt ? `${correctLetter}. ${correctOpt.text}` : q.correctAnswer,
  };
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
    // Phân chia theo từng Part 1..7
    const parts = [1, 2, 3, 4, 5, 6, 7] as const;
    const finalQuestions: Question[] = [];

    for (const partId of parts) {
      const partQuestions = questions.filter((q) => q.partId === partId);
      if (partQuestions.length === 0) continue;

      // Gom nhóm theo audio/passage
      const clusters = groupQuestionsByMedia(partQuestions);
      // Xáo trộn các cụm câu hỏi
      const shuffledClusters = shuffleArray(clusters);

      // Duỗi phẳng mảng
      for (const cluster of shuffledClusters) {
        for (const q of cluster) {
          finalQuestions.push(shuffleReadingOptions ? shuffleQuestionOptions(q) : q);
        }
      }
    }

    return finalQuestions;
  }

  // Xáo trộn toàn bộ cụm không theo Part
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
