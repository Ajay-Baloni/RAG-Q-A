import { apiFetch } from '../lib/apiClient';
import type { User } from '../types';

interface AuthResponse {
  token: string;
  user: User;
}

export function register(email: string, password: string) {
  return apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: { email, password },
  });
}

export function login(email: string, password: string) {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function fetchMe() {
  return apiFetch<{ user: User }>('/api/auth/me');
}
