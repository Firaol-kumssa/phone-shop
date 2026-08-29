import { useQuery } from '@tanstack/react-query';
import {
  fetchInventoryReport,
  fetchProfitReport,
  fetchReturnsReport,
  fetchSalesReport,
  fetchSalesSeries,
  fetchSalesSplit,
  type ProfitPeriod,
  type SalesPeriod,
} from '@/services/report.service';
import type { ProfitGroupBy } from '@/services/types';

export function useSalesReport(period: SalesPeriod, param: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['reports', period, param ?? 'current'],
    queryFn: () => fetchSalesReport(period, param),
    enabled,
  });
}

export function useSalesSeries(period: SalesPeriod, enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'series', period],
    queryFn: () => fetchSalesSeries(period),
    enabled,
  });
}

export function useSalesSplit(enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'split'],
    queryFn: fetchSalesSplit,
    enabled,
  });
}

export function useReturnsReport(from: string | undefined, to: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'returns', from ?? 'all', to ?? 'all'],
    queryFn: () => fetchReturnsReport(from, to),
    enabled,
  });
}

export function useProfitReport(
  groupBy: ProfitGroupBy,
  period: ProfitPeriod,
  param: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['reports', 'profit', groupBy, period, param ?? 'current'],
    queryFn: () => fetchProfitReport(groupBy, period, param),
    enabled,
  });
}

export function useInventoryReport(enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'inventory'],
    queryFn: fetchInventoryReport,
    enabled,
  });
}
