/**
 * BErozgar — useRestriction Hook
 *
 * Consumes server-computed restriction data from AuthContext.
 * The server computes restriction via /auth/me using trust status,
 * active disputes, and admin overrides. The client only uses
 * this data as a UX hint — the server enforces restrictions on
 * every API request independently.
 *
 * Usage:
 *   const { isRestricted, blockedActions, reasons, canPerform } = useRestriction();
 *   if (!canPerform('CREATE_LISTING')) { ... }
 */

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  isActionBlocked,
  type RestrictionResult,
  type RestrictableAction,
} from '@/domain/restrictionEngine';

interface UseRestrictionReturn extends RestrictionResult {
  /** Convenience: returns true if the given action is allowed */
  canPerform: (action: RestrictableAction) => boolean;
}

const UNRESTRICTED: RestrictionResult = {
  isRestricted: false,
  blockedActions: [],
  reasons: [],
};

export function useRestriction(): UseRestrictionReturn {
  const { restriction, user } = useAuth();

  const result = useMemo<RestrictionResult>(() => {
    // No user or admin → never restricted
    if (!user || user.role === 'admin') {
      return UNRESTRICTED;
    }

    // Use server-computed restriction data from /auth/me
    if (restriction) {
      return restriction;
    }

    // Fallback: not yet loaded from server — assume unrestricted
    return UNRESTRICTED;
  }, [user, restriction]);

  const canPerform = useMemo(
    () => (action: RestrictableAction) => !isActionBlocked(result, action),
    [result],
  );

  return { ...result, canPerform };
}
