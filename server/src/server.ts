/**
 * BErozgar — Server Entry Point
 *
 * Boots the Fastify server. Handles graceful shutdown.
 * Starts the scheduled stale-recovery background job.
 */

import 'dotenv/config';
import { buildApp } from '@/app';
import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';
import { recoverStaleTransactions } from '@/services/adminService';
import { pruneIdempotencyKeys } from '@/middleware/idempotency';

// PROD-01: catch unhandled promise rejections and uncaught exceptions.
// Without these, Node exits silently with code 1 and zero diagnostic info.
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled promise rejection:', reason);
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error);
  process.exit(1);
});

/** Run stale recovery every 30 minutes (was 6h; stuck transactions should not wait that long) */
const STALE_RECOVERY_INTERVAL_MS = 30 * 60 * 1000;

async function main(): Promise<void> {
  const app = await buildApp();

  // ── Scheduled Stale Recovery Job ────────────────
  // Runs every 30 min: expires stuck SENT requests, revokes expired tokens,
  // cleans expired idempotency keys. Also runs once at startup.
  let recoveryTimer: ReturnType<typeof setInterval> | null = null;

  // PROD-02: concurrency guard — if a recovery run takes longer than the
  // interval (e.g. under heavy DB load), overlapping runs would race on
  // the same rows and produce non-deterministic results.
  let recoveryRunning = false;

  async function runRecovery() {
    if (recoveryRunning) {
      app.log.warn('Stale recovery skipped — previous run still in progress');
      return;
    }
    recoveryRunning = true;
    try {
      const result = await recoverStaleTransactions();
      app.log.info(result, 'Stale recovery completed');
    } catch (err) {
      app.log.error(err, 'Stale recovery failed');
    } finally {
      recoveryRunning = false;
    }
  }

  // Fire once after 30s startup delay, then every 6h
  const startupDelay = setTimeout(async () => {
    await runRecovery();
    recoveryTimer = setInterval(runRecovery, STALE_RECOVERY_INTERVAL_MS);
  }, 30_000);

  // V3-02: Schedule stuck-sentinel cleanup every 10 minutes.
  // pruneIdempotencyKeys() removes 102-Processing sentinels older than 10 min
  // that were left behind by server crashes. Without this scheduler the function
  // was declared but never called, leaving clients blocked for a full 24 h after
  // any server restart that interrupted an in-flight mutation.
  const SENTINEL_PRUNE_INTERVAL_MS = 10 * 60 * 1000;
  const sentinelPruneTimer = setInterval(async () => {
    try {
      const pruned = await pruneIdempotencyKeys();
      if (pruned > 0) {
        app.log.info({ pruned }, 'Pruned stale idempotency sentinels');
      }
    } catch (err) {
      app.log.warn({ err }, 'Sentinel prune failed');
    }
  }, SENTINEL_PRUNE_INTERVAL_MS);

  // ── Graceful Shutdown ───────────────────────────
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}. Shutting down gracefully...`);
      clearTimeout(startupDelay);
      if (recoveryTimer) clearInterval(recoveryTimer);
      clearInterval(sentinelPruneTimer);
      try {
        await app.close();
        await prisma.$disconnect();
        app.log.info('Server closed. Database disconnected.');
        process.exit(0);
      } catch (err) {
        app.log.error(err, 'Error during shutdown');
        process.exit(1);
      }
    });
  }

  // ── Start Listening ─────────────────────────────
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`🚀 BErozgar API running at http://${env.HOST}:${env.PORT}`);
    app.log.info(`   Environment: ${env.NODE_ENV}`);

    // Audit: Server Startup
    try {
      const { createAuditLog } = await import('@/services/adminService');
      await createAuditLog({
        actorId: null, // SYSTEM sentinel
        action: 'SYSTEM_STARTUP',
        entityType: 'System',
        metadata: {
          port: env.PORT,
          env: env.NODE_ENV,
          nodeVersion: process.version,
        },
      });
    } catch (auditErr) {
      app.log.warn({ err: auditErr }, 'Failed to record startup audit log');
    }
  } catch (err) {
    app.log.fatal(err, 'Failed to start server');
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
