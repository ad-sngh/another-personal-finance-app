import { useEffect, useMemo, useState, useCallback, type ComponentType } from 'react';
import { TrendingUp, TrendingDown, X, AlertTriangle, Menu, LayoutDashboard, BarChart3, Users } from 'lucide-react';
import { holdingsAPI, usersAPI, insightsAPI, Holding, HoldingPayload, MarketIndexSummary, PortfolioMovementSnapshot, MovementRangeOption, User, Insight } from '../api/client';
import HoldingsTable from './HoldingsTable';
import StatsCard from './StatsCard';
import VisualizationsPanel from './VisualizationsPanel';
import StockInsightsPanel from './StockInsightsPanel';
import { formatCurrency, formatSignedPercentage } from '../utils/format';

const ACCOUNT_TYPE_PRESETS = ['Taxable', 'TFSA', 'RRSP', 'RESP', 'Cash', 'Brokerage'];
const CATEGORY_PRESETS = ['Stocks', 'ETF', 'Cash', 'Crypto', 'Bond', 'Mutual Fund'];
const ALLOCATION_COLORS = ['bg-amber-400', 'bg-blue-500', 'bg-indigo-400', 'bg-emerald-400', 'bg-slate-400'];
const EST_TIMEZONE = 'America/New_York';
const EST_SUFFIX = ' EST';

