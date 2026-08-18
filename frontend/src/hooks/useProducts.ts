import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createProduct, listProducts, restockProduct } from '@/services/product.service';

export function useProducts() {
  return useQuery({ queryKey: ['products'], queryFn: listProducts });
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
