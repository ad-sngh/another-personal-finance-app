import type { ReactNode } from 'react';

type CardTone = 'positive' | 'negative' | 'neutral';

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  deltaLabel?: string;
  tone?: CardTone;
  action?: ReactNode;
  hideSparkline?: boolean;
  sparkValues?: number[];
}

const toneClasses: Record<CardTone, string> = {
  positive: 'bg-soft-success/10 text-soft-success',
  negative: 'bg-soft-danger/10 text-soft-danger',
  neutral: 'bg-soft-secondary/10 text-soft-secondary',
};

export default function StatsCard({
  title,
  value,
  subtitle,
  deltaLabel,
  tone = 'neutral',
  action,
  hideSparkline = false,
  sparkValues,
}: StatsCardProps) {
  const values = sparkValues && sparkValues.length >= 2 ? sparkValues : [5, 6, 5.4, 7, 6.2, 7.5, 8.5];
  const width = 140;
  const height = 48;
  const padding = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * (width - padding * 2) + padding;
    const y = height - ((value - min) / range) * (height - padding * 2) - padding;
    return { x, y };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="rounded-2xl bg-soft-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-soft-secondary">{title}</p>
          <p className="mt-1 text-2xl font-bold text-soft-dark">{value}</p>
          {subtitle && <p className="text-xs text-soft-secondary mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
      {deltaLabel && (
        <div className={`mt-3 inline-flex items-center rounded-full px-3 py-0.5 text-[11px] font-semibold ${toneClasses[tone]}`}>
          {deltaLabel}
        </div>
      )}
      {!hideSparkline && (
        <div className="mt-3 rounded-xl bg-blue-50/60 p-1.5">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" preserveAspectRatio="none">
            <defs>
              <linearGradient id="spark-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(59,130,246,0.35)" />
                <stop offset="100%" stopColor="rgba(59,130,246,0)" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#spark-gradient)" stroke="none" />
            <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  );
}