export default function Dashboard() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [backendTotals, setBackendTotals] = useState({
    totalValue: 0,
    totalContribution: 0,
    totalGain: 0,
    gainPercentage: 0,
    holdingsCount: 0,
  });
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('default');
  const [accountFilter, setAccountFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [excludedAccounts, setExcludedAccounts] = useState<string[]>([]);
  const [excludedCategories, setExcludedCategories] = useState<string[]>([]);
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
    track_insights: true,
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
  const [movementRange, setMovementRange] = useState<MovementRangeOption>('1m');
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [movementLoading, setMovementLoading] = useState(true);
  const [movementError, setMovementError] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const accountFilterOptions = useMemo(() => ['All', ...Array.from(new Set(holdings.map(h => h.account_type).filter(Boolean)))], [holdings]);
  const categoryFilterOptions = useMemo(() => ['All', ...Array.from(new Set(holdings.map(h => h.category).filter(Boolean)))], [holdings]);

  const handleAccountFilterChange = useCallback((option: string) => {
    setAccountFilter(option);
  }, []);

  const handleCategoryFilterChange = useCallback((option: string) => {
    setCategoryFilter(option);
  }, []);

  const toggleAccountExclusion = useCallback((option: string) => {
    if (option === 'All') return;
    setExcludedAccounts((prev) => {
      const exists = prev.includes(option);
      const next = exists ? prev.filter((value) => value !== option) : [...prev, option];
      return next;
    });
    if (accountFilter === option) {
      setAccountFilter('All');
    }
  }, [accountFilter]);

  const toggleCategoryExclusion = useCallback((option: string) => {
    if (option === 'All') return;
    setExcludedCategories((prev) => {
      const exists = prev.includes(option);
      const next = exists ? prev.filter((value) => value !== option) : [...prev, option];
      return next;
    });
    if (categoryFilter === option) {
      setCategoryFilter('All');
    }
  }, [categoryFilter]);
  const filteredHoldings = useMemo(() => {
    const excludedAccountSet = new Set(excludedAccounts);
    const excludedCategorySet = new Set(excludedCategories);
    return holdings.filter((holding) => {
      const accountMatch = (accountFilter === 'All' || holding.account_type === accountFilter) && !excludedAccountSet.has(holding.account_type);
      const categoryMatch = (categoryFilter === 'All' || holding.category === categoryFilter) && !excludedCategorySet.has(holding.category);
      return accountMatch && categoryMatch;
    });
  }, [holdings, accountFilter, categoryFilter, excludedAccounts, excludedCategories]);

  const stats = useMemo(() => {
    const totalValue = filteredHoldings.reduce((sum, h) => sum + h.value, 0);
    const totalContribution = filteredHoldings.reduce((sum, h) => sum + h.contribution, 0);
    const totalGain = totalValue - totalContribution;
    const gainPercentage = totalContribution > 0 ? (totalGain / totalContribution) * 100 : 0;
    return { totalValue, totalContribution, totalGain, gainPercentage };
  }, [filteredHoldings]);

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

  const backendCurrentValue = backendTotals.totalValue || 0;
  const currentRatio = backendCurrentValue > 0 ? stats.totalValue / backendCurrentValue : 1;

  const movementPoints = useMemo(() => {
    if (!portfolioMovement?.points || !portfolioMovement.points.length) return undefined;
    return portfolioMovement.points.map((point, index) => {
      const scaledValue = currentRatio * point.value;
      if (index === portfolioMovement.points!.length - 1) {
        return { ...point, value: stats.totalValue };
      }
      return { ...point, value: scaledValue };
    });
  }, [portfolioMovement?.points, stats.totalValue, currentRatio]);

  const movementValues = movementPoints?.map((point) => point.value);

  const FALLBACK_SPARKLINE = useMemo(() => [0, 1, 0.5, 1.2, 0.8, 1.4, 1], []);

  const formatPointsToSparkline = (values: number[] | undefined, fallback: number[] = FALLBACK_SPARKLINE) => {
    if (!values || values.length < 2) return fallback;
    return values;
  };

  const sharedSparklineValues = formatPointsToSparkline(movementValues, portfolioSparkline);

  const movementSparkline = useMemo(() => {
    const values = sharedSparklineValues;
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
  }, [sharedSparklineValues]);

  const formatTimestampEST = useCallback((value?: string | null, options?: Intl.DateTimeFormatOptions) => {
    if (!value) return null;
    try {
      const normalizedValue = /Z|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
      const formatter = new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: EST_TIMEZONE,
        ...options,
      });
      return `${formatter.format(new Date(normalizedValue))}${EST_SUFFIX}`;
    } catch (error) {
      console.warn('Failed to format timestamp', error);
      return new Date(value).toLocaleString();
    }
  }, []);

  const formatRelativeTime = useCallback((value?: string | null) => {
    if (!value) return null;
    try {
      const normalizedValue = /Z|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
      const timestamp = new Date(normalizedValue);
      if (Number.isNaN(timestamp.getTime())) return null;
      const diffSeconds = Math.max(0, Math.round((Date.now() - timestamp.getTime()) / 1000));
      const units: { limit: number; divisor: number; label: Intl.RelativeTimeFormatUnit }[] = [
        { limit: 60, divisor: 1, label: 'second' },
        { limit: 3600, divisor: 60, label: 'minute' },
        { limit: 86400, divisor: 3600, label: 'hour' },
        { limit: 604800, divisor: 86400, label: 'day' },
        { limit: 2592000, divisor: 604800, label: 'week' },
        { limit: Infinity, divisor: 2592000, label: 'month' },
      ];
      const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
      for (const unit of units) {
        if (diffSeconds < unit.limit) {
          const valueInUnit = Math.max(1, Math.floor(diffSeconds / unit.divisor));
          return relative.format(-valueInUnit, unit.label);
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to format relative time', error);
      return null;
    }
  }, []);

  const movementPreviousValueRaw = portfolioMovement?.previous_value ?? stats.totalValue;
  const movementPreviousValue = movementPreviousValueRaw * currentRatio;
  const movementChange = stats.totalValue - movementPreviousValue;
  const movementChangePercent = movementPreviousValue ? (movementChange / movementPreviousValue) * 100 : null;

  const movementData = useMemo(() => {
    if (!portfolioMovement) return null;
    return {
      ...portfolioMovement,
      current_value: stats.totalValue,
      previous_value: movementPreviousValue,
      change: movementChange,
      change_percent: movementChangePercent,
      points: movementPoints ?? portfolioMovement.points,
    };
  }, [portfolioMovement, stats.totalValue, movementPreviousValue, movementChange, movementChangePercent, movementPoints]);

  const lastUpdatedLabel = formatTimestampEST(movementData?.last_updated_at);
  const lastUpdatedRelative = formatRelativeTime(movementData?.last_updated_at);

  const movementSparklineWidthValue = movementSparkline.width;
  const portfolioValueTrendColor = movementChange >= 0 ? 'text-emerald-700' : 'text-rose-600';
  const portfolioValueTrendIcon = movementChange >= 0 ? (
    <TrendingUp className="h-5 w-5" aria-hidden />
  ) : (
    <TrendingDown className="h-5 w-5" aria-hidden />
  );

  const gainTrendColor = stats.totalGain >= 0 ? 'text-emerald-700' : 'text-rose-600';
  const gainTrendIcon = stats.totalGain >= 0 ? (
    <TrendingUp className="h-5 w-5" aria-hidden />
  ) : (
    <TrendingDown className="h-5 w-5" aria-hidden />
  );

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
    loadUsers();
    loadHoldings();
    loadMarketContext();
    loadInsights();
  }, []);

  useEffect(() => {
    loadHoldings();
    loadPortfolioMovement(movementRange);
    loadInsights();
  }, [currentUserId]);

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
    track_insights: true,
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
    track_insights: holding.track_insights ?? holding.track_price ?? true,
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
      await loadPortfolioMovement(movementRange);
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
      const response = await holdingsAPI.getAll(currentUserId);
      setHoldings(response.data.holdings);
      setBackendTotals({
        totalValue: response.data.stats.total_value,
        totalContribution: response.data.stats.total_cost,
        totalGain: response.data.stats.total_gain,
        gainPercentage: response.data.stats.total_gain_percent,
        holdingsCount: response.data.stats.holdings_count,
      });
    } catch (error) {
      console.error('Failed to load holdings:', error);
      setLoadError('Failed to load holdings');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await usersAPI.getAll();
      setUsers(response.data.users);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadMarketContext = async () => {
    setMarketLoading(true);
    setMarketError(null);
    try {
      const indexesResponse = await holdingsAPI.getMarketSummary();
      setMarketIndexes(indexesResponse.data.indexes);
    } catch (error) {
      console.error('Error loading market context:', error);
      setMarketError('Unable to load market data right now.');
    } finally {
      setMarketLoading(false);
    }
  };

  const loadPortfolioMovement = useCallback(async (rangeOverride: MovementRangeOption) => {
    setMovementLoading(true);
    setMovementError(null);
    try {
      const response = await holdingsAPI.getPortfolioMovement(rangeOverride, currentUserId);
      setPortfolioMovement(response.data);
    } catch (error) {
      console.error('Error loading portfolio movement:', error);
      setMovementError('Unable to load movement data.');
    } finally {
      setMovementLoading(false);
    }
  }, [currentUserId]);

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const response = await insightsAPI.getAll(currentUserId);
      setInsights(response.data.insights);
    } catch (error) {
      console.error('Error loading insights:', error);
      setInsightsError('Unable to load insights.');
    } finally {
      setInsightsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadPortfolioMovement(movementRange);
  }, [movementRange, loadPortfolioMovement]);

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
      ...(name === 'track_price' ? { track_insights: checked } : {}),
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
                  <div className="relative">
                    <select
                      value={currentUserId}
                      onChange={e => setCurrentUserId(e.target.value)}
                      className="appearance-none bg-white border border-soft-primary rounded-xl px-4 py-2 pr-10 text-sm font-semibold text-soft-primary hover:bg-soft-primary hover:text-white transition cursor-pointer"
                    >
                      {users.map(u => (
                        <option key={u.user_id} value={u.user_id}>{u.display_name}</option>
                      ))}
                    </select>
                    <Users className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-soft-primary" />
                  </div>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                  <StatsCard
                    title="Portfolio Value"
                    customBody={
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-soft-secondary">Portfolio Value</p>
                            <p className="text-3xl font-black tracking-tight text-soft-dark">{formatCurrency(stats.totalValue)}</p>
                          </div>
                          <div className="text-right">
                            <div className={`flex items-center justify-end gap-1 text-2xl font-bold ${portfolioValueTrendColor}`}>
                              {portfolioValueTrendIcon}
                              <span>{movementChangePercent !== null ? formatSignedPercentage(movementChangePercent) : '—'}</span>
                            </div>
                            {movementData && (
                              <div className={`text-sm font-semibold ${portfolioValueTrendColor}`}>
                                {movementChange >= 0 ? '+' : '-'}
                                {formatCurrency(Math.abs(movementChange))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    }
                    sparkValues={sharedSparklineValues}
                    sparklineWidth={movementSparklineWidthValue}
                    footer={
                      lastUpdatedRelative ? (
                        <span title={lastUpdatedLabel ?? undefined}>Updated {lastUpdatedRelative}</span>
                      ) : lastUpdatedLabel ? (
                        `Updated ${lastUpdatedLabel}`
                      ) : undefined
                    }
                  />
                  <StatsCard
                    title="Total Gain/Loss"
                    customBody={
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-soft-secondary">Total Gain/Loss</p>
                            <p className="text-3xl font-black tracking-tight text-soft-dark">{formatCurrency(stats.totalGain)}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-xs uppercase tracking-wide text-soft-secondary mb-1">Return</div>
                            <div className={`flex items-center justify-end gap-2 text-2xl font-bold ${gainTrendColor}`}>
                              {gainTrendIcon}
                              <span>{formatSignedPercentage(stats.gainPercentage)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    }
                    sparkValues={sharedSparklineValues}
                    footer={stats.totalContribution ? `${formatCurrency(stats.totalContribution)} contributed` : undefined}
                  />
                  <div className="rounded-xl bg-soft-white p-3 shadow-soft">
                    <p className="text-xs font-semibold uppercase tracking-wide text-soft-secondary">Market Update</p>
                    {marketLoading ? (
                      <p className="mt-3 text-sm text-soft-secondary">Syncing latest index data…</p>
                    ) : marketError ? (
                      <p className="mt-3 text-sm text-soft-danger">{marketError}</p>
                    ) : marketIndexes.length ? (
                      <div className="mt-2.5 divide-y divide-soft-light/70 border border-soft-light rounded-xl overflow-hidden">
                        {marketIndexes.slice(0, 3).map((index) => {
                          const positive = (index.change ?? 0) >= 0;
                          return (
                            <a
                              key={index.id}
                              href={`https://finance.yahoo.com/quote/${encodeURIComponent(index.symbol)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between gap-3 bg-white/70 px-3 py-2.5 hover:bg-soft-light/60 transition"
                            >
                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-wide text-soft-secondary">{index.symbol}</p>
                                <p className="text-sm font-semibold text-soft-dark truncate">{index.name}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-base font-semibold text-soft-dark">
                                  {index.price !== null ? formatCurrency(index.price) : '—'}
                                </p>
                                <p className={`text-xs font-semibold ${positive ? 'text-soft-success' : 'text-soft-danger'}`}>
                                  {index.change !== null ? `${positive ? '+' : '-'}${formatCurrency(Math.abs(index.change))}` : '—'}
                                  {index.change_percent !== null && (
                                    <span className="ml-2 text-[11px]">{formatSignedPercentage(index.change_percent)}</span>
                                  )}
                                </p>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-soft-secondary">No market indexes available.</p>
                    )}
                  </div>
                </div>

                <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
                  <div className="rounded-xl bg-soft-white p-3 shadow-soft">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-soft-secondary font-semibold">Total Contribution</p>
                        <div className="mt-0.5 text-2xl font-bold text-soft-dark">{formatCurrency(stats.totalContribution)}</div>
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
                    <div className="mt-2.5 space-y-2">
                      <p className="text-[11px] uppercase tracking-wide text-soft-secondary font-semibold">Allocation</p>
                      {allocationBreakdown.length ? (
                        allocationBreakdown.map((slice) => (
                          <div key={slice.label} className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-soft-secondary">
                              <span className="font-semibold text-soft-dark text-xs">{slice.label}</span>
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
                  <div className="rounded-xl bg-soft-white p-3 shadow-soft flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-soft-secondary font-semibold">Portfolio Movement</p>
                        <p className="text-[11px] text-soft-secondary">
                          Updated {lastUpdatedLabel ?? '—'} · Range {(movementData?.range || movementRange).toUpperCase()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 rounded-full bg-soft-light px-1 py-0.5">
                        {(['7d', '1m', '3m', 'ytd', 'all'] as const).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setMovementRange(option)}
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
                              movementRange === option ? 'bg-soft-primary text-white shadow-soft' : 'text-soft-secondary'
                            }`}
                          >
                            {option.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    {movementLoading ? (
                      <div className="flex h-16 items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-soft-primary"></div>
                      </div>
                    ) : movementError ? (
                      <p className="text-sm text-soft-danger">{movementError}</p>
                    ) : movementData ? (
                      <>
                        <div className="flex flex-wrap items-end justify-between gap-2.5">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-soft-secondary">Net Change</p>
                            <p className={`text-2xl font-bold ${
                              movementChange >= 0 ? 'text-soft-success' : 'text-soft-danger'
                            }`}>
                              {`${movementChange >= 0 ? '+' : '-'}${formatCurrency(Math.abs(movementChange))}`}
                              {movementChangePercent !== null && (
                                <span className="ml-2 text-base">{formatSignedPercentage(movementChangePercent)}</span>
                              )}
                            </p>
                            <p className="text-[11px] text-soft-secondary mt-0.5">
                              {movementData.previous_value !== null
                                ? `${formatCurrency(movementData.previous_value)} → ${formatCurrency(movementData.current_value)}`
                                : 'Awaiting snapshot data'}
                            </p>
                          </div>
                          <div className="rounded-xl bg-soft-light px-3 py-1.5 text-right">
                            <p className="text-xs uppercase tracking-wide text-soft-secondary">Current Value</p>
                            <p className="text-xl font-bold text-soft-dark">{formatCurrency(movementData.current_value)}</p>
                          </div>
                        </div>
                        <div className="rounded-xl bg-blue-50/60 p-0.5">
                          <svg viewBox={`0 0 ${movementSparkline.width} ${movementSparkline.height}`} className="w-full h-32" preserveAspectRatio="none">
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

                <div className="grid gap-6 xl:grid-cols-[minmax(0,2.2fr)_minmax(250px,0.6fr)] xl:items-start">
                  <HoldingsTable
                    holdings={holdings}
                    onEdit={openEditModal}
                    onDelete={openDeleteModal}
                    busyHoldingId={busyHoldingId}
                    accountFilter={accountFilter}
                    accountFilterOptions={accountFilterOptions}
                    onAccountFilterChange={handleAccountFilterChange}
                    onAccountExclusionToggle={toggleAccountExclusion}
                    excludedAccounts={excludedAccounts}
                    categoryFilter={categoryFilter}
                    categoryFilterOptions={categoryFilterOptions}
                    onCategoryFilterChange={handleCategoryFilterChange}
                    onCategoryExclusionToggle={toggleCategoryExclusion}
                    excludedCategories={excludedCategories}
                  />
                  <div className="hidden xl:block">
                    <StockInsightsPanel 
                      insights={insights}
                      loading={insightsLoading}
                      error={insightsError}
                      onRefresh={loadInsights}
                    />
                  </div>
                </div>
              </>
            ) : (
              <VisualizationsPanel holdings={holdings} userId={currentUserId} />
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
                      Track this holding's price & insights automatically using the lookup symbol. We'll add it to your price history if it isn't being tracked yet.
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
