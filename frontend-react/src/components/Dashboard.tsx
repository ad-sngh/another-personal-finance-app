import { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, PieChart, Activity } from 'lucide-react';
import { holdingsAPI, Holding } from '../api/client';
import HoldingsTable from './HoldingsTable';
import StatsCard from './StatsCard';

export default function Dashboard() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalValue: 0,
    totalContribution: 0,
    totalGain: 0,
    gainPercentage: 0,
  });

  useEffect(() => {
    loadHoldings();
  }, []);

  const loadHoldings = async () => {
    try {
      const response = await holdingsAPI.getAll();
      const holdingsData = response.data.holdings;
      setHoldings(holdingsData);
      
      // Calculate stats
      const totalValue = holdingsData.reduce((sum, h) => sum + h.value, 0);
      const totalContribution = holdingsData.reduce((sum, h) => sum + h.contribution, 0);
      const totalGain = totalValue - totalContribution;
      const gainPercentage = totalContribution > 0 ? (totalGain / totalContribution) * 100 : 0;
      
      setStats({ totalValue, totalContribution, totalGain, gainPercentage });
    } catch (error) {
      console.error('Error loading holdings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-xl">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Portfolio Tracker
              </h1>
            </div>
            <button className="btn-primary">
              Add Holding
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Value"
            value={`$${stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<DollarSign className="w-6 h-6" />}
            trend={stats.gainPercentage}
            color="blue"
          />
          <StatsCard
            title="Total Contribution"
            value={`$${stats.totalContribution.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<PieChart className="w-6 h-6" />}
            color="indigo"
          />
          <StatsCard
            title="Total Gain/Loss"
            value={`$${stats.totalGain.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<TrendingUp className="w-6 h-6" />}
            trend={stats.gainPercentage}
            color={stats.totalGain >= 0 ? 'green' : 'red'}
          />
          <StatsCard
            title="Return"
            value={`${stats.gainPercentage.toFixed(2)}%`}
            icon={<Activity className="w-6 h-6" />}
            trend={stats.gainPercentage}
            color={stats.gainPercentage >= 0 ? 'green' : 'red'}
          />
        </div>

        {/* Holdings Table */}
        <HoldingsTable holdings={holdings} onRefresh={loadHoldings} />
      </main>
    </div>
  );
}
