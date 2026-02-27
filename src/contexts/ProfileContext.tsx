/**
 * BErozgar — Profile Context
 *
 * Injects profile data globally. Consumes AuthContext for identity.
 * No UI elements — logic and state only.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api-client';
import type { Profile } from '@/domain/profile';
import logger from '@/lib/logger';
import { validateProfileRoleIntegrity, isStudentProfile } from '@/domain/profile';
import { computeTrust } from '@/domain/trustEngine';

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
   Trust Derivation (students only)
   ═══════════════════════════════════════════════════ */

/**
 * Enriches student profiles if necessary.
 * Trust is already computed on the backend for /profile and /auth/me,
 * but this serves as a safety net if a legacy path is used.
 */
function enrichProfile(profile: Profile): Profile {
  if (!isStudentProfile(profile)) return profile;

  // If trust is missing (shouldn't happen with new API), we use the data in the profile
  if (!profile.trust) {
    profile.trust = computeTrust({
      completedExchanges: profile.data.exchangesCompleted,
      cancelledRequests: profile.data.cancelledRequests,
      disputes: profile.data.disputesCount,
      adminFlags: profile.data.adminFlags,
      accountAgeDays: Math.floor(
        (Date.now() - new Date(profile.identity.joinedAt).getTime()) / 86_400_000,
      ),
    });
  }

  return profile;
}

/* ═══════════════════════════════════════════════════
   Provider
   ═══════════════════════════════════════════════════ */

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  const [state, setState] = useState<ProfileState>({
    profile: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setState({ profile: null, isLoading: false, error: null });
      return;
    }

    let cancelled = false;

    const load = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await api.get<{ data: Profile }>('/profile');
        const profile = response.data;

        if (cancelled) return;

        if (!validateProfileRoleIntegrity(profile)) {
          setState({
            profile: null,
            isLoading: false,
            error: 'Role mismatch detected. Profile data withheld for safety.',
          });
          return;
        }

        const enriched = enrichProfile(profile);
        setState({ profile: enriched, isLoading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load profile';
        logger.error('ProfileContext', message);
        setState({ profile: null, isLoading: false, error: message });
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user, isAuthenticated]);

  const handleRefresh = useCallback(async () => {
    if (!user) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await api.get<{ data: Profile }>('/profile');
      const profile = response.data;

      if (!validateProfileRoleIntegrity(profile)) {
        setState({
          profile: null,
          isLoading: false,
          error: 'Role mismatch detected. Profile data withheld for safety.',
        });
        return;
      }

      const enriched = enrichProfile(profile);
      setState({ profile: enriched, isLoading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh profile';
      logger.error('ProfileContext', message);
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
    }
  }, [user]);

  const contextValue = useMemo(
    () => ({ ...state, refreshProfile: handleRefresh }),
    [state, handleRefresh],
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

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
