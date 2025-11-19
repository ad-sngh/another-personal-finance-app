import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { TrendingUp, X, AlertTriangle, Menu, LayoutDashboard, BarChart3 } from 'lucide-react';
import { holdingsAPI, Holding, HoldingPayload, MarketIndexSummary, PortfolioMovementSnapshot } from '../api/client';
import HoldingsTable from './HoldingsTable';
import StatsCard from './StatsCard';
import VisualizationsPanel from './VisualizationsPanel';
import { formatCurrency, formatPercentage, formatSignedPercentage } from '../utils/format';

const ACCOUNT_TYPE_PRESETS = ['Taxable', 'TFSA', 'RRSP', 'RESP', 'Cash', 'Brokerage'];
const CATEGORY_PRESETS = ['Stocks', 'ETF', 'Cash', 'Crypto', 'Bond', 'Mutual Fund'];
const ALLOCATION_COLORS = ['bg-amber-400', 'bg-blue-500', 'bg-indigo-400', 'bg-emerald-400', 'bg-slate-400'];

export default function Dashboard() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalValue: 0,
    totalContribution: 0,
    totalGain: 0,
    gainPercentage: 0,
  });
  const [accountFilter, setAccountFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'delete'>('add');
  const [modalOpen, setModalOpen] = useState(false);
  const [activeHolding, setActiveHolding] = useState<Holding | null>(null);
  const [formData, setFormData] = useState<HoldingPayload>({
    account_type: '',
    account: '',
    ticker: '',
    name: '',
    category: '',
    lookup: '',
    shares: 0,
    cost: 0,
    current_price: 0,
    track_price: true,
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyHoldingId, setBusyHoldingId] = useState<number | null>(null);
  const [isSyncingPrices, setIsSyncingPrices] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'visuals'>('overview');
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [convertToCad, setConvertToCad] = useState(false);
  const [cadConversionRate, setCadConversionRate] = useState<number | null>(null);
  const isValueOverrideActive = Boolean(formData.manual_price_override || formData.value_override !== undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [marketIndexes, setMarketIndexes] = useState<MarketIndexSummary[]>([]);
  const [portfolioMovement, setPortfolioMovement] = useState<PortfolioMovementSnapshot | null>(null);
  const [movementRange, setMovementRange] = useState<'7d' | '1m' | '3m' | 'ytd' | 'all'>('1m');
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);
  const accountFilterOptions = useMemo(() => ['All', ...Array.from(new Set(holdings.map(h => h.account_type).filter(Boolean)))], [holdings]);
  const categoryFilterOptions = useMemo(() => ['All', ...Array.from(new Set(holdings.map(h => h.category).filter(Boolean)))], [holdings]);
  const filteredHoldings = useMemo(() => {
    return holdings.filter((holding) => {
      const accountMatch = accountFilter === 'All' || holding.account_type === accountFilter;
      const categoryMatch = categoryFilter === 'All' || holding.category === categoryFilter;
      return accountMatch && categoryMatch;
    });
  }, [holdings, accountFilter, categoryFilter]);

  const portfolioSparkline = useMemo(() => {
    if (!filteredHoldings.length) {
      return [0, 1, 0.5, 1.2, 0.8, 1.4, 1];
    }
    const sorted = [...filteredHoldings].sort((a, b) => a.value - b.value);
    const chunkSize = Math.max(1, Math.floor(sorted.length / 7));
    const samples: number[] = [];
    for (let i = 0; i < sorted.length; i += chunkSize) {
      const slice = sorted.slice(i, i + chunkSize);
      const avg = slice.reduce((sum, item) => sum + item.value, 0) / slice.length;
      samples.push(avg || 0);
      if (samples.length === 7) break;
    }
    while (samples.length < 7) {
      samples.push(samples[samples.length - 1] ?? 0);
    }
    return samples;
  }, [filteredHoldings]);

  const movementSparkline = useMemo(() => {
    const values = portfolioSparkline;
    const width = 200;
    const height = 55;
    const padding = 6;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const points = values.map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * (width - padding * 2) + padding;
      const y = height - ((value - min) / range) * (height - padding * 2) - padding;
      return { x, y };
    });
    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
    return { width, height, linePath, areaPath };
  }, [portfolioSparkline]);

  const topAccountSnapshot = useMemo(() => {
    if (!holdings.length) return null as { label: string; value: number } | null;
    const totals = new Map<string, number>();
    holdings.forEach((holding) => {
      totals.set(holding.account_type, (totals.get(holding.account_type) ?? 0) + holding.value);
    });
    const [label, value] = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0];
    return { label, value };
  }, [holdings]);

  const allocationBreakdown = useMemo(() => {
    if (!filteredHoldings.length) return [] as { label: string; value: number; percent: number; color: string }[];
    const totals = new Map<string, number>();
    filteredHoldings.forEach((holding) => {
      const key = holding.category || 'Other';
      totals.set(key, (totals.get(key) ?? 0) + holding.value);
    });
    const totalValue = Array.from(totals.values()).reduce((sum, value) => sum + value, 0) || 1;
    const ordered = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
    const slices = ordered.slice(0, 4);
    const remainder = ordered.slice(4).reduce((sum, [, value]) => sum + value, 0);
    if (remainder > 0) {
      slices.push(['Other', remainder]);
    }
    return slices.map(([label, value], index) => ({
      label,
      value,
      percent: (value / totalValue) * 100,
      color: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
    }));
  }, [holdings]);

  useEffect(() => {
    loadHoldings();
    loadMarketContext();
  }, []);

  const defaultPayload = useMemo<HoldingPayload>(() => ({
    account_type: '',
    account: '',
    ticker: '',
    name: '',
    category: '',
    lookup: '',
    shares: 0,
    cost: 0,
    current_price: 0,
    contribution: undefined,
    track_price: true,
    manual_price_override: false,
    value_override: undefined,
  }), []);

  useEffect(() => {
    if (formData.value_override !== undefined && (!formData.manual_price_override || formData.track_price)) {
      setFormData(prev => ({
        ...prev,
        manual_price_override: true,
        track_price: false,
      }));
    }
  }, [formData.value_override, formData.manual_price_override, formData.track_price]);

  const accountTypeOptions = useMemo(() => {
    const set = new Set(ACCOUNT_TYPE_PRESETS);
    holdings.forEach((holding) => {
      if (holding.account_type) set.add(holding.account_type);
    });
    if (formData.account_type) set.add(formData.account_type);
    return Array.from(set);
  }, [holdings, formData.account_type]);

  const categoryOptions = useMemo(() => {
    const set = new Set(CATEGORY_PRESETS);
    holdings.forEach((holding) => {
      if (holding.category) set.add(holding.category);
    });
    if (formData.category) set.add(formData.category);
    return Array.from(set);
  }, [holdings, formData.category]);

  const navItems: { id: 'overview' | 'visuals'; label: string; icon: ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'visuals', label: 'Visualizations', icon: BarChart3 },
  ];

  const holdingToPayload = (holding: Holding): HoldingPayload => ({
    account_type: holding.account_type,
    account: holding.account,
    ticker: holding.ticker || '',
    name: holding.name,
    category: holding.category,
    lookup: holding.lookup || holding.ticker || '',
    shares: holding.shares,
    cost: holding.cost,
    current_price: holding.current_price,
    contribution: holding.contribution,
    track_price: holding.track_price ?? true,
    manual_price_override: holding.manual_price_override ?? false,
    value_override: holding.value_override ?? undefined,
  });

  const extractError = (error: unknown) => {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'response' in error) {
      const resp = (error as any).response;
      return resp?.data?.detail || resp?.data?.message || resp?.statusText || 'Request failed';
    }
    if (error instanceof Error) return error.message;
    return 'Request failed';
  };

  const handleSyncPrices = async () => {
    setIsSyncingPrices(true);
    setStatusMessage(null);
    try {
      await holdingsAPI.capturePrices();
      await loadHoldings();
      setStatusMessage({ type: 'success', text: 'Prices updated using the latest market data.' });
    } catch (error) {
      setStatusMessage({ type: 'error', text: extractError(error) });
    } finally {
      setIsSyncingPrices(false);
    }
  };

  const loadHoldings = async () => {
    try {
      setLoadError(null);
      const response = await holdingsAPI.getAll();
      const holdingsData = response.data.holdings;
      setHoldings(holdingsData);
    } catch (error) {
      setLoadError('Unable to fetch holdings. Please confirm the backend API is running on port 8081.');
      console.error('Error loading holdings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMarketContext = async () => {
    setMarketLoading(true);
    setMarketError(null);
    try {
      const [indexesResponse, movementResponse] = await Promise.all([
        holdingsAPI.getMarketSummary(),
        holdingsAPI.getPortfolioMovement(),
      ]);
      setMarketIndexes(indexesResponse.data.indexes);
      setPortfolioMovement(movementResponse.data);
    } catch (error) {
      console.error('Error loading market context:', error);
      setMarketError('Unable to load market data right now.');
    } finally {
      setMarketLoading(false);
    }
  };

  useEffect(() => {
    const totalValue = filteredHoldings.reduce((sum, h) => sum + h.value, 0);
    const totalContribution = filteredHoldings.reduce((sum, h) => sum + h.contribution, 0);
    const totalGain = totalValue - totalContribution;
    const gainPercentage = totalContribution > 0 ? (totalGain / totalContribution) * 100 : 0;

    setStats({ totalValue, totalContribution, totalGain, gainPercentage });
  }, [filteredHoldings]);

  const openAddModal = () => {
    setModalMode('add');
    setActiveHolding(null);
    setFormData({ ...defaultPayload });
    setModalError(null);
    setQuoteMessage(null);
    setConvertToCad(false);
    setCadConversionRate(null);
    setModalOpen(true);
  };

  const openEditModal = (holding: Holding) => {
    setModalMode('edit');
    setActiveHolding(holding);
    setFormData(holdingToPayload(holding));
    setModalError(null);
    setQuoteMessage(null);
    setConvertToCad(false);
    setCadConversionRate(null);
    setModalOpen(true);
  };

  const openDeleteModal = (holding: Holding) => {
    setModalMode('delete');
    setActiveHolding(holding);
    setModalError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setModalOpen(false);
    setModalError(null);
    setActiveHolding(null);
    setFormData({ ...defaultPayload });
    setConvertToCad(false);
    setCadConversionRate(null);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    const numericFields = ['shares', 'cost', 'current_price', 'contribution', 'value_override'];
    setFormData(prev => ({
      ...prev,
      [name]: numericFields.includes(name) ? (value === '' ? 0 : Number(value)) : value,
    }));
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    if (name === 'convert_to_cad') {
      setConvertToCad(checked);
      return;
    }
    setFormData(prev => ({
      ...prev,
      [name]: checked,
    }));
  };

  const ensureCadQuote = async () => {
    if (cadConversionRate !== null) return cadConversionRate;
    try {
      const response = await holdingsAPI.fetchPrice('CAD=X');
      const rate = response.data.price;
      setCadConversionRate(rate || 1);
      return rate || 1;
    } catch (error) {
      setQuoteMessage({ type: 'error', text: 'Unable to fetch CAD conversion. Try again.' });
      throw error;
    }
  };

  const handleFetchQuote = async () => {
    const symbol = (formData.lookup || formData.ticker || '').trim();
    if (!symbol) {
      setQuoteMessage({ type: 'error', text: 'Enter a ticker or lookup symbol before fetching.' });
      return;
    }
    setIsFetchingQuote(true);
    setQuoteMessage(null);
    try {
      const response = await holdingsAPI.fetchPrice(symbol);
      const data = response.data;
      setFormData(prev => ({
        ...prev,
        ticker: prev.ticker || data.ticker || symbol.toUpperCase(),
        lookup: prev.lookup || data.ticker || symbol.toUpperCase(),
        current_price: data.price ?? prev.current_price,
        name: prev.name || data.name || prev.name,
      }));
      setQuoteMessage({ type: 'success', text: `Fetched ${data.ticker || symbol} @ ${formatCurrency(data.price || 0)}` });
    } catch (error) {
      setQuoteMessage({ type: 'error', text: extractError(error) });
    } finally {
      setIsFetchingQuote(false);
    }
  };

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setModalError(null);
    try {
      let payload = { ...formData };
      if (convertToCad && formData.current_price) {
        const rate = await ensureCadQuote();
        const convertValue = (value?: number | null) =>
          typeof value === 'number' ? Number((value * rate).toFixed(3)) : undefined;
        payload = {
          ...payload,
          current_price: convertValue(formData.current_price) ?? 0,
          cost: convertValue(formData.cost) ?? 0,
          contribution: convertValue(formData.contribution ?? undefined),
          value_override: convertValue(formData.value_override ?? undefined),
          manual_price_override: true,
          track_price: false,
        };
      }
      if (formData.manual_price_override) {
        payload = {
          ...payload,
          track_price: false,
          manual_price_override: true,
        };
      }
      if (modalMode === 'add') {
        await holdingsAPI.create(payload);
      } else if (modalMode === 'edit' && activeHolding) {
        await holdingsAPI.update(String(activeHolding.id), payload);
      }
      await loadHoldings();
      closeModal();
    } catch (error) {
      setModalError(extractError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHolding = async () => {
    if (!activeHolding) return;
    setIsSubmitting(true);
    setModalError(null);
    setBusyHoldingId(activeHolding.id);
    try {
      await holdingsAPI.delete(String(activeHolding.id));
      await loadHoldings();
      closeModal();
    } catch (error) {
      setModalError(extractError(error));
    } finally {
      setIsSubmitting(false);
      setBusyHoldingId(null);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-gray-200 bg-white/90 backdrop-blur-xl shadow-lg transition-transform duration-200 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0`}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Navigation</p>
              <h2 className="text-lg font-bold text-gray-900">Portfolio</h2>
            </div>
            <button
              type="button"
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100 md:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="p-4 space-y-2">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveTab(id);
                  setSidebarOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors ${
                  activeTab === id
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </aside>
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        <div className="flex-1 md:ml-64">
          {/* Header */}
          <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-30">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    className="rounded-xl border border-gray-200 p-2 text-gray-600 hover:border-blue-400 hover:text-blue-600 md:hidden"
                    onClick={() => setSidebarOpen(true)}
                    aria-label="Open navigation"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Portfolio Tracker
                  </h1>
                </div>
                <div className="hidden items-center gap-3 md:flex">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-xl border border-soft-primary px-4 py-2 text-sm font-semibold text-soft-primary hover:bg-soft-primary hover:text-white transition"
                    onClick={handleSyncPrices}
                    disabled={isSyncingPrices}
                  >
                    {isSyncingPrices ? 'Syncing…' : 'Sync Prices'}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-soft"
                    onClick={openAddModal}
                  >
                    Add Holding
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-6 py-8">
            {statusMessage && (
              <div
                className={`mb-4 flex items-start space-x-3 rounded-xl border p-4 text-sm ${
                  statusMessage.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>{statusMessage.text}</p>
              </div>
            )}
            {loadError && (
              <div className="mb-4 flex items-start space-x-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>{loadError}</p>
              </div>
            )}
            {activeTab === 'overview' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <StatsCard
                    title="Portfolio Value"
                    value={formatCurrency(stats.totalValue)}
                    subtitle={portfolioMovement?.since ? `Last updated ${new Date(portfolioMovement.since).toLocaleString()}` : '90d'}
                    deltaLabel={
                      portfolioMovement?.change !== null && portfolioMovement?.change !== undefined
                        ? `${(portfolioMovement.change ?? 0) >= 0 ? '+' : '-'}${formatCurrency(Math.abs(portfolioMovement.change ?? 0))}` +
                          (portfolioMovement.change_percent !== null && portfolioMovement.change_percent !== undefined
                            ? ` · ${formatSignedPercentage(portfolioMovement.change_percent)}`
                            : '')
                        : undefined
                    }
                    tone={stats.totalGain >= 0 ? 'positive' : 'negative'}
                    sparkValues={portfolioSparkline}
                  />
                  <StatsCard
                    title="Total Gain/Loss"
                    value={formatCurrency(stats.totalGain)}
                    subtitle={stats.totalContribution ? `${formatCurrency(stats.totalContribution)} contributed` : 'vs contribution'}
                    tone={stats.totalGain >= 0 ? 'positive' : 'negative'}
                    sparkValues={portfolioSparkline}
                    action={
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-wide text-soft-secondary">Return</p>
                        <p className={`text-xl font-bold ${stats.totalGain >= 0 ? 'text-soft-success' : 'text-soft-danger'}`}>
                          {formatPercentage(stats.gainPercentage)}
                        </p>
                      </div>
                    }
                  />
                  <div className="rounded-2xl bg-soft-white p-4 shadow-soft">
                    <p className="text-xs font-semibold uppercase tracking-wide text-soft-secondary">Market Update</p>
                    {marketLoading ? (
                      <p className="mt-4 text-sm text-soft-secondary">Syncing latest index data…</p>
                    ) : marketError ? (
                      <p className="mt-4 text-sm text-soft-danger">{marketError}</p>
                    ) : marketIndexes.length ? (
                      <div className="mt-3 divide-y divide-soft-light/70 border border-soft-light rounded-2xl overflow-hidden">
                        {marketIndexes.slice(0, 3).map((index) => {
                          const positive = (index.change ?? 0) >= 0;
                          return (
                            <a
                              key={index.id}
                              href={`https://finance.yahoo.com/quote/${encodeURIComponent(index.symbol)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between gap-4 bg-white/70 px-4 py-3 hover:bg-soft-light/60 transition"
                            >
                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-wide text-soft-secondary">{index.symbol}</p>
                                <p className="text-base font-semibold text-soft-dark truncate">{index.name}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-semibold text-soft-dark">
                                  {index.price !== null ? formatCurrency(index.price) : '—'}
                                </p>
                                <p className={`text-sm font-semibold ${positive ? 'text-soft-success' : 'text-soft-danger'}`}>
                                  {index.change !== null ? `${positive ? '+' : '-'}${formatCurrency(Math.abs(index.change))}` : '—'}
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
                      <p className="mt-4 text-sm text-soft-secondary">No market indexes available.</p>
                    )}
                  </div>
                </div>

                <div className="mb-4 grid gap-3.5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
                  <div className="rounded-2xl bg-soft-white p-3 shadow-soft">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-soft-secondary font-semibold">Total Contribution</p>
                        <div className="mt-0.5 text-xl font-bold text-soft-dark">{formatCurrency(stats.totalContribution)}</div>
                        {stats.totalValue <= 0 && (
                          <p className="text-[11px] text-soft-secondary mt-0.5">Add holdings to build your baseline</p>
                        )}
                      </div>
                      {topAccountSnapshot && (
                        <div className="text-right text-[10px] text-soft-secondary">
                          <p className="uppercase tracking-wide">Top account</p>
                          <p className="font-semibold text-soft-dark text-xs">{topAccountSnapshot.label}</p>
                          <p>{formatCurrency(topAccountSnapshot.value)}</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 space-y-2">
                      <p className="text-[11px] uppercase tracking-wide text-soft-secondary font-semibold">Allocation</p>
                      {allocationBreakdown.length ? (
                        allocationBreakdown.map((slice) => (
                          <div key={slice.label} className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-soft-secondary">
                              <span className="font-semibold text-soft-dark">{slice.label}</span>
                              <span>{slice.percent.toFixed(1)}%</span>
                            </div>
                            <div className="h-1 w-full rounded-full bg-soft-light overflow-hidden">
                              <div
                                className={`${slice.color} h-full transition-all`}
                                style={{ width: `${slice.percent}%` }}
                              ></div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-soft-secondary">Add holdings to see your mix.</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-soft-white p-3.5 shadow-soft flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-soft-secondary font-semibold">Portfolio Movement</p>
                        <p className="text-[11px] text-soft-secondary">
                          Since {portfolioMovement?.since ? new Date(portfolioMovement.since).toLocaleDateString() : 'last sync'} · Range {movementRange.toUpperCase()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 rounded-full bg-soft-light px-1.5 py-0.5">
                        {(['7d', '1m', '3m', 'ytd', 'all'] as const).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setMovementRange(option)}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                              movementRange === option ? 'bg-soft-primary text-white shadow-soft' : 'text-soft-secondary'
                            }`}
                          >
                            {option.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    {marketLoading ? (
                      <div className="flex h-16 items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-soft-primary"></div>
                      </div>
                    ) : portfolioMovement ? (
                      <>
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-soft-secondary">Net Change</p>
                            <p className={`text-2xl font-bold ${
                              (portfolioMovement.change ?? 0) >= 0 ? 'text-soft-success' : 'text-soft-danger'
                            }`}>
                              {portfolioMovement.change !== null
                                ? `${(portfolioMovement.change ?? 0) >= 0 ? '+' : '-'}${formatCurrency(Math.abs(portfolioMovement.change ?? 0))}`
                                : '—'}
                              {portfolioMovement.change_percent !== null && (
                                <span className="ml-2 text-lg">{formatSignedPercentage(portfolioMovement.change_percent)}</span>
                              )}
                            </p>
                            <p className="text-[11px] text-soft-secondary mt-0.5">
                              {portfolioMovement.previous_value !== null && portfolioMovement.current_value !== null
                                ? `${formatCurrency(portfolioMovement.previous_value)} → ${formatCurrency(portfolioMovement.current_value)}`
                                : 'Awaiting snapshot data'}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-soft-light px-4 py-2 text-right">
                            <p className="text-xs uppercase tracking-wide text-soft-secondary">Current Value</p>
                            <p className="text-2xl font-bold text-soft-dark">{formatCurrency(portfolioMovement.current_value ?? stats.totalValue)}</p>
                          </div>
                        </div>
                        <div className="rounded-2xl bg-blue-50/60 p-1">
                          <svg viewBox={`0 0 ${movementSparkline.width} ${movementSparkline.height}`} className="w-full" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="movement-spark" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="rgba(59,130,246,0.35)" />
                                <stop offset="100%" stopColor="rgba(59,130,246,0)" />
                              </linearGradient>
                            </defs>
                            <path d={movementSparkline.areaPath} fill="url(#movement-spark)" stroke="none" />
                            <path d={movementSparkline.linePath} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-soft-secondary">No movement snapshot yet.</p>
                    )}
                  </div>
                </div>

                <HoldingsTable
                  holdings={holdings}
                  onEdit={openEditModal}
                  onDelete={openDeleteModal}
                  busyHoldingId={busyHoldingId}
                  accountFilter={accountFilter}
                  accountFilterOptions={accountFilterOptions}
                  onAccountFilterChange={setAccountFilter}
                  categoryFilter={categoryFilter}
                  categoryFilterOptions={categoryFilterOptions}
                  onCategoryFilterChange={setCategoryFilter}
                />
              </>
            ) : (
              <VisualizationsPanel holdings={holdings} />
            )}
          </main>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-8">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm uppercase tracking-wide text-blue-500 font-semibold">
                  {modalMode === 'add' && 'New Holding'}
                  {modalMode === 'edit' && 'Edit Holding'}
                  {modalMode === 'delete' && 'Delete Holding'}
                </p>
                <h2 className="text-2xl font-bold text-gray-900">
                  {modalMode === 'delete' ? activeHolding?.name : 'Portfolio Entry'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {modalError}
              </div>
            )}

            {modalMode === 'delete' ? (
              <div className="space-y-6">
                <p className="text-gray-700">
                  This action will permanently remove <span className="font-semibold">{activeHolding?.name}</span> from your
                  portfolio. Are you sure you want to continue?
                </p>
                <div className="flex justify-end space-x-3">
                  <button type="button" className="btn-secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteHolding}
                    className="btn-primary bg-gradient-to-r from-red-500 to-red-600"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Deleting…' : 'Delete Holding'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="text-sm font-medium text-gray-700">
                    Account Type
                    <select
                      name="account_type"
                      value={formData.account_type}
                      onChange={handleInputChange}
                      required
                      className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 bg-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="" disabled>
                        Select account type
                      </option>
                      {accountTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Account
                    <input
                      type="text"
                      name="account"
                      value={formData.account}
                      onChange={handleInputChange}
                      required
                      className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
                    />
                  </label>
                  <label className="text-sm font-medium text-gray-700 col-span-full">
                    <div className="flex items-center justify-between">
                      <span>Ticker / Lookup Symbol</span>
                      <span
                        className="ml-2 cursor-help text-xs font-semibold text-blue-500"
                        title="Append .TO to holdings that trade on the TSX (e.g., VEQT.TO)."
                      >
                        i
                      </span>
                    </div>
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="text"
                        name="ticker"
                        value={formData.ticker}
                        onChange={handleInputChange}
                        placeholder="e.g. AAPL"
                        className="flex-1 rounded-xl border border-gray-200 px-4 py-2 focus:border-blue-500 focus:outline-none min-w-0"
                        disabled={isValueOverrideActive}
                      />
                      <button
                        type="button"
                        onClick={handleFetchQuote}
                        className="btn-secondary w-full sm:w-auto"
                        disabled={isFetchingQuote || isValueOverrideActive}
                      >
                        {isFetchingQuote ? 'Fetching…' : 'Fetch Price'}
                      </button>
                    </div>
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Category
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      required
                      className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 bg-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="" disabled>
                        Select category
                      </option>
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Shares
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      name="shares"
                      value={formData.shares}
                      onChange={handleInputChange}
                      required
                      className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
                      disabled={isValueOverrideActive}
                    />
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Cost (per share)
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      name="cost"
                      value={formData.cost}
                      onChange={handleInputChange}
                      required
                      className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
                      disabled={isValueOverrideActive}
                    />
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Current Price
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      name="current_price"
                      value={formData.current_price}
                      onChange={handleInputChange}
                      required
                      className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
                      disabled={isValueOverrideActive}
                    />
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Contribution (total)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="contribution"
                      value={formData.contribution ?? formData.shares * formData.cost}
                      onChange={handleInputChange}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
                      disabled={isValueOverrideActive}
                    />
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Value Override (total)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="value_override"
                      value={formData.value_override ?? ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        value_override: e.target.value === '' ? undefined : Number(e.target.value),
                      }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
                    />
                  </label>
                  <label className="md:col-span-2 text-sm font-medium text-gray-700">
                    Holding Name
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
                    />
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Lookup Symbol (optional)
                    <input
                      type="text"
                      name="lookup"
                      value={formData.lookup || ''}
                      onChange={handleInputChange}
                      placeholder="Used for price tracking"
                      className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
                    />
                  </label>
                  <label className="md:col-span-2 flex items-start gap-3 rounded-xl border border-gray-200 px-4 py-3">
                    <input
                      type="checkbox"
                      name="track_price"
                      checked={formData.track_price}
                      onChange={handleCheckboxChange}
                      className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={isValueOverrideActive}
                    />
                    <span className="text-sm text-gray-700">
                      Track this holding's price automatically using the lookup symbol. We'll add it to your price history if it isn't being tracked yet.
                    </span>
                  </label>
                  <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3">
                    <input
                      type="checkbox"
                      name="manual_price_override"
                      checked={formData.manual_price_override}
                      onChange={handleCheckboxChange}
                      className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      Override current price manually and opt out of tracking for this holding.
                    </span>
                  </label>
                  <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3">
                    <input
                      type="checkbox"
                      name="convert_to_cad"
                      checked={convertToCad}
                      onChange={handleCheckboxChange}
                      className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={isValueOverrideActive}
                    />
                    <span className="text-sm text-gray-700">
                      Convert entered price from USD to CAD using the latest CAD=X quote.
                    </span>
                  </label>
                </div>
                {quoteMessage && (
                  <div
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      quoteMessage.type === 'success'
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                  >
                    {quoteMessage.text}
                  </div>
                )}
                <div className="flex justify-end space-x-3 pt-2">
                  <button type="button" className="btn-secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving…' : modalMode === 'add' ? 'Add Holding' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
