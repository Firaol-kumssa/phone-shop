import { api } from './api';
import type { CreateSalePayload, ProcessReturnPayload, Sale, SaleDetail } from './types';

export function createSale(payload: CreateSalePayload): Promise<Sale> {
  return api<Sale>('/sales', { method: 'POST', body: JSON.stringify(payload) });
}

export function listSales(): Promise<SaleDetail[]> {
  return api<SaleDetail[]>('/sales');
}

export function processReturn(saleId: number, payload: ProcessReturnPayload): Promise<SaleDetail> {
  return api<SaleDetail>(`/sales/${saleId}/return`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
