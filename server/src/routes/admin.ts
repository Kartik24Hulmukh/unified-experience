/**
 * BErozgar — Admin Routes
 *
 * GET    /api/admin/pending      — Pending listings
 * GET    /api/admin/stats        — Platform statistics
 * GET    /api/admin/users/:userId — User drilldown
 * GET    /api/admin/audit        — Audit trail
 * GET    /api/admin/fraud        — Fraud overview
 * GET    /api/admin/integrity    — Integrity report
 * POST   /api/admin/recovery     — Stale transaction recovery
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { createAuditLogSchema } from '@/shared/validation';
import { apiData } from '@/shared/response';
import * as adminService from '@/services/adminService';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // All admin routes require ADMIN role
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', authorize('ADMIN'));

  /** GET /pending — listings awaiting review */
  app.get('/pending', async (_request, reply) => {
    const listings = await adminService.getPendingListings();
    return reply.status(200).send(listings);
  });

  /** GET /stats — platform statistics */
  app.get('/stats', async (_request, reply) => {
    const stats = await adminService.getStats();
    return reply.status(200).send(stats);
  });

  /** GET /users/:userId — full user drilldown */
  app.get('/users/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const drilldown = await adminService.getUserDrilldown(userId);
    return reply.status(200).send(drilldown);
  });

  /** GET /audit — audit trail */
  app.get('/audit', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const logs = await adminService.getAuditLogs({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      action: query.action,
    });
    return reply.status(200).send(logs);
  });

  /** POST /audit — record an audit entry */
  app.post(
    '/audit',
    { preValidation: validate(createAuditLogSchema) },
    async (request, reply) => {
      const { action, targetUserId, entityType, metadata } = request.body as any;
      const actorId = request.userId!;

      const entry = await adminService.createAuditLog({
        actorId,
        action,
        entityType: entityType ?? 'USER',
        entityId: targetUserId,
        metadata,
        actorRole: request.userRole,
        ipAddress: request.ip,
      });

      return reply.status(201).send(apiData(entry));
    },
  );

  /** GET /fraud — fraud overview */
  app.get('/fraud', async (_request, reply) => {
    const report = await adminService.getFraudOverview();
    return reply.status(200).send(report);
  });

  /** GET /integrity — referential integrity report (SUPER only) */
  app.get('/integrity', async (request, reply) => {
    await adminService.requireSuperPrivilege(request.userId!);
    const report = await adminService.getIntegrityReport();
    return reply.status(200).send(report);
  });

  /** POST /recovery — recover stale transactions (SUPER only) */
  app.post('/recovery', async (request, reply) => {
    await adminService.requireSuperPrivilege(request.userId!);
    const result = await adminService.recoverStaleTransactions();
    return reply.status(200).send(result);
  });
}
