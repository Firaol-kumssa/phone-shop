import { api } from './api';
import type { InventoryReport, ProfitGroupBy, ProfitReport, SalesReport, SalesSplit } from './types';

export type SalesPeriod = 'daily' | 'weekly' | 'monthly';

/** daily/weekly take ?date=YYYY-MM-DD; monthly takes ?month=YYYY-MM (Blueprint 3.5). */
export function fetchSalesReport(period: SalesPeriod, param?: string): Promise<SalesReport> {
  const key = period === 'monthly' ? 'month' : 'date';
  const query = param ? `?${key}=${param}` : '';
  return api<SalesReport>(`/reports/${period}${query}`);
}

export function fetchSalesSeries(period: SalesPeriod): Promise<SalesReport[]> {
  return api<SalesReport[]>(`/reports/series?period=${period}`);
}

export function fetchSalesSplit(): Promise<SalesSplit> {
  return api<SalesSplit>('/reports/split');
}

export function fetchProfitReport(groupBy: ProfitGroupBy): Promise<ProfitReport> {
  return api<ProfitReport>(`/reports/profit?groupBy=${groupBy}`);
}

export function fetchInventoryReport(): Promise<InventoryReport> {
  return api<InventoryReport>('/reports/inventory');
}
