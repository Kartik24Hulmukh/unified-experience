import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { sessionManager } from '@/lib/session';
import api, { handleTokenRefresh } from '@/lib/api-client';
import { setCsrfToken, clearCsrfToken } from '@/lib/api-client';
import { identifyUser, clearUser as clearMonitoringUser } from '@/lib/monitoring';
import { toast } from '@/components/ui/use-toast';
import type { RestrictionResult } from '@/domain/restrictionEngine';

/* ─── Types ─── */

export type UserRole = 'student_verified' | 'public_user' | 'admin';

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
  /** Whether user's email is linked to college registry */
  collegeLinked?: boolean;
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
  login: (email: string, password: string) => Promise<User>;
  signup: (fullName: string, email: string, password: string) => Promise<void>;
  verifyOtp: (otp: string) => Promise<User>;
  googleSignIn: (credential: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

/* ─── Pending signup (pre-verification) ─── */

const PENDING_KEY = 'berozgar_pending';

// CRIT-04 FIX: password is excluded from the persisted shape — passwords must
// never be written to any browser storage (sessionStorage is still reachable
// by same-origin XSS). The password is held in AuthProvider's pendingPasswordRef
// (in-memory only) and cleared immediately after verifyOtp succeeds.
interface PendingUser {
  fullName: string;
  email: string;
}

function savePending(data: PendingUser) {
  // Use sessionStorage (not localStorage) — clears on tab close, not persistent,
  // not accessible from other tabs. Carries non-sensitive data to the OTP step.
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

function normalizeUserRole(role: string | undefined): UserRole {
  const lower = role?.toLowerCase();
  if (lower === 'admin') return 'admin';
  if (lower === 'student_verified') return 'student_verified';
  return 'public_user';
}

function normalizePrivilegeLevel(level: string | undefined): AdminPrivilegeLevel | undefined {
  if (!level) return undefined;
  const upper = level.toUpperCase();
  if (upper === 'SUPER' || upper === 'REVIEWER' || upper === 'OBSERVER') return upper;
  return undefined;
}

function normalizeUser(user: User): User {
  return {
    ...user,
    role: normalizeUserRole(user.role),
    privilegeLevel: normalizePrivilegeLevel(user.privilegeLevel as string | undefined),
  };
}

const INITIAL_STATE: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isHydrated: false,
  trust: null,
  restriction: null,
};

const getInitialState = (): AuthState => {
  return { ...INITIAL_STATE };
};

const LOGOUT_REDIRECT_KEY = 'berozgar_post_logout_redirect';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(getInitialState);
  const hydrationRef = useRef(false);
  // CRIT-04 FIX: hold the pending signup password in memory only.
  // It is set in signup() and cleared in verifyOtp() / logout().
  const pendingPasswordRef = useRef<string | null>(null);
  // Auto-clear after OTP_EXPIRES_MINUTES (10 min) so the password doesn't
  // stay in memory indefinitely if the user abandons the flow.
  const pendingPasswordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    console.log('[AuthContext] Starting hydration...');
    const storedUser = sessionManager.getUser();
    console.log('[AuthContext] Stored user exists:', !!storedUser);

    if (!storedUser) {
      console.log('[AuthContext] No stored user, marked hydrated.');
      setState({ ...INITIAL_STATE, isHydrated: true });
      return;
    }

    // Validate the session server-side
    // AUTH-MULTITAB-01: When a new tab opens, the in-memory access token is gone
    // (tokens are not persisted to localStorage for XSS safety). We must call
    // /auth/refresh first using the httpOnly refresh cookie (sent automatically)
    // to obtain a fresh access token, then call /auth/me to hydrate the session.
    // Without this step, /auth/me would receive no Bearer token → 401 → spurious logout.
    (async () => {
      try {
        // LOW-01 FIX: explicit aggressive timeout for hydration to prevent blank UI hangs on cold starts/dropped connections
        // Increased from 5s to 15s to allow for local dev cold starts
        const HYDRATION_TIMEOUT = 30000;

        // Step 1: If no in-memory access token, try to refresh first
        if (!sessionManager.getAccessToken()) {
          console.log('[AuthContext] No access token, calling /auth/refresh...');
          try {
            const accessToken = await handleTokenRefresh();
            console.log('[AuthContext] /auth/refresh succeeded.');
            sessionManager.setTokens(accessToken);
          } catch (err) {
            console.log('[AuthContext] /auth/refresh FAILED:', err);
            sessionManager.clearSession();
            clearCsrfToken();
            clearMonitoringUser();
            setState({ ...INITIAL_STATE, isHydrated: true });
            return;
          }
        }
        console.log('[AuthContext] Calling /auth/me...');
        const response = await api.get<AuthMeResponse>('/auth/me', { 
          timeout: HYDRATION_TIMEOUT 
        });
        console.log('[AuthContext] /auth/me succeeded.');
        const user = normalizeUser(response.user);
        const { trust, restriction } = response;

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
        // Session invalid — clear everything
        sessionManager.clearSession();
        clearCsrfToken();
        clearMonitoringUser();
        setState({ ...INITIAL_STATE, isHydrated: true });
      }
    })();
  }, []);

  // Listen for session events (multi-tab sync, token refresh, etc.)
  useEffect(() => {
    const unsubscribe = sessionManager.subscribe((event, user) => {
      if (event === 'login') {
        try {
          localStorage.removeItem(LOGOUT_REDIRECT_KEY);
        } catch {
          // Best effort
        }
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
        try {
          localStorage.setItem(LOGOUT_REDIRECT_KEY, String(Date.now()));
        } catch {
          // Best effort
        }
        setState({
          ...INITIAL_STATE,
          isHydrated: true,
        });
      } else if (event === 'token-refresh') {
        // AUTH-SESSION-02: proactively refresh the access token before expiry.
        // SessionManager emits this event ~60s before the JWT expires.
        // CRIT-03 FIX: route through handleTokenRefresh() so this proactive call
        // shares the isRefreshing mutex with any concurrent 401-triggered refresh.
        // Previously, calling api.post() directly bypassed the mutex, allowing two
        // simultaneous refresh requests which could invalidate each other's tokens.
        handleTokenRefresh().then(() => {
          // M3-FIX: after proactive refresh success, re-fetch trust/restriction
          // so admin-applied restrictions take effect without a full page reload.
          api.get<AuthMeResponse>('/auth/me').then((me) => {
            const user = normalizeUser(me.user);
            sessionManager.setUser(user);
            setState((prev) => ({
              ...prev,
              user,
              trust: me.trust,
              restriction: me.restriction,
            }));
          }).catch(() => { /* non-fatal: trust stays stale until next navigation */ });
        }).catch(() => {
          // handleTokenRefresh() has already called clearSession() — just sync React state
          clearCsrfToken();
          clearMonitoringUser();
          setState({ ...INITIAL_STATE, isHydrated: true });
          // MED-SESSION FIX: notify the user that their session expired so they
          // aren't silently logged out while actively using the app.
          toast({
            title: 'Session Expired',
            description: 'Your session has expired. Please log in again to continue.',
            variant: 'destructive',
          });
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
      const user = normalizeUser(response.user);

      sessionManager.login(user, response.accessToken);
      if (response.csrfToken) setCsrfToken(response.csrfToken);
      identifyUser({ id: user.id, email: user.email, role: user.role });
      try {
        localStorage.removeItem(LOGOUT_REDIRECT_KEY);
      } catch {
        // Best effort
      }
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
        user,
        isAuthenticated: true,
        isLoading: false,
        isHydrated: true,
        trust,
        restriction,
      });

      return user;
    } catch (err) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw err;
    }
  }, []);

  const signup = useCallback(async (fullName: string, email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      await api.post('/auth/signup', { fullName, email, password }, { skipAuth: true });
      // CRIT-04 FIX: persist only non-sensitive data; hold password in-memory.
      pendingPasswordRef.current = password;
      // Auto-clear password after 10 minutes (matches OTP expiry)
      if (pendingPasswordTimerRef.current) clearTimeout(pendingPasswordTimerRef.current);
      pendingPasswordTimerRef.current = setTimeout(() => {
        pendingPasswordRef.current = null;
        pendingPasswordTimerRef.current = null;
      }, 10 * 60 * 1000);
      savePending({ fullName, email });
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

      // CRIT-04 FIX: read password from the in-memory ref, not from storage.
      const password = pendingPasswordRef.current;
      if (!password) throw new Error('Registration session expired. Please sign up again.');

      const response = await api.post<{
        user: User;
        accessToken: string;
        csrfToken?: string;
      }>('/auth/verify-otp', {
        email: pending.email,
        fullName: pending.fullName,
        password,
        otp,
      }, { skipAuth: true });

      pendingPasswordRef.current = null;
      if (pendingPasswordTimerRef.current) {
        clearTimeout(pendingPasswordTimerRef.current);
        pendingPasswordTimerRef.current = null;
      }
      clearPending();
      const user = normalizeUser(response.user);

      sessionManager.login(user, response.accessToken);
      if (response.csrfToken) setCsrfToken(response.csrfToken);
      identifyUser({ id: user.id, email: user.email, role: user.role });
      try {
        localStorage.removeItem(LOGOUT_REDIRECT_KEY);
      } catch {
        // Best effort
      }

      // Fresh account — trust/restriction will be default
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        isHydrated: true,
        trust: { status: 'GOOD_STANDING', reasons: [] },
        restriction: { isRestricted: false, blockedActions: [], reasons: [] },
      });

      return user;
    } catch (err) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    // Fire-and-forget server logout.
    // BUG-01 FIX: send the Bearer token so the server audit log records the
    // actor. Do NOT use skipAuth:true — with it no Authorization header was
    // sent, the server's authenticate middleware returned 401, and the
    // refresh token was never revoked in the database.
    // The /logout route no longer requires authenticate, so this works even
    // when the access token has already expired.
    api.post('/auth/logout', undefined).catch(() => { });
    try {
      localStorage.setItem(LOGOUT_REDIRECT_KEY, String(Date.now()));
    } catch {
      // Best effort
    }
    sessionManager.clearSession();
    clearCsrfToken();
    clearMonitoringUser();
    pendingPasswordRef.current = null;
    if (pendingPasswordTimerRef.current) {
      clearTimeout(pendingPasswordTimerRef.current);
      pendingPasswordTimerRef.current = null;
    }
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

      const user = normalizeUser(response.user);

      sessionManager.login(user, response.accessToken);
      if (response.csrfToken) setCsrfToken(response.csrfToken);
      identifyUser({ id: user.id, email: user.email, role: user.role });
      try {
        localStorage.removeItem(LOGOUT_REDIRECT_KEY);
      } catch {
        // Best effort
      }
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
        user,
        isAuthenticated: true,
        isLoading: false,
        isHydrated: true,
        trust,
        restriction,
      });

      return user;
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

// eslint-disable-next-line react-refresh/only-export-components -- hook intentionally co-located with context provider
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
