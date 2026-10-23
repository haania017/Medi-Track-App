import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { setUnauthorizedHandler } from '../lib/api';

const AuthContext = createContext(null);

const ME_KEY = ['auth', 'me'];

export function AuthProvider({ children }) {
  const client = useQueryClient();

  const meQuery = useQuery({
    queryKey: ME_KEY,
    queryFn: () => api.data('/auth/me'),
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });

  // The session cookie expired or was revoked server-side.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      client.setQueryData(ME_KEY, null);
    });
  }, [client]);

  const loginMutation = useMutation({
    mutationFn: (credentials) => api.post('/auth/login', credentials),
    onSuccess: (payload) => {
      client.setQueryData(ME_KEY, { user: payload.data.user });
      client.invalidateQueries({ queryKey: ['workspace'] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (payload) => api.post('/auth/register', payload),
    onSuccess: (payload) => {
      client.setQueryData(ME_KEY, { user: payload.data.user });
      client.invalidateQueries({ queryKey: ['workspace'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      client.setQueryData(ME_KEY, null);
      client.clear();
    },
  });

  const setUser = useCallback(
    (user) => {
      client.setQueryData(ME_KEY, user ? { user } : null);
    },
    [client],
  );

  const refresh = useCallback(async () => {
    const result = await meQuery.refetch();
    return result.data?.user ?? null;
  }, [meQuery]);

  const value = useMemo(
    () => ({
      user: meQuery.data?.user ?? null,
      isLoading: meQuery.isLoading,
      isError: meQuery.isError,
      isAuthenticated: Boolean(meQuery.data?.user),
      login: loginMutation.mutateAsync,
      register: registerMutation.mutateAsync,
      logout: logoutMutation.mutateAsync,
      isLoggingIn: loginMutation.isPending,
      isRegistering: registerMutation.isPending,
      loginError: loginMutation.error,
      registerError: registerMutation.error,
      setUser,
      refresh,
    }),
    [
      meQuery.data,
      meQuery.isLoading,
      meQuery.isError,
      loginMutation.mutateAsync,
      loginMutation.isPending,
      loginMutation.error,
      registerMutation.mutateAsync,
      registerMutation.isPending,
      registerMutation.error,
      logoutMutation.mutateAsync,
      setUser,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}

export default AuthProvider;
