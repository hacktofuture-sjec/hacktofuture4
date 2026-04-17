/* eslint-disable react-refresh/only-export-components */
/**
 * Auth context — owns tokens, profile, and the login/register/logout flow.
 *
 * On mount it optimistically loads `/auth/me/` if a stored token exists, so
 * reloads don't bounce the user to /login.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, type LoginPayload, type RegisterPayload } from '../api/auth';
import { ApiRequestError, extractError, parseDrfFieldErrors, tokenStore } from '../api/client';
import type { UserProfile } from '../api/types';

interface AuthContextValue {
  user: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(!!tokenStore.getAccess());

  const refreshProfile = useCallback(async () => {
    if (!tokenStore.getAccess()) {
      setUser(null);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      // Interceptor already handled refresh; if we still fail, clear state.
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refreshProfile();
      setLoading(false);
    })();
  }, [refreshProfile]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      try {
        const tokens = await authApi.login(payload);
        tokenStore.set(tokens.access, tokens.refresh);
        await refreshProfile();
      } catch (err) {
        throw new ApiRequestError(extractError(err), parseDrfFieldErrors(err));
      }
    },
    [refreshProfile]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      try {
        const res = await authApi.register(payload);
        tokenStore.set(res.access, res.refresh);
        await refreshProfile();
      } catch (err) {
        throw new ApiRequestError(extractError(err), parseDrfFieldErrors(err));
      }
    },
    [refreshProfile]
  );

  const logout = useCallback(async () => {
    const refresh = tokenStore.getRefresh();
    try {
      if (refresh) await authApi.logout(refresh);
    } catch {
      // server-side blacklist isn't critical for UX
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      loading,
      login,
      register,
      logout,
      refreshProfile,
    }),
    [user, loading, login, register, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
