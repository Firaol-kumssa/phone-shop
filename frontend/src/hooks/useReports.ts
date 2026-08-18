import { useQuery } from '@tanstack/react-query';
import { fetchInventoryReport, fetchSalesReport, type SalesPeriod } from '@/services/report.service';

export function useSalesReport(period: SalesPeriod, param: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['reports', period, param ?? 'current'],
    queryFn: () => fetchSalesReport(period, param),
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
