import { api } from './api';
import type { CreatePhonePayload, Phone, PhoneStatus } from './types';

export function listPhones(status?: PhoneStatus): Promise<Phone[]> {
  const query = status ? `?status=${status}` : '';
  return api<Phone[]>(`/phones${query}`);
}

export function createPhone(payload: CreatePhonePayload): Promise<Phone> {
  return api<Phone>('/phones', { method: 'POST', body: JSON.stringify(payload) });
}
