/**
 * BErozgar — Application Constants
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
  PATH: '/api/auth',
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
  EXPIRES_HOURS: 24,
} as const;

/**
 * Admin registry — emails that may hold ADMIN role.
 * Users NOT in this list can never be assigned ADMIN or SUPER privilege.
 */
export const ADMIN_REGISTRY: readonly string[] = [
  'admin@mctrgit.ac.in',
] as const;

/**
 * Allowed email domains for signup.
 * Only institutional emails are permitted.
 */
export const ALLOWED_EMAIL_DOMAINS: readonly string[] = [
  'mctrgit.ac.in',
] as const;
