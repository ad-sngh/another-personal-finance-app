import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { MarketIndexSummary, PortfolioMovementSnapshot } from '../api/client';
import { formatCurrency, formatSignedPercentage } from '../utils/format';

interface MarketOverviewProps {
  indexes: MarketIndexSummary[];
  movement: PortfolioMovementSnapshot | null;
  loading: boolean;
  error: string | null;
  showMovement?: boolean;
}

const formatDate = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function MarketOverview({ indexes, movement, loading, error, showMovement = true }: MarketOverviewProps) {
  const trendPositive = (movement?.change ?? 0) >= 0;

  const renderLoader = (
    <div className="flex h-32 items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-soft-primary"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {showMovement && (
        <div className="card">
          <div>
            <p className="text-xs uppercase tracking-wide text-soft-secondary">Snapshot</p>
            <h3 className="text-lg font-semibold text-soft-dark">Portfolio Movement</h3>
            <p className="text-sm text-soft-secondary">Since {formatDate(movement?.since) || 'last snapshot'}</p>
          </div>

          {loading ? (
            renderLoader
          ) : movement ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-gray-100 bg-white/70 p-4">
              <div className="text-sm uppercase tracking-wide text-soft-secondary">Current Value</div>
              <div className="text-3xl font-semibold text-soft-dark">{formatCurrency(movement.current_value)}</div>
              <div className="flex items-center justify-between text-sm">
                <div
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${
                    trendPositive ? 'bg-soft-success/10 text-soft-success' : 'bg-soft-danger/10 text-soft-danger'
                  }`}
                >
                  {trendPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {movement.change !== null ? formatCurrency(Math.abs(movement.change)) : '—'}
                  {movement.change_percent !== null && (
                    <span className="ml-1 text-xs">{formatSignedPercentage(movement.change_percent)}</span>
                  )}
                </div>
                <p className="text-soft-secondary">
                  Prev: <span className="font-semibold text-soft-dark">{formatCurrency(movement.previous_value)}</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-soft-secondary mt-4">No portfolio history available yet.</p>
          )}
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-soft-dark">Market Pulse</h3>
        </div>
        {loading ? (
          renderLoader
        ) : error ? (
          <p className="text-sm text-soft-danger mt-4">{error}</p>
        ) : indexes.length ? (
          <div className="mt-4 divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
            {indexes.map((index) => {
              const changePositive = (index.change ?? 0) >= 0;
              return (
                <a
                  key={index.id}
                  href={`https://finance.yahoo.com/quote/${encodeURIComponent(index.symbol)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-4 bg-white/70 px-4 py-3 hover:bg-soft-light/70 transition"
                >
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-soft-secondary">{index.symbol}</p>
                    <p className="text-base font-semibold text-soft-dark truncate">{index.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold text-soft-dark">
                      {index.price !== null ? formatCurrency(index.price) : '—'}
                    </p>
                    <p
                      className={`text-sm font-semibold ${
                        changePositive ? 'text-soft-success' : 'text-soft-danger'
                      }`}
                    >
                      {index.change !== null ? `${changePositive ? '+' : '-'}${formatCurrency(Math.abs(index.change))}` : '—'}
                      {index.change_percent !== null && (
                        <span className="ml-2 text-xs">{formatSignedPercentage(index.change_percent)}</span>
                      )}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-soft-secondary mt-4">Market data is unavailable right now.</p>
        )}
      </div>
    </div>
  );
}
