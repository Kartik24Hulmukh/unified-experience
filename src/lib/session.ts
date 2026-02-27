/**
 * BErozgar — Session Manager
 *
 * Handles JWT token storage, refresh logic, expiry detection,
 * auto-logout, and multi-tab synchronization via BroadcastChannel.
 *
 * Storage strategy:
 * - accessToken  → memory (not in localStorage for XSS safety)
 * - refreshToken → httpOnly Secure SameSite=Strict cookie (set by server,
 *                  sent automatically with credentials: 'include')
 * - user data    → localStorage (non-sensitive profile info)
 *
 * Multi-tab sync:
 * - BroadcastChannel 'berozgar-session' syncs login/logout across tabs
 * - Falls back to 'storage' event for older browsers
 */

import type { User } from '@/contexts/AuthContext';
import logger from '@/lib/logger';

/* ═══════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════ */

const STORAGE_KEY_USER = 'berozgar_auth';
const CHANNEL_NAME = 'berozgar-session';

/**
 * Legacy key — removed from active use. We clean it up in clearSession()
 * in case the user still has an old token stored from before the httpOnly migration.
 */
const LEGACY_REFRESH_KEY = 'berozgar_refresh_token';

/**
 * Auto-logout buffer before token expiry (ms).
 * Loaded lazily to avoid circular imports with env.ts.
 */
function getExpiryBuffer(): number {
  try {
    const raw = import.meta.env.VITE_SESSION_EXPIRY_BUFFER_MS;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
  } catch {
    return 60_000;
  }
}

/* ═══════════════════════════════════════════════════
   Token Parsing
   ═══════════════════════════════════════════════════ */

interface TokenPayload {
  sub: string;
  exp: number;
  iat: number;
  role: string;
  [key: string]: unknown;
}

