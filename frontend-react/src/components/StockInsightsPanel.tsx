import { ArrowDownRight, ArrowUpRight, Minus, RefreshCcw } from 'lucide-react';
import { Insight } from '../api/client';

interface StockInsightsPanelProps {
  insights: Insight[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

function getDirection(move?: string | null): 'up' | 'down' | 'flat' {
  if (!move) return 'flat';
  const moveStr = move.toString().trim();
  
  // Remove percentage sign if present and parse as float
  const numericValue = parseFloat(moveStr.replace('%', ''));
  
  if (isNaN(numericValue)) return 'flat';
  
  if (numericValue > 0) return 'up';
  if (numericValue < 0) return 'down';
  return 'flat';
}

function formatMove(move?: string | null): string {
  if (!move) return '0%';
  const moveStr = move.toString().trim();
  
  // Remove percentage sign if present and parse as float
  const numericValue = parseFloat(moveStr.replace('%', ''));
  
  if (isNaN(numericValue)) return moveStr;
  
  // Add + sign for positive values and ensure % sign
  if (numericValue > 0) return `+${numericValue}%`;
  if (numericValue < 0) return `${numericValue}%`;
  return '0%';
}

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

export default function StockInsightsPanel({ insights, loading = false, error = null, onRefresh }: StockInsightsPanelProps) {
  const directionMap = {
    up: { icon: ArrowUpRight, classes: 'text-soft-success bg-soft-success/10' },
    down: { icon: ArrowDownRight, classes: 'text-soft-danger bg-soft-danger/10' },
    flat: { icon: Minus, classes: 'text-soft-secondary bg-soft-light' },
  } as const;
  return (
    <section className="rounded-2xl bg-soft-white p-4 shadow-soft flex flex-col" style={{ height: '1300px' }}>
      <div className="mb-4 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-soft-secondary font-semibold">Stock Insights</p>
          <p className="text-[11px] text-soft-secondary">Signals pulled from tracked tickers</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1 rounded-full border border-soft-primary px-3 py-1.5 text-[10px] font-semibold text-soft-primary hover:bg-soft-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-soft-primary"></div>
          </div>
        ) : error ? (
          <div className="text-center h-full flex items-center justify-center">
            <p className="text-[11px] text-soft-danger">{error}</p>
          </div>
        ) : insights.length === 0 ? (
          <div className="text-center h-full flex items-center justify-center">
            <p className="text-[11px] text-soft-secondary">No insights available yet.</p>
            <p className="text-[10px] text-soft-secondary mt-1">Enable insight tracking on your holdings to see signals here.</p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto pr-2">
            <ol className="relative pl-4 space-y-5 before:absolute before:left-[7px] before:top-1 before:h-[calc(100%-12px)] before:w-0.5 before:bg-soft-light/80">
              {insights.map((insight) => {
                const direction = getDirection(insight.move);
                const meta = directionMap[direction];
                const Icon = meta.icon;
                return (
                  <li key={`${insight.ticker}-${insight.captured_at}`} className="relative">
                    <span className="absolute -left-[15px] flex h-6 w-6 items-center justify-center rounded-full border border-white bg-soft-white shadow-soft">
                      <Icon className={`h-3.5 w-3.5 ${meta.classes}`} />
                    </span>
                    <div className="rounded-2xl border border-soft-light/70 bg-white/80 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wide text-soft-dark">{insight.ticker}</span>
                          <span className="text-[10px] font-semibold text-soft-secondary">{formatMove(insight.move)}</span>
                        </div>
                        <span className="text-[10px] text-soft-secondary">
                          {formatRelativeTime(insight.captured_at)}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-soft-dark leading-relaxed">{insight.summary}</p>
                      {insight.sentiment && (
                        <p className="mt-1 text-[10px] text-soft-secondary">Confidence: {insight.sentiment}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
