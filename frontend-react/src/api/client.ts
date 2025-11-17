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
  name: string;
  category: string;
  shares: number;
  cost: number;
  current_price: number;
  contribution: number;
  value: number;
}

export interface PriceHistory {
  date: string;
  price: number;
}

export const holdingsAPI = {
  getAll: () => api.get<{ holdings: Holding[] }>('/api/holdings'),
  getById: (id: string) => api.get<Holding>(`/api/holdings/${id}`),
  create: (data: Partial<Holding>) => api.post('/api/holdings', data),
  update: (id: string, data: Partial<Holding>) => api.put(`/api/holdings/${id}`, data),
  delete: (id: string) => api.delete(`/api/holdings/${id}`),
  fetchPrice: (ticker: string) => api.post('/api/fetch-price', { ticker }),
  getPriceHistory: (ticker: string, days: number = 30) => 
    api.get<{ ticker: string; history: PriceHistory[] }>(`/api/price-history/${ticker}?days=${days}`),
};
