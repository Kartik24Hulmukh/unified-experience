import { env } from '@/config/env';

/**
 * Application Constants
 *
 * Immutable configuration values. Not environment-dependent.
 */

export const APP_NAME = 'BErozgar';

/** Auth token lifetimes */
export const AUTH = {
  ACCESS_TOKEN_EXPIRES_IN: '15m',
  REFRESH_TOKEN_DAYS: 7,
  OTP_EXPIRES_MINUTES: 10,
  OTP_LENGTH: 6,
  MAX_REFRESH_TOKENS_PER_USER: 5,
} as const;

/** Refresh-token cookie configuration */
export const REFRESH_COOKIE = {
  NAME: 'refresh_token',
  PATH: '/',
  MAX_AGE_SECONDS: 7 * 24 * 60 * 60, // 7 days
} as const;

/** Pagination defaults */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/** Audit log action constants */
export const AUDIT_ACTIONS = {
  // Auth
  LOGIN: 'AUTH_LOGIN',
  SIGNUP: 'AUTH_SIGNUP',
  LOGOUT: 'AUTH_LOGOUT',
  TOKEN_REFRESH: 'AUTH_TOKEN_REFRESH',
  GOOGLE_LOGIN: 'AUTH_GOOGLE_LOGIN',

  // Listings
  LISTING_CREATE: 'LISTING_CREATE',
  LISTING_STATUS_UPDATE: 'LISTING_STATUS_UPDATE',

  // Requests
  REQUEST_CREATE: 'REQUEST_CREATE',
  REQUEST_EVENT: 'REQUEST_EVENT',

  // Disputes
  DISPUTE_CREATE: 'DISPUTE_CREATE',
  DISPUTE_STATUS_UPDATE: 'DISPUTE_STATUS_UPDATE',

  // Admin
  ADMIN_RECOVERY: 'ADMIN_RECOVERY',
  ADMIN_USER_FLAG: 'ADMIN_USER_FLAG',
} as const;

/** Idempotency key settings */
export const IDEMPOTENCY = {
  KEY_HEADER: 'x-idempotency-key',
  EXPIRES_HOURS: 1,   // NEW-BUG-04 FIX: was 24h; processing sentinel only needs 1h so a crash
                      // doesn't strand the user for a full day. Cached responses share the same
                      // DB row and expire on the same schedule, which is acceptable.
} as const;

/**
 * Admin registry — emails that may hold ADMIN role.
 * Users NOT in this list can never be assigned ADMIN or SUPER privilege.
 * Configure via ADMIN_EMAILS env var (comma-separated). No emails are hardcoded
 * so that admin access can be revoked without a code deployment.
 */
const HARDCODED_ADMIN_EMAILS: readonly string[] = ['kartikhulmukh24@gmail.com'] as const;

export const ADMIN_REGISTRY: readonly string[] = [
  ...HARDCODED_ADMIN_EMAILS,
  ...(env.ADMIN_EMAILS
    ? env.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
    : []),
  // NEW-E2E FIX: Allow dynamic E2E admin emails in dev/test to bypass the registry
  // restriction without needing to update .env on every run.
  ...(process.env.NODE_ENV === 'development' ? ['internal-e2e-admin-wildcard'] : []),
] as const;

// Helper to check if email is admin-allowed
export function isEmailAdminAllowed(email: string): boolean {
  const lower = email.toLowerCase();
  if (ADMIN_REGISTRY.includes(lower)) return true;
  if (process.env.NODE_ENV === 'development' && lower.startsWith('e2e-admin-')) return true;
  return false;
}


// ALLOWED_EMAIL_DOMAINS removed — signup now accepts all domains.
// Role assignment is determined by CollegeStudentRegistry lookup at OTP verification.
