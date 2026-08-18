import { api } from './api';
import type { Customer, CustomerDetail } from './types';

export function listCustomers(): Promise<Customer[]> {
  return api<Customer[]>('/customers');
}

export function getCustomer(customerId: number): Promise<CustomerDetail> {
  return api<CustomerDetail>(`/customers/${customerId}`);
}

export function createCustomer(data: {
  fullName: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
}): Promise<Customer> {
  return api<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) });
}
