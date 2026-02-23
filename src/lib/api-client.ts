/**
 * BErozgar — API Client
 *
 * Thin fetch wrapper with:
 * - Automatic Authorization header injection
 * - Response normalization (JSON parsing + error extraction)
 * - Typed error discrimination (ApiError class)
 * - Token refresh on 401
 * - Request timeout
 * - Configurable base URL
 *
 * ALL network requests go through this layer — never call fetch() directly.
 */

import { sessionManager } from '@/lib/session';
import logger from '@/lib/logger';
import { env } from '@/lib/env';

/* ═══════════════════════════════════════════════════
   CSRF Token Storage (in-memory, per-session)
   ═══════════════════════════════════════════════════ */

let csrfToken: string | null = null;

/** Store CSRF token received from login/verify-otp/csrf endpoint */
export function setCsrfToken(token: string) {
  csrfToken = token;
}

/** Clear CSRF token (on logout) */
export function clearCsrfToken() {
  csrfToken = null;
}

/** Get current CSRF token */
export function getCsrfToken(): string | null {
  return csrfToken;
}

/* ═══════════════════════════════════════════════════
   Configuration
   ═══════════════════════════════════════════════════ */

const API_BASE_URL = env.VITE_API_BASE_URL;
const REQUEST_TIMEOUT = env.VITE_API_TIMEOUT_MS;

/* ═══════════════════════════════════════════════════
   Error Model
   ═══════════════════════════════════════════════════ */

export type ApiErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly retryable: boolean;

  constructor(
    message: string,
    code: ApiErrorCode,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.retryable = status >= 500 || code === 'NETWORK_ERROR' || code === 'TIMEOUT';
  }
}

function statusToCode(status: number): ApiErrorCode {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 422) return 'VALIDATION_ERROR';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER_ERROR';
  return 'UNKNOWN';
}

/* ═══════════════════════════════════════════════════
   Response Types
   ═══════════════════════════════════════════════════ */

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    perPage?: number;
    total?: number;
  };
}

/* ═══════════════════════════════════════════════════
   Core Fetch Wrapper
   ═══════════════════════════════════════════════════ */

interface RequestConfig extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip auth header (for login/signup endpoints) */
  skipAuth?: boolean;
  /** Custom timeout (ms) */
  timeout?: number;
}

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: Error) => void;
}> = [];

function processRefreshQueue(error: Error | null, token: string | null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else if (token) resolve(token);
  });
  refreshQueue = [];
}

async function handleTokenRefresh(): Promise<string> {
  if (isRefreshing) {
    // Queue concurrent requests while refresh is in-flight
    return new Promise((resolve, reject) => {
      refreshQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;

  try {
    // No need to check for a refresh token — it's an httpOnly cookie
    // sent automatically with credentials: 'include'. If there's no
    // valid cookie, the server returns 401 and we clear the session.
    if (!sessionManager.isAuthenticated()) {
      throw new ApiError('No active session', 'UNAUTHORIZED', 401);
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',  // sends httpOnly refresh cookie
    });

    if (!response.ok) {
      // Refresh failed → full logout
      sessionManager.clearSession();
      throw new ApiError('Session expired', 'UNAUTHORIZED', 401);
    }

    const data = await response.json();
    // Only store access token in memory; refresh token is in httpOnly cookie
    sessionManager.setTokens(data.accessToken);

    processRefreshQueue(null, data.accessToken);
    return data.accessToken;
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Token refresh failed');
    processRefreshQueue(error, null);
    sessionManager.clearSession();
    throw err;
  } finally {
    isRefreshing = false;
  }
}

async function request<T>(
  endpoint: string,
  config: RequestConfig = {},
): Promise<T> {
  const { body, skipAuth = false, timeout = REQUEST_TIMEOUT, ...fetchConfig } = config;

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  // Build headers
  const headers = new Headers(fetchConfig.headers);
  if (!headers.has('Content-Type') && body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (!skipAuth) {
    const token = sessionManager.getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // Attach CSRF token for state-changing requests
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
    (fetchConfig.method || 'GET').toUpperCase(),
  );
  if (isStateChanging && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  // Timeout via AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchConfig,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      credentials: 'include',
    });

    clearTimeout(timeoutId);

    // Handle 401 with token refresh (one retry)
    if (response.status === 401 && !skipAuth) {
      try {
        const newToken = await handleTokenRefresh();
        headers.set('Authorization', `Bearer ${newToken}`);

        const retryResponse = await fetch(url, {
          ...fetchConfig,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          credentials: 'include',
        });

        if (!retryResponse.ok) {
          const errorBody = await retryResponse.json().catch(() => ({}));
          throw new ApiError(
            errorBody.message || errorBody.error || retryResponse.statusText,
            statusToCode(retryResponse.status),
            retryResponse.status,
            errorBody.details,
          );
        }

        const retryData = await retryResponse.json();
        return retryData as T;
      } catch (refreshErr) {
        // Refresh failed — propagate as 401
        throw refreshErr instanceof ApiError
          ? refreshErr
          : new ApiError('Session expired', 'UNAUTHORIZED', 401);
      }
    }

    // Handle non-2xx responses
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new ApiError(
        errorBody.message || errorBody.error || response.statusText,
        statusToCode(response.status),
        response.status,
        errorBody.details,
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) throw err;

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('Request timed out', 'TIMEOUT', 0);
    }

    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new ApiError(
        'Network error — check your connection',
        'NETWORK_ERROR',
        0,
      );
    }

    logger.error('ApiClient', err instanceof Error ? err.message : 'Unknown error');
    throw new ApiError('An unexpected error occurred', 'UNKNOWN', 0);
  }
}

/* ═══════════════════════════════════════════════════
   Public API (method helpers)
   ═══════════════════════════════════════════════════ */

export const api = {
  get: <T>(endpoint: string, config?: RequestConfig) =>
    request<T>(endpoint, { ...config, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, config?: RequestConfig) =>
    request<T>(endpoint, { ...config, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, config?: RequestConfig) =>
    request<T>(endpoint, { ...config, method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown, config?: RequestConfig) =>
    request<T>(endpoint, { ...config, method: 'PATCH', body }),

  delete: <T>(endpoint: string, config?: RequestConfig) =>
    request<T>(endpoint, { ...config, method: 'DELETE' }),
} as const;

export default api;
