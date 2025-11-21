import { useEffect, useMemo, useState } from 'react';
import { Holding, holdingsAPI, PortfolioHistoryPoint } from '../api/client';
import { formatCurrency, formatSignedPercentage } from '../utils/format';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
);

interface VisualizationsPanelProps {
  holdings: Holding[];
  userId?: string;
}

const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];

export default function VisualizationsPanel({ holdings, userId }: VisualizationsPanelProps) {
  const [portfolioHistory, setPortfolioHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [accountHistories, setAccountHistories] = useState<Record<string, PortfolioHistoryPoint[]>>({});

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setHistoryLoading(true);
        setHistoryError(null);
        const response = await holdingsAPI.getPortfolioHistory(60, userId);
        setPortfolioHistory(response.data.history || []);
        setAccountHistories((response.data.account_type_history as Record<string, PortfolioHistoryPoint[]>) || {});
      } catch (error) {
        console.error('Failed to load portfolio history', error);
        setHistoryError('Unable to load portfolio history yet.');
      } finally {
        setHistoryLoading(false);
      }
    };

    loadHistory();
  }, [userId]);

  const accountStats = useMemo(() => {
    if (!holdings?.length) return [];

    const map = new Map<string, { account_type: string; contribution: number; value: number; count: number }>();

    holdings.forEach((holding) => {
      const current = map.get(holding.account_type) || {
        account_type: holding.account_type,
        contribution: 0,
        value: 0,
        count: 0,
      };

      current.contribution += holding.contribution;
      current.value += holding.value;
      current.count += 1;

      map.set(holding.account_type, current);
    });

    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [holdings]);

  const barData = useMemo(
    () => ({
      labels: accountStats.map((stat) => stat.account_type),
      datasets: [
        {
          label: 'Contribution',
          data: accountStats.map((stat) => stat.contribution),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderRadius: 12,
        },
        {
          label: 'Current Value',
          data: accountStats.map((stat) => stat.value),
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          borderRadius: 12,
        },
      ],
    }),
    [accountStats],
  );

  const accountSparklines = useMemo(() => accountStats.reduce((acc, stat) => {
    acc[stat.account_type] = accountHistories[stat.account_type] || [];
    return acc;
  }, {} as Record<string, PortfolioHistoryPoint[]>), [accountStats, accountHistories]);

  const lineData = useMemo(
    () => ({
      labels: portfolioHistory.map((point) => point.date),
      datasets: [
        {
          label: 'Portfolio Value',
          data: portfolioHistory.map((point) => point.value),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          tension: 0.35,
          fill: true,
        },
      ],
    }),
    [portfolioHistory],
  );

  if (!holdings.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-600">
        Add holdings to see the account-type breakdown.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {accountStats.length ? (
        <div className="rounded-2xl bg-soft-white p-6 shadow-soft">
          <h3 className="text-lg font-semibold text-soft-dark mb-4">Account Breakdown</h3>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {accountStats.map((stat, index) => {
              const spark = accountSparklines[stat.account_type] || [];
              const growthPercent = stat.contribution > 0 ? ((stat.value - stat.contribution) / stat.contribution) * 100 : null;
              const growthPositive = (growthPercent ?? 0) >= 0;
              const growthColor = growthPositive ? 'bg-soft-success/10 text-soft-success' : 'bg-soft-danger/10 text-soft-danger';

              return (
                <div key={stat.account_type} className="rounded-2xl border border-soft-light bg-white/80 p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-soft-secondary">{stat.account_type}</p>
                      <p className="text-xl font-bold text-soft-dark">{formatCurrency(stat.value)}</p>
                    </div>
                    <div className={`inline-flex items-center rounded-full px-3 py-0.5 text-[11px] font-semibold ${growthColor}`}>
                      {growthPercent !== null ? formatSignedPercentage(growthPercent) : '—'}
                    </div>
                  </div>
                  {spark.length ? (
                    <div className="mt-3 h-16">
                      <Line
                        data={{
                          labels: spark.map((p) => p.date),
                          datasets: [
                            {
                              data: spark.map((p) => p.value),
                              borderColor: colors[index % colors.length],
                              backgroundColor: 'transparent',
                              borderWidth: 2,
                              pointRadius: 0,
                              tension: 0.4,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false }, tooltip: { enabled: false } },
                          scales: { x: { display: false }, y: { display: false } },
                        }}
                      />
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-soft-secondary">Capture history to see trend.</p>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-soft-secondary">
                    <div className="rounded-xl bg-soft-light px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide">Contribution</p>
                      <p className="text-sm font-semibold text-soft-dark">{formatCurrency(stat.contribution)}</p>
                    </div>
                    <div className="rounded-xl bg-soft-light px-3 py-2 text-right">
                      <p className="text-[10px] uppercase tracking-wide">Positions</p>
                      <p className="text-sm font-semibold text-soft-dark">{stat.count}</p>
                    </div>
                  </div>
                  <div className="mt-3 text-sm font-semibold text-soft-dark">
                    Growth Value: {stat.contribution > 0 ? formatCurrency(stat.value - stat.contribution) : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio by Account Type</h3>
          {accountStats.length ? (
            <div className="h-64">
              <Bar
                data={barData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { mode: 'index', intersect: false },
                  },
                  layout: { padding: { top: 8, bottom: 8 } },
                  scales: {
                    x: { stacked: false },
                    y: {
                      stacked: false,
                      ticks: {
                        callback: (value) => formatCurrency(Number(value)),
                      },
                    },
                  },
                  animation: false,
                }}
              />
            </div>
          ) : (
            <p className="text-sm text-gray-500">No account data available.</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Portfolio Value (Last 60 Days)</h3>
            {portfolioHistory.length ? (
              <p className="text-xs text-gray-500">
                Latest: {formatCurrency(portfolioHistory[portfolioHistory.length - 1].value)}
              </p>
            ) : null}
          </div>
          <div className="h-64">
            {historyLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600"></div>
              </div>
            ) : historyError ? (
              <p className="text-sm text-red-600">{historyError}</p>
            ) : portfolioHistory.length ? (
              <Line
                data={lineData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: {
                      ticks: { maxTicksLimit: 6 },
                      grid: { display: false },
                    },
                    y: {
                      ticks: {
                        callback: (value) => formatCurrency(Number(value)),
                      },
                    },
                  },
                }}
              />
            ) : (
              <p className="text-sm text-gray-500">Capture price history to build this chart.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
