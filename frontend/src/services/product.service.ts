import { api } from './api';
import type { Product, ProductStatus } from './types';

export function listProducts(status?: ProductStatus): Promise<Product[]> {
  const query = status ? `?status=${status}` : '';
  return api<Product[]>(`/products${query}`);
}

export function discontinueProduct(productId: number): Promise<Product> {
  return api<Product>(`/products/${productId}/discontinue`, { method: 'PATCH' });
}

export function createProduct(data: {
  name: string;
  category: string;
  brand?: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
}): Promise<Product> {
  return api<Product>('/products', { method: 'POST', body: JSON.stringify(data) });
}

export function restockProduct(productId: number, quantity: number): Promise<Product> {
  return api<Product>(`/products/${productId}/restock`, {
    method: 'POST',
    body: JSON.stringify({ quantity }),
  });
}
