import type { ReactNode } from 'react';

type CardTone = 'positive' | 'negative' | 'neutral';

interface StatsCardProps {
  title: string;
  value?: ReactNode;
  subtitle?: ReactNode;
  deltaLabel?: ReactNode;
  tone?: CardTone;
  action?: ReactNode;
  hideSparkline?: boolean;
  sparkValues?: number[];
  customBody?: ReactNode;
  sparklineWidth?: number;
  footer?: ReactNode;
}

const toneClasses: Record<CardTone, string> = {
  positive: 'bg-emerald-100 text-emerald-800',
  negative: 'bg-rose-100 text-rose-700',
  neutral: 'bg-slate-200 text-slate-700',
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
  customBody,
  sparklineWidth,
  footer,
}: StatsCardProps) {
  const values = sparkValues && sparkValues.length >= 2 ? sparkValues : [5, 6, 5.4, 7, 6.2, 7.5, 8.5];
  const width = sparklineWidth ?? 200;
  const height = 32;
  const padding = 2.5;
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

  const sparklineLabel = `${title} trend sparkline`;

  return (
    <div className="rounded-lg bg-soft-white p-3 shadow-soft flex flex-col h-full gap-2 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-soft-lg focus-within:shadow-soft-lg">
      <div className="flex flex-1 flex-col gap-2">
        {customBody ? (
          customBody
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-soft-secondary">{title}</p>
                <div className="mt-0.5 text-2xl font-bold text-soft-dark">{value}</div>
                {subtitle && <div className="text-xs text-soft-secondary mt-0.5">{subtitle}</div>}
              </div>
              {action}
            </div>
            {deltaLabel && (
              <div className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClasses[tone]}`}>
                {deltaLabel}
              </div>
            )}
          </>
        )}
      </div>
      {!hideSparkline && (
        <div className="flex-1 flex">
          <div className="rounded-lg bg-blue-50/60 p-1 w-full" role="img" aria-label={sparklineLabel}>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
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
        </div>
      )}
      {footer && <div className="text-xs text-soft-secondary" aria-live="polite">{footer}</div>}
    </div>
  );
}
