import { useMemo, useState } from 'react';
import { Holding } from '../api/client';
import { TrendingUp, TrendingDown, Edit2, Trash2, RefreshCw, ArrowUpDown } from 'lucide-react';
import { formatCurrency, formatNumber } from '../utils/format';

interface HoldingsTableProps {
  holdings: Holding[];
  onRefresh: () => void;
  onEdit: (holding: Holding) => void;
  onDelete: (holding: Holding) => void;
  busyHoldingId?: number | null;
  accountFilter: string;
  setAccountFilter: (value: string) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
}

export default function HoldingsTable({ holdings, onRefresh, onEdit, onDelete, busyHoldingId, accountFilter, setAccountFilter, categoryFilter, setCategoryFilter }: HoldingsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'account_type', direction: 'asc' });

  type SortKey = 'account_type' | 'name' | 'shares' | 'contribution' | 'current_price' | 'value' | 'gain';

const headerConfigs: { label: string; key: SortKey; align: 'left' | 'right' }[] = [
  { label: 'Account Type', key: 'account_type', align: 'left' },
  { label: 'Holding', key: 'name', align: 'left' },
  { label: 'Shares', key: 'shares', align: 'right' },
  { label: 'Contribution', key: 'contribution', align: 'right' },
  { label: 'Current Price', key: 'current_price', align: 'right' },
  { label: 'Current Value', key: 'value', align: 'right' },
  { label: 'Gain/Loss', key: 'gain', align: 'right' },
];

  const filteredHoldings = holdings.filter(h => {
    const matchesSearch = h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (h.ticker || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAccount = accountFilter === 'All' || h.account_type === accountFilter;
    const matchesCategory = categoryFilter === 'All' || h.category === categoryFilter;
    return matchesSearch && matchesAccount && matchesCategory;
  });

  const sortedHoldings = useMemo(() => {
    const copy = [...filteredHoldings];
    copy.sort((a, b) => {
      const gainA = a.value - a.contribution;
      const gainB = b.value - b.contribution;
      const valueMap: Record<SortKey, number | string> = {
        account_type: a.account_type,
        name: a.name,
        shares: a.shares,
        contribution: a.contribution,
        current_price: a.current_price,
        value: a.value,
        gain: gainA,
      };
      const otherMap: Record<SortKey, number | string> = {
        account_type: b.account_type,
        name: b.name,
        shares: b.shares,
        contribution: b.contribution,
        current_price: b.current_price,
        value: b.value,
        gain: gainB,
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

  const accountTypes = useMemo(() => ['All', ...Array.from(new Set(holdings.map(h => h.account_type)))], [holdings]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(holdings.map(h => h.category)))], [holdings]);

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-semibold text-gray-900">Holdings</h2>
        <button
          onClick={onRefresh}
          className="flex items-center space-x-2 px-4 py-2 text-sm font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5">
        <input
          type="text"
          placeholder="Search holdings..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
        />
        <div className="flex flex-wrap gap-1.5">
          {accountTypes.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setAccountFilter(type)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                accountFilter === type
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category}
              type="button"
              onClick={() => setCategoryFilter(category)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                categoryFilter === category
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-purple-400'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              {headerConfigs.map(({ label, key, align }) => (
                <th key={key} className={`py-2 px-2 font-semibold text-gray-700 text-${align}`}>
                  <button
                    type="button"
                    onClick={() => handleSort(key)}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-blue-600"
                  >
                    {label}
                    <ArrowUpDown className={`h-3.5 w-3.5 ${sortConfig.key === key ? 'text-blue-600' : 'text-gray-400'}`} />
                  </button>
                </th>
              ))}
              <th className="text-right py-2 px-2 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedHoldings.map((holding) => {
              const gainLoss = holding.value - holding.contribution;
              const gainLossPercent = holding.contribution !== 0 ? (gainLoss / holding.contribution) * 100 : 0;
              const isPositive = gainLoss >= 0;

              return (
                <tr
                  key={holding.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors text-sm"
                >
                  <td className="py-2 px-2 whitespace-nowrap">
                    <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium whitespace-nowrap">
                      {holding.account_type}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-gray-900 max-w-[200px]" title={holding.name}>
                    <div className="font-semibold text-gray-900 truncate">{holding.name}</div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      <p className="truncate">{holding.account}</p>
                      <p className="flex items-center space-x-2">
                        <span>{holding.ticker || '—'}</span>
                        <span className="text-gray-400">•</span>
                        <span className="truncate">{holding.category}</span>
                      </p>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right text-gray-700 whitespace-nowrap">
                    {formatNumber(holding.shares)}
                  </td>
                  <td className="py-2 px-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                    {formatCurrency(holding.contribution)}
                  </td>
                  <td className="py-2 px-2 text-right font-semibold text-gray-900 whitespace-nowrap" title={`Source: ${holding.price_source || 'portfolio'}`}>
                    {formatCurrency(holding.current_price)}
                  </td>
                  <td className="py-2 px-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                    {formatCurrency(holding.value)}
                  </td>
                  <td className="py-2 px-2 text-right">
                    <div className={`flex items-center justify-end space-x-1 font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span>{formatCurrency(Math.abs(gainLoss))}</span>
                      <span className="text-xs">({formatNumber(gainLossPercent)}%)</span>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => onEdit(holding)}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-blue-600"
                        aria-label={`Edit ${holding.name}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(holding)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600 disabled:opacity-50"
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
        <div className="text-center py-10 text-sm text-gray-500">
          No holdings match your filters.
        </div>
      )}
    </div>
  );
}
