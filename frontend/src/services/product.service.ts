import { api } from './api';
import type { Product } from './types';

export function listProducts(): Promise<Product[]> {
  return api<Product[]>('/products');
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
