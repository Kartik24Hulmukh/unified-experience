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

/** Run stale recovery every 6 hours */
const STALE_RECOVERY_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const app = await buildApp();

  // ── Scheduled Stale Recovery Job ────────────────
  // Runs every 6h: expires stuck SENT requests, revokes expired tokens,
  // cleans expired idempotency keys. Also runs once at startup.
  let recoveryTimer: ReturnType<typeof setInterval> | null = null;

  async function runRecovery() {
    try {
      const result = await recoverStaleTransactions();
      app.log.info(result, 'Stale recovery completed');
    } catch (err) {
      app.log.error(err, 'Stale recovery failed');
    }
  }

  // Fire once after 30s startup delay, then every 6h
  const startupDelay = setTimeout(async () => {
    await runRecovery();
    recoveryTimer = setInterval(runRecovery, STALE_RECOVERY_INTERVAL_MS);
  }, 30_000);

  // ── Graceful Shutdown ───────────────────────────
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}. Shutting down gracefully...`);
      clearTimeout(startupDelay);
      if (recoveryTimer) clearInterval(recoveryTimer);
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
  } catch (err) {
    app.log.fatal(err, 'Failed to start server');
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
