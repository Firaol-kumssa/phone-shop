import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPhone, listPhones } from '@/services/phone.service';
import type { PhoneStatus } from '@/services/types';

/** Live stock query — "available" is simply status = InStock (Blueprint 3.2). */
export function usePhones(status?: PhoneStatus) {
  return useQuery({
    queryKey: ['phones', status ?? 'all'],
    queryFn: () => listPhones(status),
  });
}

export function useCreatePhone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPhone,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['phones'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
