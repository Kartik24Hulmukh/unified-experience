/**
 * BErozgar — Typed Environment Configuration
 *
 * Single source of truth for all environment variables.
 * Every module imports from here instead of reading import.meta.env directly.
 *
 * Benefits:
 * - Type safety (no `string | undefined` scattered everywhere)
 * - Validation at startup via Zod
 * - Central documentation of every env var
 * - Easy refactoring when var names change
 */

import { z } from 'zod';

/* ═══════════════════════════════════════════════════
   Schema
   ═══════════════════════════════════════════════════ */

/** Coerce 'true'/'false' strings from .env to actual booleans */
const boolStr = z
  .enum(['true', 'false', ''])
  .default('false')
  .transform((v) => v === 'true');

/** Coerce numeric strings from .env to numbers */
const numStr = (fallback: number) =>
  z
    .string()
    .default(String(fallback))
    .transform((v) => Number(v))
    .pipe(z.number().finite());

const envSchema = z.object({
  /* ── App ─────────────────────────────────────── */
  VITE_APP_NAME: z.string().default('BErozgar'),
  VITE_APP_VERSION: z.string().default('0.0.0'),

  /* ── API ─────────────────────────────────────── */
  VITE_API_BASE_URL: z.string().default('/api'),
  VITE_API_TIMEOUT_MS: numStr(15_000),

  /* ── Domain Restriction ──────────────────────── */
  /** Comma-separated list of allowed email domains. Empty = allow all. */
  VITE_ALLOWED_EMAIL_DOMAINS: z.string().default(''),

  /* ── Session ─────────────────────────────────── */
  VITE_SESSION_EXPIRY_BUFFER_MS: numStr(60_000),

  /* ── Query Cache ─────────────────────────────── */
  VITE_QUERY_STALE_TIME_MS: numStr(600_000),

  /* ── Monitoring ──────────────────────────────── */
  VITE_SENTRY_DSN: z.string().default(''),
  VITE_SENTRY_ENVIRONMENT: z.string().default('development'),
  VITE_LOGROCKET_APP_ID: z.string().default(''),
  VITE_ENABLE_ANALYTICS: boolStr,

  /* ── Google OAuth ────────────────────────────── */
  VITE_GOOGLE_CLIENT_ID: z.string().default(''),

  /* ── Domain ──────────────────────────────────── */
  VITE_DEFAULT_EMAIL_DOMAIN: z.string().default('mctrgit.ac.in'),
});

/* ═══════════════════════════════════════════════════
   Parse & Export
   ═══════════════════════════════════════════════════ */

function loadEnv() {
  // import.meta.env is populated by Vite at build time
  const raw = import.meta.env as Record<string, string>;
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    // eslint-disable-next-line no-console
    console.error('[env] Invalid environment configuration:', result.error.flatten().fieldErrors);
    throw new Error('[env] Invalid environment configuration — check .env files');
  }

  return Object.freeze(result.data);
}

/**
 * Validated, typed, frozen environment config.
 *
 * Usage:
 * ```ts
 * import { env } from '@/lib/env';
 * env.VITE_API_BASE_URL // string
 * env.VITE_API_TIMEOUT_MS // number
 * ```
 */
export const env = loadEnv();

/** Shorthand checks */
export const isDev = import.meta.env.DEV;
export const isProd = import.meta.env.PROD;
export const isTest = import.meta.env.MODE === 'test';
