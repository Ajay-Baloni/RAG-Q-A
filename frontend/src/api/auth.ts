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

export function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch<{ message: string }>('/api/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}

export function forgotPassword(email: string) {
  return apiFetch<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

export function resetPassword(token: string, newPassword: string) {
  return apiFetch<{ message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword },
  });
}
