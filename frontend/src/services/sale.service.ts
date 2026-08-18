import { api } from './api';
import type { CreateSalePayload, Sale } from './types';

export function createSale(payload: CreateSalePayload): Promise<Sale> {
  return api<Sale>('/sales', { method: 'POST', body: JSON.stringify(payload) });
}
