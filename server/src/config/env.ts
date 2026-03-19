/**
 * BErozgar - Environment Configuration
 *
 * Zod-validated environment variables.
 * Fails fast at startup if any required var is missing.
 */

import { z } from 'zod';

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),

  // Google OAuth — optional; when absent, Google sign-in is gracefully disabled
  GOOGLE_CLIENT_ID: z.string().default(''),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Cookie
  COOKIE_DOMAIN: z.string().optional(),
  // GAP-04: default to true — override with COOKIE_SECURE=false in .env.development only
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default('true'),

  // GAP-02: decouple CSRF enforcement from NODE_ENV so staging always enforces it
  // Set CSRF_ENFORCE=false only in local .env.development
  CSRF_ENFORCE: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default('true'),

  // Sentry (optional in dev)
  SENTRY_DSN: z.string().optional(),

  // Email delivery
  EMAIL_PROVIDER: z.enum(['log', 'resend', 'smtp']).default('log'),
  EMAIL_FROM: z.string().default('BErozgar <noreply@berozgar.local>'),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  // SEC-PROXY-01: Proxy trust scope. Use CIDR strings (e.g. "10.0.0.0/8") or
  // Fastify's named presets ("loopback", "loopback,linklocal,uniquelocal").
  // Defaults to safe local-only preset. Override in production with your actual
  // load balancer / nginx network range.
  TRUST_PROXY: z.string().optional(),

  // Admin registry extension (comma-separated emails, beyond ADMIN_REGISTRY in constants.ts)
  ADMIN_EMAILS: z.string().optional(),

  // Email domain allowlist for signup (comma-separated; empty string = allow all domains)
  // Overrides the hardcoded default in constants.ts. Leave unset to use the default.
  ALLOWED_EMAIL_DOMAINS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    console.error('Environment validation failed:');
    console.error(JSON.stringify(formatted, null, 2));
    process.exit(1);
  }

  return result.data;
}

/** Singleton - parsed once at import time */
export const env = loadEnv();
