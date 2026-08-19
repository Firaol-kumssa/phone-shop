import { api } from './api';
import type { LoginResponse, RegisterUserPayload, StaffUser } from './types';

export function login(username: string, password: string): Promise<LoginResponse> {
  return api<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function listUsers(): Promise<StaffUser[]> {
  return api<StaffUser[]>('/auth/users');
}

export function registerUser(payload: RegisterUserPayload): Promise<StaffUser> {
  return api<StaffUser>('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
}

export function deactivateUser(userId: number): Promise<StaffUser> {
  return api<StaffUser>(`/auth/users/${userId}/deactivate`, { method: 'PATCH' });
}
