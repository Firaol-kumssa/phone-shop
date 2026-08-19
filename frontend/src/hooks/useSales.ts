import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSale, listSales, processReturn } from '@/services/sale.service';
import type { ProcessReturnPayload } from '@/services/types';

export function useSalesList() {
  return useQuery({ queryKey: ['sales'], queryFn: listSales });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSale,
    // Stock is a live query (Blueprint 3.2) — refetch it after a sale commits
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['phones'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useProcessReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ saleId, payload }: { saleId: number; payload: ProcessReturnPayload }) =>
      processReturn(saleId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
      void queryClient.invalidateQueries({ queryKey: ['phones'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
