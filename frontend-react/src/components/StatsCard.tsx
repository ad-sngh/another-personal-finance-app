import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { formatNumber } from '../utils/format';

interface StatsCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: number;
  color: 'blue' | 'indigo' | 'green' | 'red';
}

const colorClasses = {
  blue: 'bg-blue-100 text-blue-600',
  indigo: 'bg-indigo-100 text-indigo-600',
  green: 'bg-green-100 text-green-600',
  red: 'bg-red-100 text-red-600',
};

export default function StatsCard({ title, value, icon, trend, color }: StatsCardProps) {
  return (
    <div className="card group hover:scale-105 transition-transform duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className={`${colorClasses[color]} p-3 rounded-xl shadow-lg`}
             aria-hidden="true">
          <span className="inline-flex items-center justify-center w-6 h-6">
            {icon}
          </span>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center space-x-1 text-sm font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            <span>{formatNumber(Math.abs(trend))}%</span>
          </div>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-600 mb-1 truncate">{title}</h3>
      <p className="text-2xl md:text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
