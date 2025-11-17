import React, { useState } from 'react';
import { Holding } from '../api/client';
import { TrendingUp, TrendingDown, Edit2, Trash2, RefreshCw } from 'lucide-react';

interface HoldingsTableProps {
  holdings: Holding[];
  onRefresh: () => void;
}

export default function HoldingsTable({ holdings, onRefresh }: HoldingsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [accountFilter, setAccountFilter] = useState('All');

  const filteredHoldings = holdings.filter(h => {
    const matchesSearch = h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         h.ticker.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAccount = accountFilter === 'All' || h.account_type === accountFilter;
    return matchesSearch && matchesAccount;
  });

  const accountTypes = ['All', ...Array.from(new Set(holdings.map(h => h.account_type)))];

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Holdings</h2>
        <button
          onClick={onRefresh}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Search holdings..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
        />
        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          className="px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
        >
          {accountTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-slate-200">
              <th className="text-left py-4 px-4 font-semibold text-slate-700">Ticker</th>
              <th className="text-left py-4 px-4 font-semibold text-slate-700">Name</th>
              <th className="text-left py-4 px-4 font-semibold text-slate-700">Account</th>
              <th className="text-right py-4 px-4 font-semibold text-slate-700">Shares</th>
              <th className="text-right py-4 px-4 font-semibold text-slate-700">Price</th>
              <th className="text-right py-4 px-4 font-semibold text-slate-700">Value</th>
              <th className="text-right py-4 px-4 font-semibold text-slate-700">Gain/Loss</th>
              <th className="text-right py-4 px-4 font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredHoldings.map((holding) => {
              const gainLoss = holding.value - holding.contribution;
              const gainLossPercent = (gainLoss / holding.contribution) * 100;
              const isPositive = gainLoss >= 0;

              return (
                <tr
                  key={holding.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="py-4 px-4">
                    <span className="font-mono font-semibold text-blue-600 uppercase">
                      {holding.ticker}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-slate-900">{holding.name}</td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                      {holding.account_type}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right text-slate-700">
                    {holding.shares.toFixed(4)}
                  </td>
                  <td className="py-4 px-4 text-right font-semibold text-slate-900">
                    ${holding.current_price.toFixed(2)}
                  </td>
                  <td className="py-4 px-4 text-right font-semibold text-slate-900">
                    ${holding.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className={`flex items-center justify-end space-x-1 font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span>${Math.abs(gainLoss).toFixed(2)}</span>
                      <span className="text-sm">({gainLossPercent.toFixed(2)}%)</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-end space-x-2">
                      <button className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-blue-600">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600">
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
        <div className="text-center py-12 text-slate-500">
          No holdings found
        </div>
      )}
    </div>
  );
}
