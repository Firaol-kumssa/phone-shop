import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSupplier, getSupplier, listSuppliers, recordDelivery } from '@/services/supplier.service';
import type { RecordDeliveryPayload } from '@/services/types';

export function useSuppliers() {
  return useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });
}

export function useSupplier(supplierId: number | null) {
  return useQuery({
    queryKey: ['suppliers', supplierId],
    queryFn: () => getSupplier(supplierId!),
    enabled: supplierId !== null,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSupplier,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useRecordDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ supplierId, payload }: { supplierId: number; payload: RecordDeliveryPayload }) =>
      recordDelivery(supplierId, payload),
    // New phones enter stock, and the supplier's purchase history grows
    onSuccess: (_purchase, { supplierId }) => {
      void queryClient.invalidateQueries({ queryKey: ['phones'] });
      void queryClient.invalidateQueries({ queryKey: ['suppliers', supplierId] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
