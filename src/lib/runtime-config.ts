/**
 * BErozgar — Environment-Aware Runtime Config
 *
 * Provides environment-specific overrides for:
 * - Rate limit multipliers
 * - Log level
 * - Feature flags
 * - Recovery job intervals
 * - Cache durations
 *
 * Usage:
 *   import { runtimeConfig } from '@/lib/runtime-config';
 *   if (runtimeConfig.features.enableRecoveryScanner) { ... }
 *
 * This is NOT about .env vars (those are in env.ts).
 * This is about runtime behavior that differs between environments
 * even when the same build artifact is deployed.
 */

import { isDev, isProd } from '@/lib/env';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

export interface RuntimeConfig {
  /** Environment identifier */
  environment: 'development' | 'staging' | 'production';

  /** Rate limiting multiplier (1.0 = normal, 0.5 = stricter, 2.0 = relaxed) */
  rateLimitMultiplier: number;

  /** Minimum log severity for output */
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

  /** Cache/stale time multiplier for React Query */
  cacheMultiplier: number;

  /** Feature flags */
  features: {
    /** Enable stale transaction auto-recovery */
    enableRecoveryScanner: boolean;
    /** Enable random mock API errors for chaos testing */
    enableChaosErrors: boolean;
    /** Enable detailed audit logging */
    enableDetailedAudit: boolean;
    /** Enable structured log export to analytics */
    enableLogExport: boolean;
    /** Enable fraud heuristic auto-flagging */
    enableFraudHeuristics: boolean;
    /** Enable optimistic UI updates */
    enableOptimisticUpdates: boolean;
  };

  /** Recovery scanner intervals */
  recovery: {
    /** How often to scan for stale transactions (ms) */
    scanIntervalMs: number;
    /** How long before a transaction is considered stale (ms) */
    staleTtlMs: number;
  };

  /** CORS origins (empty = allow all, for mock layer) */
  allowedOrigins: string[];
}

/* ═══════════════════════════════════════════════════
   Environment Detection
   ═══════════════════════════════════════════════════ */

function detectEnvironment(): 'development' | 'staging' | 'production' {
  // VITE_SENTRY_ENVIRONMENT is set in deployment config
  const envHint = (import.meta.env.VITE_SENTRY_ENVIRONMENT || '').toLowerCase();

  if (envHint === 'staging') return 'staging';
  if (envHint === 'production' || isProd) return 'production';
  if (isDev) return 'development';

  return 'production'; // default to strictest
}

/* ═══════════════════════════════════════════════════
   Config per Environment
   ═══════════════════════════════════════════════════ */

const DEVELOPMENT_CONFIG: RuntimeConfig = {
  environment: 'development',
  rateLimitMultiplier: 2.0, // relaxed for development
  logLevel: 'DEBUG',
  cacheMultiplier: 0.1, // short caches for hot reload
  features: {
    enableRecoveryScanner: true,
    enableChaosErrors: false,
    enableDetailedAudit: true,
    enableLogExport: false, // no remote logging in dev
    enableFraudHeuristics: true,
    enableOptimisticUpdates: true,
  },
  recovery: {
    scanIntervalMs: 60_000, // 1 min in dev (faster feedback)
    staleTtlMs: 5 * 60_000, // 5 min in dev (faster expiry)
  },
  allowedOrigins: ['*'],
};

const STAGING_CONFIG: RuntimeConfig = {
  environment: 'staging',
  rateLimitMultiplier: 1.0, // production-identical limits
  logLevel: 'INFO',
  cacheMultiplier: 0.5, // shorter caches for testing
  features: {
    enableRecoveryScanner: true,
    enableChaosErrors: true, // chaos testing in staging
    enableDetailedAudit: true,
    enableLogExport: true,
    enableFraudHeuristics: true,
    enableOptimisticUpdates: true,
  },
  recovery: {
    scanIntervalMs: 10 * 60_000, // 10 min
    staleTtlMs: 48 * 60 * 60_000, // 48 hours
  },
  allowedOrigins: ['https://staging.berozgar.in'],
};

const PRODUCTION_CONFIG: RuntimeConfig = {
  environment: 'production',
  rateLimitMultiplier: 1.0,
  logLevel: 'WARN',
  cacheMultiplier: 1.0,
  features: {
    enableRecoveryScanner: true,
    enableChaosErrors: false, // NEVER chaos in prod
    enableDetailedAudit: true,
    enableLogExport: true,
    enableFraudHeuristics: true,
    enableOptimisticUpdates: true,
  },
  recovery: {
    scanIntervalMs: 10 * 60_000, // 10 min
    staleTtlMs: 48 * 60 * 60_000, // 48 hours
  },
  allowedOrigins: ['https://berozgar.in', 'https://www.berozgar.in'],
};

/* ═══════════════════════════════════════════════════
   Export
   ═══════════════════════════════════════════════════ */

const CONFIGS: Record<string, RuntimeConfig> = {
  development: DEVELOPMENT_CONFIG,
  staging: STAGING_CONFIG,
  production: PRODUCTION_CONFIG,
};

const detectedEnv = detectEnvironment();

/**
 * Frozen runtime config for the current environment.
 * Import once, use everywhere. Never mutate.
 */
export const runtimeConfig: Readonly<RuntimeConfig> = Object.freeze(
  CONFIGS[detectedEnv] || PRODUCTION_CONFIG,
);

export default runtimeConfig;
