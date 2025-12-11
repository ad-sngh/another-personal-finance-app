import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8081';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Insight {
  ticker: string;
  summary: string;
  move?: string | null;
  sentiment?: string | null;
  analysis_json?: string | null;
  captured_at: string;
}

export interface InsightsResponse {
  user_id: string;
  insights: Insight[];
}

export interface RunInsightRequest {
  symbol: string;
  current_price?: number;
  previous_close?: number;
  user_id?: string;
}

export interface RunInsightResponse {
  symbol: string;
  summary: string;
  analysis: Record<string, unknown>;
  stored_for_user: string;
}

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
  track_insights?: boolean;
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
  track_insights: boolean;
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

export type MovementRangeOption = '7d' | '1m' | '3m' | 'ytd' | 'all';

export interface PortfolioMovementPoint {
  timestamp: string;
  value: number;
}

export interface PortfolioMovementSnapshot {
  current_value: number;
  previous_value: number;
  change: number;
  change_percent: number | null;
  since: string;
  last_updated_at: string;
  range: MovementRangeOption;
  points?: PortfolioMovementPoint[];
}

export interface PortfolioStatsResponse {
  total_value: number;
  total_cost: number;
  total_gain: number;
  total_gain_percent: number;
  holdings_count: number;
}

export interface User {
  user_id: string;
  display_name: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export const usersAPI = {
  getAll: () => api.get<{ users: User[] }>('/api/users'),
};

export const holdingsAPI = {
  getAll: (userId?: string) => api.get<{ holdings: Holding[]; stats: PortfolioStatsResponse; user_id: string }>('/api/holdings', {
    params: userId ? { user_id: userId } : undefined,
  }),
  getById: (id: string) => api.get<Holding>(`/api/holdings/${id}`),
  create: (data: HoldingPayload) => api.post('/api/holdings', data),
  update: (id: string, data: HoldingPayload) => api.put(`/api/holdings/${id}`, data),
  delete: (id: string) => api.delete(`/api/holdings/${id}`),
  fetchPrice: (ticker: string) => api.post('/api/fetch-price', { ticker }),
  getPriceHistory: (ticker: string, days: number = 30) => 
    api.get<{ ticker: string; history: PriceHistory[] }>(`/api/price-history/${ticker}?days=${days}`),
  capturePrices: () => api.post('/api/capture-prices'),
  getPortfolioHistory: (days: number = 30, userId?: string) =>
    api.get<{ history: PortfolioHistoryPoint[]; account_type_history: Record<string, PortfolioHistoryPoint[]> }>(
      '/api/portfolio-history',
      {
        params: {
          days,
          ...(userId ? { user_id: userId } : undefined),
        },
      },
    ),
  getPortfolioByAccountType: () => api.get<{ account_types: AccountTypeStat[] }>('/api/portfolio-by-account-type'),
  getMarketSummary: () => api.get<{ indexes: MarketIndexSummary[] }>('/api/market-summary'),
  getPortfolioMovement: (range?: MovementRangeOption, userId?: string) =>
    api.get<PortfolioMovementSnapshot>('/api/portfolio-movement', {
      params: { ...(range ? { range } : undefined), ...(userId ? { user_id: userId } : undefined) },
    }),
};

export const insightsAPI = {
  getAll: (userId?: string) => api.get<InsightsResponse>('/api/insights', {
    params: userId ? { user_id: userId } : undefined,
  }),
  run: (data: RunInsightRequest) => api.post<RunInsightResponse>('/api/insights/run', data),
  refresh: (userId?: string) => api.post<{ user_id: string; refreshed: string[]; errors: Array<{ symbol: string; error: string }> }>('/api/insights/refresh', {
    user_id: userId,
  }),
};
