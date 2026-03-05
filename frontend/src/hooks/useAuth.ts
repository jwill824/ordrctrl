'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/services/auth.service';
import * as authService from '@/services/auth.service';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface UseAuthReturn extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<boolean>;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  // Fetch current user on mount
  useEffect(() => {
    authService.getCurrentUser().then((user) => {
      setState({ user, loading: false, error: null });
    });
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { user, hasIntegrations } = await authService.login(email, password);
        setState({ user, loading: false, error: null });
        router.push(hasIntegrations ? '/feed' : '/onboarding');
        return true;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Login failed';
        setState((prev) => ({ ...prev, loading: false, error: message }));
        return false;
      }
    },
    [router]
  );

  const logout = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      await authService.logout();
      setState({ user: null, loading: false, error: null });
      router.push('/login');
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [router]);

  const register = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        await authService.register(email, password);
        setState((prev) => ({ ...prev, loading: false }));
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        setState((prev) => ({ ...prev, loading: false, error: message }));
        return false;
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return { ...state, login, logout, register, clearError };
}
