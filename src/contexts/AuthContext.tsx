import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { sessionManager } from '@/lib/session';
import api from '@/lib/api-client';
import { setCsrfToken, clearCsrfToken } from '@/lib/api-client';
import { identifyUser, clearUser as clearMonitoringUser } from '@/lib/monitoring';
import type { RestrictionResult } from '@/domain/restrictionEngine';

/* ─── Types ─── */

export type UserRole = 'student' | 'admin';

/**
 * Internal privilege tiers for the unified admin role.
 * SUPER     — full system control
 * REVIEWER  — moderation, drilldowns, approvals (default)
 * OBSERVER  — read-only observatory view (formerly "faculty")
 */
export type AdminPrivilegeLevel = 'SUPER' | 'REVIEWER' | 'OBSERVER';

/** Authentication provider that created this account */
export type AuthProvider = 'GOOGLE' | 'EMAIL';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  verified: boolean;
  /** How the user authenticated (Google OAuth or email/password) */
  provider: AuthProvider;
  /**
   * Only present when role === 'admin'.
   * Determines what the admin can do — not who they are.
   */
  privilegeLevel?: AdminPrivilegeLevel;
}

/** Server-computed trust status returned by /auth/me */
export interface TrustData {
  status: string;
  reasons: string[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** True once session validation completes — prevents premature redirects */
  isHydrated: boolean;
  /** Server-computed trust data from /auth/me (students) */
  trust: TrustData | null;
  /** Server-computed restriction data from /auth/me (students) */
  restriction: RestrictionResult | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (fullName: string, email: string, password: string) => Promise<void>;
  verifyOtp: (otp: string) => Promise<void>;
  googleSignIn: (credential: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

/* ─── Pending signup (pre-verification) ─── */

const PENDING_KEY = 'berozgar_pending';

interface PendingUser {
  fullName: string;
  email: string;
  password: string;
}

function savePending(data: PendingUser) {
  // Use sessionStorage (not localStorage) — clears on tab close, not persistent,
  // not accessible from other tabs. Needed to carry password to OTP step.
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(data));
}

function loadPending(): PendingUser | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearPending() {
  sessionStorage.removeItem(PENDING_KEY);
}

/* ─── Provider ─── */

/** Response shape of GET /auth/me */
interface AuthMeResponse {
  user: User;
  trust: TrustData;
  restriction: RestrictionResult;
}

const INITIAL_STATE: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isHydrated: false,
  trust: null,
  restriction: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);
  const hydrationRef = useRef(false);

  // Initialize session manager (multi-tab sync, token refresh)
  useEffect(() => {
    sessionManager.init();
    return () => sessionManager.destroy();
  }, []);

  /**
   * Hydration: validate session via GET /auth/me on mount.
   * If no stored user → immediately hydrate as unauthenticated.
   * If stored user exists → call /auth/me (refresh cookie sent automatically).
   */
  useEffect(() => {
    if (hydrationRef.current) return;
    hydrationRef.current = true;

    const hasStoredUser = !!sessionManager.getUser();

    if (!hasStoredUser) {
      // No existing session — set hydrated
      setState({ ...INITIAL_STATE, isHydrated: true });
      return;
    }

    // Validate the session server-side
    const controller = new AbortController();
    (async () => {
      try {
        const response = await api.get<AuthMeResponse>('/auth/me', { signal: controller.signal });
        const { user, trust, restriction } = response;

        // Update sessionManager's user data with server truth
        sessionManager.setUser(user);
        identifyUser({ id: user.id, email: user.email, role: user.role });

        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          isHydrated: true,
          trust,
          restriction,
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        // Session invalid — clear everything
        sessionManager.clearSession();
        clearCsrfToken();
        clearMonitoringUser();
        setState({ ...INITIAL_STATE, isHydrated: true });
      }
    })();
    return () => controller.abort();
  }, []);

