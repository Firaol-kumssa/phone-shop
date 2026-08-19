import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProduct,
  discontinueProduct,
  listProducts,
  restockProduct,
} from '@/services/product.service';
import type { ProductStatus } from '@/services/types';

export function useProducts(status?: ProductStatus) {
  return useQuery({
    queryKey: ['products', status ?? 'all'],
    queryFn: () => listProducts(status),
  });
}

export function useDiscontinueProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: discontinueProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useRestockProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, quantity }: { productId: number; quantity: number }) =>
      restockProduct(productId, quantity),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}
