export interface CEFRInfo {
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C1+';
  title: string;
  desc: string;
  color: string;
  badgeBg: string;
}

export function calculateScaledToeic(percent: number): number {
  if (isNaN(percent) || percent <= 0) return 10;
  const raw = 10 + (percent / 100) * 980;
  const rounded = Math.round(raw / 5) * 5;
  return Math.min(990, Math.max(10, rounded));
}

export function calculateSectionScaledScore(correct: number, total: number): number {
  if (total <= 0 || correct <= 0) return 5;
  const percent = correct / total;
  const raw = 5 + percent * 490;
  const rounded = Math.round(raw / 5) * 5;
  return Math.min(495, Math.max(5, rounded));
}

export function getCefrLevel(scaledScore: number): CEFRInfo {
  if (scaledScore >= 905) {
    return {
      level: 'C1+',
      title: 'Xuất sắc / Master',
      desc: 'Thành thạo gần như người bản xứ. Đọc hiểu và giao tiếp lưu loát mọi chuyên ngành phức tạp.',
      color: '#7c3aed',
      badgeBg: '#ede9fe',
    };
  }
  if (scaledScore >= 785) {
    return {
      level: 'C1',
      title: 'Nâng cao / Advanced',
      desc: 'Giao tiếp tốt trong mọi ngữ cảnh học thuật và công việc. Đáp ứng tiêu chuẩn quản lý quốc tế.',
      color: '#0284c7',
      badgeBg: '#e0f2fe',
    };
  }
  if (scaledScore >= 605) {
    return {
      level: 'B2',
      title: 'Khá / Upper Intermediate',
      desc: 'Sử dụng tiếng Anh độc lập, đáp ứng tiêu chuẩn làm việc tại các doanh nghiệp đa quốc gia.',
      color: '#059669',
      badgeBg: '#d1fae5',
    };
  }
  if (scaledScore >= 405) {
    return {
      level: 'B1',
      title: 'Trung cấp / Intermediate',
      desc: 'Hiểu các tình huống quen thuộc, đáp ứng chuẩn đầu ra đại học và giao tiếp công sở cơ bản.',
      color: '#d97706',
      badgeBg: '#fef3c7',
    };
  }
  if (scaledScore >= 255) {
    return {
      level: 'A2',
      title: 'Sơ cấp / Elementary',
      desc: 'Giao tiếp ở mức cơ bản, cần bổ sung nhiều từ vựng và ngữ pháp cho câu phức.',
      color: '#ea580c',
      badgeBg: '#ffedd5',
    };
  }
  return {
    level: 'A1',
    title: 'Cơ bản / Beginner',
    desc: 'Mới bắt đầu làm quen tiếng Anh, cần lộ trình học từ nền tảng phát âm và từ vựng cốt lõi.',
    color: '#dc2626',
    badgeBg: '#fee2e2',
  };
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
