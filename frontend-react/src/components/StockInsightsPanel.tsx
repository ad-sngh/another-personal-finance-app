import { ArrowDownRight, ArrowUpRight, Minus, RefreshCcw } from 'lucide-react';
import { mockInsights } from '../data/mockInsights';

const directionMap = {
  up: { icon: ArrowUpRight, classes: 'text-soft-success bg-soft-success/10' },
  down: { icon: ArrowDownRight, classes: 'text-soft-danger bg-soft-danger/10' },
  flat: { icon: Minus, classes: 'text-soft-secondary bg-soft-light' },
} as const;

function formatRelativeTime(isoString: string) {
  const target = new Date(isoString).getTime();
  if (Number.isNaN(target)) return 'moments ago';
  const diffMs = Date.now() - target;
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

export default function StockInsightsPanel() {
  return (
    <section className="rounded-2xl bg-soft-white p-4 shadow-soft flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-soft-secondary font-semibold">Stock Insights</p>
          <p className="text-sm text-soft-secondary">Signals pulled from Alex's tracked tickers</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-soft-primary px-3 py-1 text-[11px] font-semibold text-soft-primary hover:bg-soft-primary/10"
          disabled
        >
          <RefreshCcw className="h-3 w-3" /> Refresh
        </button>
      </div>

      <ol className="relative pl-4 space-y-6 before:absolute before:left-[7px] before:top-1 before:h-[calc(100%-12px)] before:w-0.5 before:bg-soft-light/80">
        {mockInsights.map((insight) => {
          const meta = directionMap[insight.direction];
          const Icon = meta.icon;
          return (
            <li key={`${insight.ticker}-${insight.timestamp}`} className="relative">
              <span className="absolute -left-[15px] flex h-6 w-6 items-center justify-center rounded-full border border-white bg-soft-white shadow-soft">
                <Icon className={`h-4 w-4 ${meta.classes}`} />
              </span>
              <div className="rounded-2xl border border-soft-light/70 bg-white/80 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wide text-soft-dark">{insight.ticker}</span>
                    <span className="text-[11px] font-semibold text-soft-secondary">{insight.move}</span>
                  </div>
                  <span className="text-[11px] text-soft-secondary">
                    {formatRelativeTime(insight.timestamp)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-soft-dark leading-relaxed">{insight.summary}</p>
                {insight.source && (
                  <p className="mt-1 text-[11px] text-soft-secondary">Source: {insight.source}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
