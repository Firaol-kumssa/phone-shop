import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSale } from '@/services/sale.service';

export function useCreateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSale,
    // Stock is a live query (Blueprint 3.2) — refetch it after a sale commits
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['phones'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
