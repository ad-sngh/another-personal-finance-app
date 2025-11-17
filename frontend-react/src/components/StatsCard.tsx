import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: number;
  color: 'blue' | 'indigo' | 'green' | 'red';
}

const colorClasses = {
  blue: 'from-blue-500 to-blue-600',
  indigo: 'from-indigo-500 to-indigo-600',
  green: 'from-green-500 to-green-600',
  red: 'from-red-500 to-red-600',
};

export default function StatsCard({ title, value, icon, trend, color }: StatsCardProps) {
  return (
    <div className="card group hover:scale-105 transition-transform duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className={`bg-gradient-to-br ${colorClasses[color]} p-3 rounded-xl text-white shadow-lg`}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center space-x-1 text-sm font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            <span>{Math.abs(trend).toFixed(2)}%</span>
          </div>
        )}
      </div>
      <h3 className="text-sm font-medium text-slate-600 mb-1">{title}</h3>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
