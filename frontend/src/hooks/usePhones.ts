import { useQuery } from '@tanstack/react-query';
import { listPhones } from '@/services/phone.service';
import type { PhoneStatus } from '@/services/types';

/** Live stock query — "available" is simply status = InStock (Blueprint 3.2). */
export function usePhones(status?: PhoneStatus) {
  return useQuery({
    queryKey: ['phones', status ?? 'all'],
    queryFn: () => listPhones(status),
  });
}