function parseJwt(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token);
  if (!payload?.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

function getTokenExpiry(token: string): number | null {
  const payload = parseJwt(token);
  return payload?.exp ? payload.exp * 1000 : null;
}

/* ═══════════════════════════════════════════════════
   Session Manager Singleton
   ═══════════════════════════════════════════════════ */

type SessionEventType = 'login' | 'logout' | 'token-refresh' | 'session-expired';
type SessionListener = (event: SessionEventType, user: User | null) => void;

class SessionManager {
  private accessToken: string | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<SessionListener>();
  private initialized = false;

  /* ── Lifecycle ── */

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Restore access token isn't possible (kept in memory only).
    // On page load, if we have a refresh token, we'll need to call /auth/refresh.
    // For now, the AuthContext hydration handles re-auth via stored user data.

    // Set up multi-tab sync
    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = this.handleBroadcast;
    } catch {
      // Fallback for browsers without BroadcastChannel
      window.addEventListener('storage', this.handleStorageEvent);
    }
  }

  destroy() {
    this.clearRefreshTimer();
    this.channel?.close();
    window.removeEventListener('storage', this.handleStorageEvent);
    this.listeners.clear();
    this.initialized = false;
  }

  /* ── Event System ── */

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SessionEventType, user: User | null) {
    this.listeners.forEach((fn) => {
      try {
        fn(event, user);
      } catch (err) {
        logger.error('SessionManager', `Listener error: ${err}`);
      }
    });
  }

  /* ── Token Management ── */

  getAccessToken(): string | null {
    // If we have a token in memory and it's not expired, use it
    if (this.accessToken && !isTokenExpired(this.accessToken)) {
      return this.accessToken;
    }

    // No valid in-memory token — caller must trigger refresh or re-auth.
    // We intentionally do NOT fall back to synthetic tokens because the
    // server now verifies HMAC signatures on every request.
    return null;
  }

  /**
   * Refresh token is now stored as an httpOnly cookie by the server.
   * The browser sends it automatically via credentials: 'include'.
   * This method always returns null — kept for backward compat.
   * @deprecated Use httpOnly cookie strategy instead
   */
  getRefreshToken(): string | null {
    return null;
  }

  /**
   * Store the access token in memory. Refresh token is managed
   * server-side as an httpOnly cookie — no client storage needed.
   */
  setTokens(accessToken: string, _refreshToken?: string) {
    this.accessToken = accessToken;

    // Schedule refresh before expiry
    this.scheduleTokenRefresh(accessToken);
  }

  /* ── User Management ── */

  getUser(): User | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  setUser(user: User) {
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } catch {
      logger.error('SessionManager', 'Failed to store user data');
    }
  }

  /* ── Session Lifecycle ── */

  /**
   * Called after successful login — stores everything and broadcasts to other tabs.
   */
  /**
   * Called after successful login — stores user + access token and
   * broadcasts to other tabs. Refresh token is an httpOnly cookie
   * set by the server response, so we don't store it client-side.
   */
  login(user: User, accessToken: string, _refreshToken?: string) {
    this.setUser(user);
    this.setTokens(accessToken);
    this.broadcast('login');
    this.emit('login', user);
  }

  /**
   * Full session teardown. Clears all tokens, storage, and notifies listeners.
   */
  clearSession() {
    this.accessToken = null;
    this.clearRefreshTimer();

    try {
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(LEGACY_REFRESH_KEY);  // clean up legacy storage
      localStorage.removeItem('berozgar_pending');
    } catch {
      // Best effort
    }

    // AUTH-RACE-02: broadcast 'logout' so all tabs clear their in-memory tokens
    // and CSRF state. The AuthContext subscriber handles clearCsrfToken().
    this.broadcast('logout');
    this.emit('logout', null);
  }

  /**
   * Check if there's an active session (user data exists).
   * Does NOT validate token — call getAccessToken() for that.
   */
  isAuthenticated(): boolean {
    return this.getUser() !== null;
  }

  /* ── Token Refresh Scheduling ── */

  private scheduleTokenRefresh(token: string) {
    this.clearRefreshTimer();

    const expiry = getTokenExpiry(token);
    if (!expiry) return;

    const refreshIn = expiry - Date.now() - getExpiryBuffer();
    if (refreshIn <= 0) {
      // Already expired or about to — broadcast session-expired to all tabs
      this.broadcast('session-expired');
      this.emit('session-expired', this.getUser());
      return;
    }

    this.refreshTimer = setTimeout(() => {
      // Proactive refresh signal: emit locally so AuthContext can call /auth/refresh
      this.emit('token-refresh', this.getUser());
    }, refreshIn);
  }

  private clearRefreshTimer() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /* ── Multi-Tab Sync ── */

  private broadcast(type: 'login' | 'logout' | 'session-expired') {
    try {
      this.channel?.postMessage({ type, timestamp: Date.now() });
    } catch {
      // Fallback: storage event fires automatically when localStorage changes
    }
  }

  private handleBroadcast = (event: MessageEvent) => {
    const { type } = event.data || {};

    if (type === 'logout' || type === 'session-expired') {
      // Another tab logged out or session expired
      this.accessToken = null;
      this.clearRefreshTimer();
      this.emit('logout', null);
    } else if (type === 'login') {
      // Another tab logged in — reload user from storage
      // Note: no access token in memory here; first API call will auto-refresh
      // via the shared httpOnly refresh cookie.
      const user = this.getUser();
      if (user) {
        this.emit('login', user);
      }
    }
  };

  private handleStorageEvent = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY_USER) {
      if (event.newValue === null) {
        // Removed — logged out in another tab
        this.accessToken = null;
        this.clearRefreshTimer();
        this.emit('logout', null);
      } else {
        // Updated — logged in from another tab
        try {
          const user = JSON.parse(event.newValue) as User;
          this.emit('login', user);
        } catch {
          // Corrupt data — ignore
        }
      }
    }
  };
}

/* ═══════════════════════════════════════════════════
   Singleton Export
   ═══════════════════════════════════════════════════ */

export const sessionManager = new SessionManager();
