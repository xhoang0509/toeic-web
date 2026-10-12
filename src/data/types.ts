export interface MediaFile {
  type: 'audio' | 'image';
  file: string;
}

export interface Option {
  /** Nhãn hiển thị (A, B, C, D) — có thể bị đổi khi xáo trộn đáp án */
  letter: string;
  text: string;
  /**
   * Nhãn gốc trong ngân hàng đề. Khi xáo trộn đáp án, đây là nhãn phải gửi lên
   * server để chấm điểm, vì server chỉ biết đáp án theo nhãn gốc.
   */
  originalLetter?: string;
}

/**
 * Câu hỏi ở dạng công khai (src/data/questions.public.json).
 * Không chứa `correctLetter` / `explanation`: đáp án chỉ tồn tại trong Cloudflare D1.
 */
export interface Question {
  id: string;
  questionNumber: number;
  partId: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  partName: string;
  skill: 'Listening' | 'Reading';
  mediaFiles?: MediaFile[];
  question: string;
  options: Option[];
  passage?: string;
}

export interface UserAccount {
  email: string;
  name: string;
  status: 'ACTIVE' | 'BANNED';
  totalExams: number;
  bestScore: number;
  lastActive: string;
  bannedReason?: string;
}

export interface PartMeta {
  id: number;
  slug: string;
  name: string;
  title: string;
  skill: 'Listening' | 'Reading';
  questionCount: number;
  description: string;
  strategy: string;
  timeRecommendation: string;
}

export interface CandidateInfo {
  name: string;
  emailOrCode: string;
  targetScore: string;
  startTime?: number;
}

export interface ExamResult {
  id: string;
  candidateName: string;
  candidateId: string;
  targetScore: string;
  totalCorrect: number;
  totalQuestions: number;
  listeningCorrect: number;
  readingCorrect: number;
  scaledListening: number;
  scaledReading: number;
  totalScaledScore: number;
  cefrLevel: string;
  partAccuracy: Record<number, number>;
  timeSpentSeconds: number;
  completedAt: string;
}

export interface MistakeItem {
  questionId: string;
  selectedLetter: string;
  timestamp: number;
  /** Đáp án đúng do server trả về lúc ghi nhận câu sai */
  correctLetter?: string;
  /** Lời giải thích do server trả về lúc ghi nhận câu sai */
  explanation?: string;
}

export const PARTS_META: PartMeta[] = [
  {
    id: 1,
    slug: 'part-1',
    name: 'Part 1',
    title: 'Mô tả tranh (Photographs)',
    skill: 'Listening',
    questionCount: 12,
    description: 'Quan sát tranh đen trắng và nghe 4 câu miêu tả để chọn đáp án đúng nhất về hành động hoặc trạng thái đồ vật.',
    strategy: 'Tập trung vào thì hiện tại tiếp diễn, vị trí không gian và các chi tiết bẫy âm thanh tương đồng.',
    timeRecommendation: 'Nghe theo tốc độ bài thi, trả lời trong 5s sau khi đọc xong đáp án',
  },
  {
    id: 2,
    slug: 'part-2',
    name: 'Part 2',
    title: 'Hỏi & Đáp (Question - Response)',
    skill: 'Listening',
    questionCount: 49,
    description: 'Nghe một câu hỏi hoặc phát biểu và chọn câu hồi đáp phù hợp nhất trong 3 phương án A, B, C.',
    strategy: 'Chú ý từ để hỏi (Who, Where, When, Why, How), cẩn thận với bẫy từ đồng âm và câu trả lời gián tiếp.',
    timeRecommendation: 'Phản xạ ngay sau khi nghe đáp án C, không chần chừ',
  },
  {
    id: 3,
    slug: 'part-3',
    name: 'Part 3',
    title: 'Đoạn hội thoại (Short Conversations)',
    skill: 'Listening',
    questionCount: 15,
    description: 'Nghe đoạn hội thoại giữa 2 hoặc 3 người và trả lời nhóm 3 câu hỏi liên quan.',
    strategy: 'Đọc trước câu hỏi và các lựa chọn trong thời gian đọc hướng dẫn. Nắm bắt mạch cảm xúc và ngữ cảnh cuộc trò chuyện.',
    timeRecommendation: 'Đọc trước câu hỏi trong 8s trước mỗi đoạn hội thoại',
  },
  {
    id: 4,
    slug: 'part-4',
    name: 'Part 4',
    title: 'Bài nói ngắn (Short Talks)',
    skill: 'Listening',
    questionCount: 15,
    description: 'Nghe một bài độc thoại (thông báo, bản tin, tin nhắn thoại, bài thuyết trình) và trả lời 3 câu hỏi.',
    strategy: 'Xác định loại bài nói (sân bay, thời tiết, họp nội bộ), chú ý các mốc thời gian và yêu cầu hành động kế tiếp.',
    timeRecommendation: 'Đọc lướt 3 câu hỏi trước khi loa phát',
  },
  {
    id: 5,
    slug: 'part-5',
    name: 'Part 5',
    title: 'Điền câu (Incomplete Sentences)',
    skill: 'Reading',
    questionCount: 60,
    description: 'Chọn từ hoặc cụm từ thích hợp nhất để hoàn thành câu đơn lẻ.',
    strategy: 'Phân loại câu hỏi từ loại (noun/verb/adj/adv) hay từ vựng/ngữ pháp để áp dụng mẹo loại suy nhanh chóng.',
    timeRecommendation: 'Tối đa 30 giây cho mỗi câu hỏi',
  },
  {
    id: 6,
    slug: 'part-6',
    name: 'Part 6',
    title: 'Điền đoạn văn (Text Completion)',
    skill: 'Reading',
    questionCount: 24,
    description: 'Điền từ, cụm từ hoặc cả câu vào chỗ trống trong các bức thư điện tử, thông báo, bài báo ngắn. Mỗi đoạn văn có 3 chỗ trống và mỗi chỗ trống được tính là một câu hỏi riêng.',
    strategy: 'Đọc câu trước và sau chỗ trống để hiểu ngữ cảnh, đặc biệt chú ý câu nối chuyển ý logic.',
    timeRecommendation: 'Khoảng 2 - 3 phút cho mỗi bài đọc 4 câu',
  },
  {
    id: 7,
    slug: 'part-7',
    name: 'Part 7',
    title: 'Đọc hiểu đoạn văn (Reading Comprehension)',
    skill: 'Reading',
    questionCount: 24,
    description: 'Đọc các văn bản đơn hoặc đoạn văn kép/ba (email, biểu mẫu, bài báo) để trả lời câu hỏi đọc hiểu.',
    strategy: 'Xác định câu hỏi ý chính, câu hỏi chi tiết và câu hỏi suy luận. Đọc lướt (skimming) và dò tìm từ khóa (scanning).',
    timeRecommendation: 'Phân bổ 55 - 60 phút cho toàn bộ Part 7 trong bài thi thật',
  },
];