  // Listen for session events (multi-tab sync, token refresh, etc.)
  useEffect(() => {
    const unsubscribe = sessionManager.subscribe((event, user) => {
      if (event === 'login') {
        setState((prev) => ({
          ...prev,
          user: user,
          isAuthenticated: !!user,
          isLoading: false,
          isHydrated: true,
        }));
      } else if (event === 'logout' || event === 'session-expired') {
        // AUTH-RACE-02: clear CSRF token and monitoring identity when another
        // tab logs out or when the token expiry fires — not just on user-initiated logout.
        clearCsrfToken();
        clearMonitoringUser();
        setState({
          ...INITIAL_STATE,
          isHydrated: true,
        });
      } else if (event === 'token-refresh') {
        // AUTH-SESSION-02: proactively refresh the access token before expiry.
        // SessionManager emits this event ~60s before the JWT expires.
        // Without this handler the token would silently expire, causing the
        // next API call to trigger a 401 → handleTokenRefresh → flash of error.
        api.post<{ accessToken: string }>('/auth/refresh', undefined, { skipAuth: true })
          .then((res) => {
            sessionManager.setTokens(res.accessToken);
          })
          .catch(() => {
            // Refresh cookie expired or revoked — full logout
            sessionManager.clearSession();
            clearCsrfToken();
            clearMonitoringUser();
            setState({ ...INITIAL_STATE, isHydrated: true });
          });
      }
    });

    return unsubscribe;
  }, []);


  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await api.post<{
        user: User;
        accessToken: string;
        csrfToken?: string;
      }>('/auth/login', { email, password }, { skipAuth: true });

      // Access token in memory; refresh token is httpOnly cookie set by server
      sessionManager.login(response.user, response.accessToken);
      if (response.csrfToken) setCsrfToken(response.csrfToken);
      identifyUser({ id: response.user.id, email: response.user.email, role: response.user.role });
      clearPending();

      // Fetch trust/restriction from /auth/me now that we have a valid session
      let trust: TrustData | null = null;
      let restriction: RestrictionResult | null = null;
      try {
        const me = await api.get<AuthMeResponse>('/auth/me');
        trust = me.trust;
        restriction = me.restriction;
      } catch {
        // Non-fatal — trust/restriction will be null until next refresh
      }

      setState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        isHydrated: true,
        trust,
        restriction,
      });
    } catch (err) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw err;
    }
  }, []);

  const signup = useCallback(async (fullName: string, email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      await api.post('/auth/signup', { fullName, email, password }, { skipAuth: true });
      // Save pending data for OTP verification step (sessionStorage only — clears on tab close)
      savePending({ fullName, email, password });
      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (err) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw err;
    }
  }, []);

  const verifyOtp = useCallback(async (otp: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const pending = loadPending();
      if (!pending) throw new Error('No pending registration found');

      const response = await api.post<{
        user: User;
        accessToken: string;
        csrfToken?: string;
      }>('/auth/verify-otp', {
        email: pending.email,
        fullName: pending.fullName,
        password: pending.password,
        otp,
      }, { skipAuth: true });

      clearPending();
      sessionManager.login(response.user, response.accessToken);
      if (response.csrfToken) setCsrfToken(response.csrfToken);
      identifyUser({ id: response.user.id, email: response.user.email, role: response.user.role });

      // Fresh account — trust/restriction will be default
      setState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        isHydrated: true,
        trust: { status: 'GOOD_STANDING', reasons: [] },
        restriction: { isRestricted: false, blockedActions: [], reasons: [] },
      });
    } catch (err) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    // Fire-and-forget server logout
    api.post('/auth/logout', undefined, { skipAuth: true }).catch(() => { });
    sessionManager.clearSession();
    clearCsrfToken();
    clearMonitoringUser();
    clearPending();
    setState({ ...INITIAL_STATE, isHydrated: true });
  }, []);

  const googleSignIn = useCallback(async (credential: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await api.post<{
        user: User;
        accessToken: string;
        csrfToken?: string;
        isNewUser?: boolean;
      }>('/auth/google', { credential }, { skipAuth: true });

      sessionManager.login(response.user, response.accessToken);
      if (response.csrfToken) setCsrfToken(response.csrfToken);
      identifyUser({ id: response.user.id, email: response.user.email, role: response.user.role });
      clearPending();

      // Fetch trust/restriction from /auth/me
      let trust: TrustData | null = null;
      let restriction: RestrictionResult | null = null;
      try {
        const me = await api.get<AuthMeResponse>('/auth/me');
        trust = me.trust;
        restriction = me.restriction;
      } catch {
        // Non-fatal
      }

      setState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        isHydrated: true,
        trust,
        restriction,
      });
    } catch (err) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw err;
    }
  }, []);

  const contextValue = useMemo<AuthContextType>(
    () => ({ ...state, login, signup, verifyOtp, googleSignIn, logout }),
    [state, login, signup, verifyOtp, googleSignIn, logout],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/* ─── Hook ─── */

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
