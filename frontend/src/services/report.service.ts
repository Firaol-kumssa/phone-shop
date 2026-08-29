import { api } from './api';
import type {
  InventoryReport,
  ProfitGroupBy,
  ProfitReport,
  ReturnsReport,
  SalesReport,
  SalesSplit,
} from './types';

export type SalesPeriod = 'daily' | 'weekly' | 'monthly';

/** daily/weekly take ?date=YYYY-MM-DD; monthly takes ?month=YYYY-MM (Blueprint 3.5). */
export function fetchSalesReport(period: SalesPeriod, param?: string): Promise<SalesReport> {
  const key = period === 'monthly' ? 'month' : 'date';
  const query = param ? `?${key}=${param}` : '';
  return api<SalesReport>(`/reports/${period}${query}`);
}

/** Last 7 buckets of the period, oldest first — feeds the bar chart. */
export function fetchSalesSeries(period: SalesPeriod): Promise<SalesReport[]> {
  return api<SalesReport[]>(`/reports/series?period=${period}`);
}

export function fetchSalesSplit(): Promise<SalesSplit> {
  return api<SalesSplit>('/reports/split');
}

export function fetchReturnsReport(from?: string, to?: string): Promise<ReturnsReport> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return api<ReturnsReport>(`/reports/returns${query ? `?${query}` : ''}`);
}

export type ProfitPeriod = 'all' | SalesPeriod;

export function fetchProfitReport(
  groupBy: ProfitGroupBy,
  period: ProfitPeriod,
  param?: string,
): Promise<ProfitReport> {
  const params = new URLSearchParams({ groupBy });
  if (period !== 'all') {
    params.set('period', period);
    if (param) params.set(period === 'monthly' ? 'month' : 'date', param);
  }
  return api<ProfitReport>(`/reports/profit?${params.toString()}`);
}

export function fetchInventoryReport(): Promise<InventoryReport> {
  return api<InventoryReport>('/reports/inventory');
}
