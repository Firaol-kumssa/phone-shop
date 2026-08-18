import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCustomer, getCustomer, listCustomers } from '@/services/customer.service';

export function useCustomers() {
  return useQuery({ queryKey: ['customers'], queryFn: listCustomers });
}

export function useCustomer(customerId: number | null) {
  return useQuery({
    queryKey: ['customers', customerId],
    queryFn: () => getCustomer(customerId!),
    enabled: customerId !== null,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });
}
