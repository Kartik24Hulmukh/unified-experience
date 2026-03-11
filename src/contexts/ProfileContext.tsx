/**
 * BErozgar — Profile Context
 *
 * Injects profile data globally. Consumes AuthContext for identity.
 * No UI elements — logic and state only.
 */

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api-client';
import type { Profile } from '@/domain/profile';
import logger from '@/lib/logger';
import { validateProfileRoleIntegrity, isAdminProfile } from '@/domain/profile';

/* ═══════════════════════════════════════════════════
   Context Types
   ═══════════════════════════════════════════════════ */

interface ProfileState {
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
}

interface ProfileContextType extends ProfileState {
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

/* ═══════════════════════════════════════════════════
   Provider
   ═══════════════════════════════════════════════════ */

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  // React Query: automatic caching, deduplication across tabs, and stale-while-revalidate.
  // MED-03 FIX: queryKey scoped to user?.id (stable primitive) prevents re-fetches
  // caused by new object references from token-refresh events in AuthContext.
  const {
    data: profile = null,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const response = await api.get<{ data: Profile }>('/profile');
      const p = response.data;

      if (!validateProfileRoleIntegrity(p)) {
        throw new Error('Role mismatch detected. Profile data withheld for safety.');
      }

      // MED-01 FIX: trust is server-authoritative; never derive it client-side.
      // A frontend copy of computeTrust() can silently diverge from the backend
      // version across deployments. Use the API response as-is.
      if (!isAdminProfile(p) && !p.trust) {
        logger.warn('ProfileContext', 'Profile arrived without trust data — displaying without enrichment');
      }

      return p;
    },
    enabled: isAuthenticated && !!user,
    staleTime: 5 * 60 * 1000,   // 5 min: avoids redundant fetches on rapid navigation
    gcTime: 10 * 60 * 1000,      // 10 min: keep cache warm across route switches
    retry: false,
  });

  const error = queryError
    ? (queryError instanceof Error ? queryError.message : 'Failed to load profile')
    : null;

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const contextValue = useMemo(
    () => ({ profile, isLoading, error, refreshProfile: handleRefresh }),
    [profile, isLoading, error, handleRefresh],
  );

  return (
    <ProfileContext.Provider value={contextValue}>
      {children}
    </ProfileContext.Provider>
  );
}

/* ═══════════════════════════════════════════════════
   Hook
   ═══════════════════════════════════════════════════ */

// eslint-disable-next-line react-refresh/only-export-components -- hook intentionally co-located with context provider
export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
