import { api } from './api';
import type { Purchase, RecordDeliveryPayload, Supplier, SupplierDetail } from './types';

export function listSuppliers(): Promise<Supplier[]> {
  return api<Supplier[]>('/suppliers');
}

export function getSupplier(supplierId: number): Promise<SupplierDetail> {
  return api<SupplierDetail>(`/suppliers/${supplierId}`);
}

export function recordDelivery(
  supplierId: number,
  payload: RecordDeliveryPayload,
): Promise<Purchase> {
  return api<Purchase>(`/suppliers/${supplierId}/purchases`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
