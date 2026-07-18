'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  apiCurrentUser,
  ApiError,
  clearAccessToken,
  logoutSession,
  refreshAccessToken,
  signInAdmin,
} from '@/lib/api-client';
import type { AdminCredentials, CurrentUser } from '@/lib/api-types';
import { hasPermission } from '@/lib/permissions';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface LoginInput extends AdminCredentials {
  mfaCode?: string;
}

interface AuthContextValue {
  can: (permission?: string) => boolean;
  error: ApiError | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<CurrentUser | null>;
  status: AuthStatus;
  user: CurrentUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const markUnauthenticated = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const refreshSession = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      await refreshAccessToken();
      const currentUser = await apiCurrentUser({ retryAuth: false });
      setUser(currentUser);
      setStatus('authenticated');
      return currentUser;
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        markUnauthenticated();
        return null;
      }

      clearAccessToken();
      setUser(null);
      const apiError =
        caught instanceof ApiError
          ? caught
          : new ApiError(0, 'SESSION_ERROR', 'The session could not be verified.');
      setError(apiError);
      setStatus('error');
      return null;
    }
  }, [markUnauthenticated]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshSession(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshSession]);

  const login = useCallback(async (input: LoginInput) => {
    setError(null);

    try {
      await signInAdmin(input);
      const currentUser = await apiCurrentUser({ retryAuth: false });
      setUser(currentUser);
      setStatus('authenticated');
    } catch (caught) {
      clearAccessToken();
      setUser(null);
      setStatus('unauthenticated');
      throw caught;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutSession();
    } finally {
      setUser(null);
      setStatus('unauthenticated');
      queryClient.clear();
      router.replace('/login');
      router.refresh();
    }
  }, [queryClient, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      can: (permission) => hasPermission(user, permission),
      error,
      login,
      logout,
      refreshSession,
      status,
      user,
    }),
    [error, login, logout, refreshSession, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
