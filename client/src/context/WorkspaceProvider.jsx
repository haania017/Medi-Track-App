import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from './AuthProvider';

const WorkspaceContext = createContext(null);

const STORAGE_KEY = 'meditrack.activeProfileId';

export function WorkspaceProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const client = useQueryClient();
  const [activeProfileId, setActiveProfileIdState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || null,
  );

  const workspaceQuery = useQuery({
    queryKey: ['workspace'],
    queryFn: () => api.data('/users/me/workspace'),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  const profiles = useMemo(() => workspaceQuery.data?.profiles ?? [], [workspaceQuery.data]);

  // Keep the stored profile id valid as the family changes.
  useEffect(() => {
    if (!profiles.length) return;
    const exists = profiles.some((p) => p.id === activeProfileId);
    if (!exists) {
      const own = workspaceQuery.data?.activeProfile?.id || profiles[0].id;
      setActiveProfileIdState(own);
      localStorage.setItem(STORAGE_KEY, own);
    }
  }, [profiles, activeProfileId, workspaceQuery.data]);

  const setActiveProfileId = useCallback((id) => {
    setActiveProfileIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
    client.invalidateQueries();
  }, [client]);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) || workspaceQuery.data?.activeProfile || profiles[0] || null,
    [profiles, activeProfileId, workspaceQuery.data],
  );

  const value = useMemo(
    () => ({
      workspace: workspaceQuery.data ?? null,
      family: workspaceQuery.data?.family ?? null,
      profiles,
      activeProfile,
      activeProfileId: activeProfile?.id ?? null,
      setActiveProfileId,
      isLoading: workspaceQuery.isLoading,
      isError: workspaceQuery.isError,
      error: workspaceQuery.error,
      refetch: workspaceQuery.refetch,
    }),
    [workspaceQuery.data, workspaceQuery.isLoading, workspaceQuery.isError, workspaceQuery.error, workspaceQuery.refetch, profiles, activeProfile, setActiveProfileId],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside a WorkspaceProvider');
  return ctx;
}

export default WorkspaceProvider;
