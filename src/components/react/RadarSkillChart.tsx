import React from 'react';
import { getCefrLevel } from '../../lib/score';

interface RadarChartProps {
  partAccuracy: Record<number, number>; // partId (1-7) -> accuracy percent (0-100)
  totalScaledScore: number;
}

export const RadarSkillChart: React.FC<RadarChartProps> = ({
  partAccuracy,
  totalScaledScore,
}) => {
  const cefr = getCefrLevel(totalScaledScore);

  const parts = [
    { id: 1, label: 'Part 1: Tranh' },
    { id: 2, label: 'Part 2: Hỏi-Đáp' },
    { id: 3, label: 'Part 3: Thoại' },
    { id: 4, label: 'Part 4: Bài nói' },
    { id: 5, label: 'Part 5: Điền câu' },
    { id: 6, label: 'Part 6: Đoạn văn' },
    { id: 7, label: 'Part 7: Đọc hiểu' },
  ];

  const size = 320;
  const center = size / 2;
  const radius = 105;
  const totalPoints = parts.length;

  const getCoordinates = (index: number, valuePercent: number) => {
    const angle = (Math.PI * 2 / totalPoints) * index - Math.PI / 2;
    const r = (valuePercent / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  const polygonPoints = parts
    .map((part, i) => {
      const val = Math.max(15, partAccuracy[part.id] ?? 0);
      const { x, y } = getCoordinates(i, val);
      return `${x},${y}`;
    })
    .join(' ');

  // Grid levels (25%, 50%, 75%, 100%)
  const gridLevels = [25, 50, 75, 100];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Phân Tích 7 Kỹ Năng & Trình Độ CEFR
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Biểu đồ mạng nhện đánh giá độ đồng đều giữa các phần thi
          </p>
        </div>
        <div
          className="px-4 py-2 rounded-xl text-center border font-bold"
          style={{ backgroundColor: cefr.badgeBg, color: cefr.color, borderColor: cefr.color + '40' }}
        >
          <div className="text-xs tracking-wider uppercase font-semibold">Khung chuẩn CEFR</div>
          <div className="text-xl font-extrabold">{cefr.level}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-4">
        {/* SVG Radar */}
        <div className="flex justify-center items-center">
          <svg width={size} height={size} className="overflow-visible">
            {/* Concentric polygons */}
            {gridLevels.map((lvl) => {
              const pts = parts
                .map((_, i) => {
                  const { x, y } = getCoordinates(i, lvl);
                  return `${x},${y}`;
                })
                .join(' ');
              return (
                <polygon
                  key={lvl}
                  points={pts}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth="1"
                  strokeDasharray={lvl === 100 ? 'none' : '3 3'}
                  className="dark:stroke-slate-700"
                />
              );
            })}

            {/* Axis lines */}
            {parts.map((_, i) => {
              const { x, y } = getCoordinates(i, 100);
              return (
                <line
                  key={i}
                  x1={center}
                  y1={center}
                  x2={x}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  className="dark:stroke-slate-700"
                />
              );
            })}

            {/* Data Polygon */}
            <polygon
              points={polygonPoints}
              fill="rgba(2, 132, 199, 0.25)"
              stroke="#0284c7"
              strokeWidth="2.5"
            />

            {/* Data Dots & Labels */}
            {parts.map((part, i) => {
              const val = Math.max(15, partAccuracy[part.id] ?? 0);
              const dot = getCoordinates(i, val);
              const labelPos = getCoordinates(i, 122);
              return (
                <g key={part.id}>
                  <circle cx={dot.x} cy={dot.y} r="4.5" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="text-[11px] font-semibold fill-slate-700 dark:fill-slate-300"
                  >
                    {part.label.split(':')[0]} ({partAccuracy[part.id] ?? 0}%)
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Detailed Breakdown Bars */}
        <div className="space-y-2.5">
          {parts.map((part) => {
            const acc = partAccuracy[part.id] ?? 0;
            const isHigh = acc >= 80;
            const isMedium = acc >= 50 && acc < 80;
            return (
              <div key={part.id} className="text-xs">
                <div className="flex justify-between font-medium mb-1 text-slate-700 dark:text-slate-300">
                  <span>{part.label}</span>
                  <span className="font-bold">{acc}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isHigh ? 'bg-emerald-500' : isMedium ? 'bg-sky-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${acc}%` }}
                  />
                </div>
              </div>
            );
          })}

          <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-bold text-slate-900 dark:text-white">Đánh giá: </span>
            {cefr.title} — {cefr.desc}
          </div>
        </div>
      </div>
    </div>
  );
};
