import { apiPost, apiGet } from './api-client';

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
}

export interface LoginResponse {
  user: User;
  hasIntegrations: boolean;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/api/auth/login', { email, password });
}

export async function register(email: string, password: string): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/api/auth/register', { email, password });
}

export async function logout(): Promise<void> {
  return apiPost<void>('/api/auth/logout');
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/api/auth/forgot-password', { email });
}

export async function resetPassword(
  token: string,
  password: string
): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/api/auth/reset-password', { token, password });
}

export async function verifyEmail(token: string): Promise<{ user: User }> {
  return apiPost<{ user: User }>('/api/auth/verify-email', { token });
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    return await apiGet<User>('/api/auth/me');
  } catch {
    return null;
  }
}
