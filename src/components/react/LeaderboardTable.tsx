import React, { useState, useEffect } from 'react';
import type { ExamResult } from '../../data/types';
import { Storage } from '../../lib/storage';
import { Trophy, Medal, Download, Search, Users, Award, TrendingUp } from 'lucide-react';

export const LeaderboardTable: React.FC = () => {
  const [list, setList] = useState<ExamResult[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    setList(Storage.getLeaderboard());
  }, []);

  const filtered = list.filter((item) =>
    item.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.candidateId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalParticipants = list.length;
  const maxScore = list.reduce((max, cur) => Math.max(max, cur.totalScaledScore), 0);
  const avgScore = totalParticipants > 0
    ? Math.round(list.reduce((sum, cur) => sum + cur.totalScaledScore, 0) / totalParticipants)
    : 0;

  const exportCSV = () => {
    if (list.length === 0) return;

    let csvContent = 'STT,Họ và Tên,Mã Học Viên,Mục Tiêu,Điểm TOEIC,Số Câu Đúng,Thời Gian,Xếp Loại,Ngày Thi\n';

    list.forEach((item, idx) => {
      const mins = Math.floor(item.timeSpentSeconds / 60);
      const secs = item.timeSpentSeconds % 60;
      const duration = `${mins}m ${secs}s`;
      csvContent += `${idx + 1},"${item.candidateName}","${item.candidateId}","${item.targetScore}",${item.totalScaledScore},"${item.totalCorrect}/${item.totalQuestions}","${duration}","${item.cefrLevel}","${item.completedAt}"\n`;
    });

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `TOEIC_Leaderboard_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng Lượt Thi</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{totalParticipants}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Điểm Cao Nhất</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{maxScore} / 990</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Điểm Trung Bình</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{avgScore} / 990</div>
          </div>
        </div>
      </div>

      {/* Filter & Export Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên hoặc mã học viên..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
          />
        </div>

        <button
          type="button"
          onClick={exportCSV}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors border border-slate-200 dark:border-slate-700"
        >
          <Download className="w-4 h-4" />
          <span>Xuất Báo Cáo CSV</span>
        </button>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4 text-center">Hạng</th>
                <th className="py-3.5 px-4">Thí Sinh</th>
                <th className="py-3.5 px-4 text-center">Điểm TOEIC</th>
                <th className="py-3.5 px-4 text-center">Tỉ Lệ Đúng</th>
                <th className="py-3.5 px-4 text-center">Thời Gian</th>
                <th className="py-3.5 px-4 text-right">Ngày Thi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((item, idx) => {
                const mins = Math.floor(item.timeSpentSeconds / 60);
                const secs = item.timeSpentSeconds % 60;
                const isTop1 = idx === 0;
                const isTop2 = idx === 1;
                const isTop3 = idx === 2;

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                      isTop1 ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 text-center font-bold">
                      {isTop1 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-slate-950 shadow-sm">
                          🥇
                        </span>
                      ) : isTop2 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-900 shadow-sm">
                          🥈
                        </span>
                      ) : isTop3 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/60 text-white shadow-sm">
                          🥉
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">#{idx + 1}</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{item.candidateName}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{item.candidateId}</span>
                        <span>•</span>
                        <span>Mục tiêu: {item.targetScore}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-3 py-1 rounded-xl bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 font-extrabold text-sm border border-amber-300 dark:border-amber-700">
                        {item.totalScaledScore}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center font-medium text-slate-600 dark:text-slate-300">
                      {item.totalCorrect} / {item.totalQuestions}
                      <span className="text-slate-400 text-xs ml-1">
                        ({Math.round((item.totalCorrect / item.totalQuestions) * 100)}%)
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono text-slate-500">
                      {mins}:{secs < 10 ? '0' : ''}{secs}
                    </td>

                    <td className="py-3.5 px-4 text-right text-xs text-slate-400">
                      {item.completedAt}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
