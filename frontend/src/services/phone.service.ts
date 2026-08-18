import { api } from './api';
import type { Phone, PhoneStatus } from './types';

export function listPhones(status?: PhoneStatus): Promise<Phone[]> {
  const query = status ? `?status=${status}` : '';
  return api<Phone[]>(`/phones${query}`);
}
