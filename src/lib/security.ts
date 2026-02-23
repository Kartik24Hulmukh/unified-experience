/**
 * BErozgar — Security Utilities
 *
 * Server-side (mock API) sanitization, rate limiting, and CSRF protection.
 * These run inside the mock API layer and simulate real backend security.
 *
 * When migrating to a real backend, translate these to middleware/interceptors.
 */

/* ═══════════════════════════════════════════════════
   Input Sanitization
   ═══════════════════════════════════════════════════ */

/** HTML tag regex — matches opening/closing tags and self-closing */
const HTML_TAG_RE = /<\/?[a-z][\s\S]*?>/gi;

/** Script-related patterns */
const SCRIPT_PATTERNS = [
  /javascript\s*:/gi,
  /on\w+\s*=/gi,                    // onclick=, onerror=, etc.
  /data\s*:\s*text\/html/gi,        // data:text/html
  /expression\s*\(/gi,              // CSS expression()
  /url\s*\(\s*['"]?\s*javascript/gi, // url(javascript:...)
];

/**
 * Sanitize a string by stripping HTML tags and dangerous patterns.
 * Does NOT escape — strips. Safe for storage and re-display.
 */
export function sanitizeString(input: string): string {
  let result = input;

  // Strip HTML tags
  result = result.replace(HTML_TAG_RE, '');

  // Strip script injection patterns
  for (const pattern of SCRIPT_PATTERNS) {
    result = result.replace(pattern, '');
  }

  // Collapse excessive whitespace
  result = result.replace(/\s{3,}/g, '  ');

  return result.trim();
}

/**
 * Deep-sanitize an object's string values (recursive).
 * Returns a sanitized copy — does NOT mutate the original.
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject) as unknown as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = sanitizeObject(value);
    }
    return result as T;
  }

  return obj;
}

/* ═══════════════════════════════════════════════════
   Rate Limiting (in-memory, per-user + per-endpoint)
   ═══════════════════════════════════════════════════ */

interface RateLimitEntry {
  timestamps: number[];
}

/** Sliding window rate limiter */
const rateLimitStore = new Map<string, RateLimitEntry>();

interface RateLimitConfig {
  /** Max requests allowed in the window */
  maxRequests: number;
  /** Sliding window duration in ms */
  windowMs: number;
}

/** Default rate limits per endpoint pattern */
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Auth endpoints — aggressive limiting
  'POST:/api/auth/login':      { maxRequests: 5,  windowMs: 60_000 },      // 5/min
  'POST:/api/auth/signup':     { maxRequests: 3,  windowMs: 60_000 },      // 3/min
  'POST:/api/auth/verify-otp': { maxRequests: 5,  windowMs: 60_000 },      // 5/min
  'POST:/api/auth/refresh':    { maxRequests: 10, windowMs: 60_000 },      // 10/min

  // Write endpoints — moderate limiting
  'POST:/api/listings':        { maxRequests: 10, windowMs: 60_000 },      // 10/min
  'POST:/api/requests':        { maxRequests: 10, windowMs: 60_000 },      // 10/min
  'PATCH:/api/requests':       { maxRequests: 20, windowMs: 60_000 },      // 20/min (transitions)
  'POST:/api/disputes':        { maxRequests: 5,  windowMs: 300_000 },     // 5/5min
  'PATCH:/api/listings':       { maxRequests: 20, windowMs: 60_000 },      // 20/min (admin)
  'PATCH:/api/disputes':       { maxRequests: 20, windowMs: 60_000 },      // 20/min (admin)

  // Admin read endpoints — prevent scraping/enumeration
  'GET:/api/admin/audit':      { maxRequests: 30, windowMs: 60_000 },      // 30/min
  'GET:/api/admin/fraud':      { maxRequests: 20, windowMs: 60_000 },      // 20/min
  'GET:/api/admin/stats':      { maxRequests: 30, windowMs: 60_000 },      // 30/min
  'GET:/api/admin/users':      { maxRequests: 30, windowMs: 60_000 },      // 30/min
  'POST:/api/admin/recovery':  { maxRequests: 5,  windowMs: 300_000 },     // 5/5min (recovery scans)
};

/** Global fallback for unmatched endpoints */
const DEFAULT_RATE_LIMIT: RateLimitConfig = { maxRequests: 60, windowMs: 60_000 }; // 60/min

/**
 * Resolve rate limit config for a given method + path.
 * Matches exact key first, then method prefix.
 */
function resolveRateLimit(method: string, path: string): RateLimitConfig {
  // Exact match
  const exact = RATE_LIMITS[`${method}:${path}`];
  if (exact) return exact;

  // Prefix match (handles parameterised paths like /api/listings/:id/status)
  for (const [key, config] of Object.entries(RATE_LIMITS)) {
    const [m, p] = key.split(':');
    if (m === method && path.startsWith(p)) return config;
  }

  return DEFAULT_RATE_LIMIT;
}

/**
 * Check rate limit for a request.
 * @returns null if allowed, or { retryAfterMs } if rate limited.
 */
export function checkRateLimit(
  userId: string | null,
  method: string,
  path: string,
): { retryAfterMs: number } | null {
  const key = `${userId || 'anon'}:${method}:${path}`;
  const config = resolveRateLimit(method, path);
  const now = Date.now();

  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }

  // Purge expired timestamps
  const cutoff = now - config.windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  // Check limit
  if (entry.timestamps.length >= config.maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = oldest + config.windowMs - now;
    return { retryAfterMs: Math.max(retryAfterMs, 1000) };
  }

  // Record this request
  entry.timestamps.push(now);
  return null;
}

/* ═══════════════════════════════════════════════════
   CSRF Protection (double-submit cookie pattern)
   ═══════════════════════════════════════════════════ */

/**
 * In-memory CSRF token store (mock backend).
 * Maps session-id → token.
 * 
 * In production, use a stateless double-submit cookie:
 * - Server sets a random CSRF token in a cookie (SameSite=Strict)
 * - Client reads the cookie and sends it in X-CSRF-Token header
 * - Server compares cookie vs header
 * 
 * For our mock API we simulate this with an in-memory store.
 */
const csrfTokenStore = new Map<string, string>();

/** Generate a CSRF token for a user session */
export function generateCsrfToken(userId: string): string {
  const token = crypto.randomUUID();
  csrfTokenStore.set(userId, token);
  return token;
}

/** Validate CSRF token for a user session */
export function validateCsrfToken(userId: string, token: string | null): boolean {
  if (!token) return false;
  const stored = csrfTokenStore.get(userId);
  if (!stored) return false;
  // Constant-time comparison (simplified — in prod use crypto.timingSafeEqual)
  if (stored.length !== token.length) return false;
  let mismatch = 0;
  for (let i = 0; i < stored.length; i++) {
    mismatch |= stored.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Revoke CSRF token on logout */
export function revokeCsrfToken(userId: string): void {
  csrfTokenStore.delete(userId);
}

/* ═══════════════════════════════════════════════════
   Cleanup (periodic GC for rate limit store)
   ═══════════════════════════════════════════════════ */

/** Purge stale rate limit entries (call periodically or on low traffic) */
export function purgeRateLimitStore(): void {
  const now = Date.now();
  const maxWindow = 300_000; // 5 min max window
  for (const [key, entry] of rateLimitStore) {
    entry.timestamps = entry.timestamps.filter((t) => t > now - maxWindow);
    if (entry.timestamps.length === 0) rateLimitStore.delete(key);
  }
}

/* ═══════════════════════════════════════════════════
   Account Lockout (brute-force protection)
   ═══════════════════════════════════════════════════ */

interface LoginAttemptEntry {
  failedAttempts: number;
  lastFailedAt: number;
  lockedUntil: number | null;
}

const loginAttemptStore = new Map<string, LoginAttemptEntry>();

/** Max failed login attempts before lockout */
const MAX_FAILED_ATTEMPTS = 5;
/** Lockout duration in ms (15 minutes) */
const LOCKOUT_DURATION_MS = 15 * 60_000;
/** Window to count failed attempts (30 minutes) */
const ATTEMPT_WINDOW_MS = 30 * 60_000;

/**
 * Check if an account is locked out.
 * @returns null if not locked, or { retryAfterMs } if locked.
 */
export function checkAccountLockout(email: string): { retryAfterMs: number } | null {
  const entry = loginAttemptStore.get(email);
  if (!entry) return null;

  const now = Date.now();

  // Check if currently locked
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { retryAfterMs: entry.lockedUntil - now };
  }

  // Lock expired — reset
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    loginAttemptStore.delete(email);
    return null;
  }

  // Check if attempts have expired (outside window)
  if (entry.lastFailedAt < now - ATTEMPT_WINDOW_MS) {
    loginAttemptStore.delete(email);
    return null;
  }

  return null;
}

/** Record a failed login attempt. Triggers lockout if threshold exceeded. */
export function recordFailedLogin(email: string): void {
  const now = Date.now();
  let entry = loginAttemptStore.get(email);

  if (!entry || entry.lastFailedAt < now - ATTEMPT_WINDOW_MS) {
    entry = { failedAttempts: 0, lastFailedAt: now, lockedUntil: null };
  }

  entry.failedAttempts++;
  entry.lastFailedAt = now;

  if (entry.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  loginAttemptStore.set(email, entry);
}

/** Clear failed login attempts on successful login */
export function clearFailedLogins(email: string): void {
  loginAttemptStore.delete(email);
}
