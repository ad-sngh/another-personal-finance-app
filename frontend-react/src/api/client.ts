import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8081';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Holding {
  id: number;
  holding_id: string;
  account_type: string;
  account: string;
  ticker: string;
  lookup?: string;
  name: string;
  category: string;
  shares: number;
  cost: number;
  current_price: number;
  contribution: number;
  value: number;
  track_price?: boolean;
  price_source?: 'price_history' | 'holdings_table';
  manual_price_override?: boolean;
  value_override?: number | null;
}

export type HoldingPayload = {
  account_type: string;
  account: string;
  ticker: string;
  name: string;
  category: string;
  lookup?: string;
  shares: number;
  cost: number;
  current_price: number;
  contribution?: number;
  track_price: boolean;
  manual_price_override?: boolean;
  value_override?: number | null;
};

export interface PriceHistory {
  date: string;
  price: number;
}

export interface AccountTypeStat {
  account_type: string;
  contribution: number;
  value: number;
  count: number;
}

export interface PortfolioHistoryPoint {
  date: string;
  value: number;
}

export interface MarketIndexSummary {
  id: string;
  name: string;
  symbol: string;
  price: number | null;
  change: number | null;
  change_percent: number | null;
}

export interface PortfolioMovementSnapshot {
  current_value: number;
  previous_value: number;
  change: number;
  change_percent: number | null;
  since: string;
}

export const holdingsAPI = {
  getAll: () => api.get<{ holdings: Holding[] }>('/api/holdings'),
  getById: (id: string) => api.get<Holding>(`/api/holdings/${id}`),
  create: (data: HoldingPayload) => api.post('/api/holdings', data),
  update: (id: string, data: HoldingPayload) => api.put(`/api/holdings/${id}`, data),
  delete: (id: string) => api.delete(`/api/holdings/${id}`),
  fetchPrice: (ticker: string) => api.post('/api/fetch-price', { ticker }),
  getPriceHistory: (ticker: string, days: number = 30) => 
    api.get<{ ticker: string; history: PriceHistory[] }>(`/api/price-history/${ticker}?days=${days}`),
  capturePrices: () => api.post('/api/capture-prices'),
  getPortfolioHistory: (days: number = 30) =>
    api.get<{ history: PortfolioHistoryPoint[]; account_type_history: Record<string, PortfolioHistoryPoint[]> }>(
      `/api/portfolio-history?days=${days}`,
    ),
  getPortfolioByAccountType: () => api.get<{ account_types: AccountTypeStat[] }>('/api/portfolio-by-account-type'),
  getMarketSummary: () => api.get<{ indexes: MarketIndexSummary[] }>('/api/market-summary'),
  getPortfolioMovement: () => api.get<PortfolioMovementSnapshot>('/api/portfolio-movement'),
};
