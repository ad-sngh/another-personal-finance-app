import { useMemo, useState } from 'react';
import { Holding } from '../api/client';
import { TrendingUp, TrendingDown, Edit2, Trash2, ArrowUpDown } from 'lucide-react';
import { formatCurrency, formatNumber } from '../utils/format';

interface HoldingsTableProps {
  holdings: Holding[];
  onEdit: (holding: Holding) => void;
  onDelete: (holding: Holding) => void;
  busyHoldingId?: number | null;
  accountFilter: string;
  accountFilterOptions: string[];
  onAccountFilterChange: (value: string) => void;
  categoryFilter: string;
  categoryFilterOptions: string[];
  onCategoryFilterChange: (value: string) => void;
}

export default function HoldingsTable({
  holdings,
  onEdit,
  onDelete,
  busyHoldingId,
  accountFilter,
  accountFilterOptions,
  onAccountFilterChange,
  categoryFilter,
  categoryFilterOptions,
  onCategoryFilterChange,
}: HoldingsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'account_type', direction: 'asc' });

  type SortKey = 'account_type' | 'name' | 'shares' | 'contribution' | 'current_price' | 'value' | 'gain' | 'allocation';

  const headerConfigs: { label: string; key: SortKey; align: 'left' | 'right' }[] = [
    { label: 'Account', key: 'account_type', align: 'left' },
    { label: 'Holding', key: 'name', align: 'left' },
    { label: 'Shares', key: 'shares', align: 'right' },
    { label: 'Contribution', key: 'contribution', align: 'right' },
    { label: 'Price', key: 'current_price', align: 'right' },
    { label: 'Value', key: 'value', align: 'right' },
    { label: 'Weight', key: 'allocation', align: 'right' },
    { label: 'Gain/Loss', key: 'gain', align: 'right' },
  ];

  const ACCOUNT_ACCENT_CLASSES: Record<string, string> = {
    rrsp: 'border-l-4 border-l-amber-400/80',
    tfsa: 'border-l-4 border-l-blue-400/80',
    cash: 'border-l-4 border-l-emerald-400/80',
    crypto: 'border-l-4 border-l-purple-400/80',
    'non-registered': 'border-l-4 border-l-slate-300',
    default: 'border-l-4 border-l-soft-light/60',
  };

  const filteredHoldings = holdings.filter(h => {
    const matchesSearch = h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (h.ticker || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAccount = accountFilter === 'All' || h.account_type === accountFilter;
    const matchesCategory = categoryFilter === 'All' || h.category === categoryFilter;
    return matchesSearch && matchesAccount && matchesCategory;
  });

  const totalFilteredValue = filteredHoldings.reduce((sum, holding) => sum + holding.value, 0);

  const sortedHoldings = useMemo(() => {
    const copy = [...filteredHoldings];
    copy.sort((a, b) => {
      const gainA = a.value - a.contribution;
      const gainB = b.value - b.contribution;
      const allocationA = totalFilteredValue > 0 ? (a.value / totalFilteredValue) * 100 : 0;
      const allocationB = totalFilteredValue > 0 ? (b.value / totalFilteredValue) * 100 : 0;
      const valueMap: Record<SortKey, number | string> = {
        account_type: a.account_type,
        name: a.name,
        shares: a.shares,
        contribution: a.contribution,
        current_price: a.current_price,
        value: a.value,
        gain: gainA,
        allocation: allocationA,
      };
      const otherMap: Record<SortKey, number | string> = {
        account_type: b.account_type,
        name: b.name,
        shares: b.shares,
        contribution: b.contribution,
        current_price: b.current_price,
        value: b.value,
        gain: gainB,
        allocation: allocationB,
      };
      const left = valueMap[sortConfig.key];
      const right = otherMap[sortConfig.key];
      let compare = 0;
      if (typeof left === 'string' && typeof right === 'string') {
        compare = left.localeCompare(right);
      } else {
        compare = Number(left) - Number(right);
      }
      return sortConfig.direction === 'asc' ? compare : -compare;
    });
    return copy;
  }, [filteredHoldings, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  return (
    <div className="rounded-2xl bg-white p-5 shadow-soft">
      {/* Header */}
      <div className="mb-5 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-soft-secondary font-semibold">Holdings</p>
            <h2 className="text-xl md:text-2xl font-semibold text-soft-dark">Portfolio Positions</h2>
          </div>
          <div className="text-[11px] uppercase tracking-wide text-soft-secondary">
            {filteredHoldings.length} / {holdings.length} holdings · {formatCurrency(totalFilteredValue)} value
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            type="text"
            placeholder="Search by name or ticker..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-soft-light px-4 py-2 text-sm text-soft-dark placeholder:text-soft-secondary focus:border-soft-primary focus:outline-none focus:ring-2 focus:ring-soft-primary/20"
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-soft-secondary">Account</span>
            {accountFilterOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onAccountFilterChange(option)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  accountFilter === option
                    ? 'bg-soft-dark text-white shadow-soft'
                    : 'bg-soft-light text-soft-secondary hover:text-soft-dark'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-soft-secondary">Category</span>
            {categoryFilterOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onCategoryFilterChange(option)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  categoryFilter === option
                    ? 'bg-soft-primary text-white shadow-soft'
                    : 'bg-soft-light text-soft-secondary hover:text-soft-dark'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-soft-light/70 text-[11px] uppercase tracking-wide text-soft-secondary">
              {headerConfigs.map(({ label, key, align }) => (
                <th key={key} className={`py-1.5 px-2 font-semibold text-${align}`}>
                  <button
                    type="button"
                    onClick={() => handleSort(key)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-soft-secondary hover:text-soft-dark"
                  >
                    {label}
                    <span className="inline-flex items-center">
                      {sortConfig.key === key ? (
                        sortConfig.direction === 'asc' ? '↑' : '↓'
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-soft-secondary/60" />
                      )}
                    </span>
                  </button>
                </th>
              ))}
              <th className="text-right py-1.5 px-2 font-semibold text-[11px] uppercase text-soft-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedHoldings.map((holding, index) => {
              const gainLoss = holding.value - holding.contribution;
              const gainLossPercent = holding.contribution !== 0 ? (gainLoss / holding.contribution) * 100 : 0;
              const isPositive = gainLoss >= 0;
              const allocation = totalFilteredValue > 0 ? (holding.value / totalFilteredValue) * 100 : 0;
              const stripe = index % 2 === 0 ? 'bg-white' : 'bg-soft-light/40';
              const accentClass = ACCOUNT_ACCENT_CLASSES[holding.account_type?.toLowerCase?.() ?? ''] ?? ACCOUNT_ACCENT_CLASSES.default;

              return (
                <tr
                  key={holding.id}
                  className={`border-b border-soft-light/60 text-[13px] transition-colors ${stripe} hover:bg-soft-primary/5 ${accentClass}`}
                >
                  <td className="py-1.5 px-2 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full bg-soft-light text-[11px] font-semibold text-soft-secondary">
                      {holding.account_type}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-soft-dark max-w-[220px]" title={holding.name}>
                    <div className="font-semibold truncate text-sm">{holding.name}</div>
                    <div className="text-[11px] text-soft-secondary space-y-0.5">
                      <p className="truncate">{holding.account}</p>
                      <p className="flex items-center space-x-2">
                        <span>{holding.ticker || '—'}</span>
                        <span className="text-gray-400">•</span>
                        <span className="truncate">{holding.category}</span>
                      </p>
                    </div>
                  </td>
                  <td className="py-1.5 px-2 text-right text-soft-secondary whitespace-nowrap">
                    {formatNumber(holding.shares)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-semibold text-soft-dark whitespace-nowrap">
                    {formatCurrency(holding.contribution)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-semibold text-soft-dark whitespace-nowrap" title={`Source: ${holding.price_source || 'portfolio'}`}>
                    {formatCurrency(holding.current_price)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-semibold text-soft-dark whitespace-nowrap">
                    {formatCurrency(holding.value)}
                  </td>
                  <td className="py-1.5 px-2 text-right text-soft-secondary font-semibold whitespace-nowrap">
                    {totalFilteredValue > 0 ? `${allocation.toFixed(1)}%` : '—'}
                  </td>
                  <td className="py-1.5 px-2 text-right">
                    <div className={`inline-flex items-center justify-end gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isPositive ? 'bg-soft-success/10 text-soft-success' : 'bg-soft-danger/10 text-soft-danger'
                    }`}>
                      {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span>{formatCurrency(Math.abs(gainLoss))}</span>
                      <span className="text-xs">({formatNumber(gainLossPercent)}%)</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEdit(holding)}
                        className="rounded-xl p-1.5 text-soft-primary hover:bg-soft-primary/10 transition"
                        aria-label={`Edit ${holding.name}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(holding)}
                        className="rounded-xl p-1.5 text-soft-danger hover:bg-soft-danger/10 transition disabled:opacity-40"
                        aria-label={`Delete ${holding.name}`}
                        disabled={busyHoldingId === holding.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredHoldings.length === 0 && (
        <div className="text-center py-10 text-sm text-soft-secondary">
          No holdings match your filters.
        </div>
      )}
    </div>
  );
}
