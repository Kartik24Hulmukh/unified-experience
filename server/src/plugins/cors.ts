/**
 * BErozgar — CORS Plugin
 *
 * Configures Cross-Origin Resource Sharing for the Fastify server.
 */

import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { env } from '@/config/env';

export async function registerCors(app: FastifyInstance): Promise<void> {
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Idempotency-Key',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['X-Request-Id', 'Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400, // 24h preflight cache
  });
}
