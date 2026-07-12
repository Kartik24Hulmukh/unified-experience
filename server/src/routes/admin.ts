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

import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { createAuditLogSchema, type CreateAuditLogInput } from '@/shared/validation';
import { apiData } from '@/shared/response';
import * as adminService from '@/services/adminService';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // All admin routes require ADMIN role
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', authorize('ADMIN'));

  /** GET /pending — listings awaiting review */
  app.get('/pending', async (_request, reply) => {
    const listings = await adminService.getPendingListings();
    return reply.status(200).send(apiData(listings));
  });

  /** GET /stats — platform statistics */
  app.get('/stats', async (_request, reply) => {
    const stats = await adminService.getStats();
    return reply.status(200).send(apiData(stats));
  });

  /** GET /users — list all users */
  app.get('/users', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const parsePage = (s: string | undefined) => {
      const n = s ? parseInt(s, 10) : NaN;
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    const result = await adminService.getAllUsers({
      page: parsePage(query.page),
      limit: parsePage(query.limit),
      search: query.search,
    });
    return reply.status(200).send(apiData(result));
  });

  /** GET /users/:userId — full user drilldown */
  app.get('/users/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const drilldown = await adminService.getUserDrilldown(userId);
    return reply.status(200).send(apiData(drilldown));
  });

  /** POST /users/:userId/status — ban/verify user */
  const updateUserStatusSchema = z.object({
    action: z.enum(['ban', 'verify', 'unban']),
  });
  app.post('/users/:userId/status', { preValidation: [validate(updateUserStatusSchema)] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const body = request.body as { action: 'ban' | 'verify' | 'unban' };
    const result = await adminService.updateUserStatus(userId, body);
    
    await adminService.createAuditLog({
      actorId: request.userId!,
      action: `USER_${body.action.toUpperCase()}`,
      entityType: 'User',
      entityId: userId,
      actorRole: request.userRole,
      ipAddress: request.ip,
      metadata: { newStatus: body.action },
    });

    return reply.status(200).send(apiData(result));
  });

  /** GET /audit — audit trail (field names mapped to match frontend AuditLogEntry) */
  app.get('/audit', async (request, reply) => {
    const query = request.query as Record<string, string>;
    // MED-1 FIX: parseInt('abc', 10) returns NaN which is truthy enough to
    // pass the `? ... : undefined` guard and then crashes Prisma's skip param.
    // Number.isFinite + positive check guarantees only valid integers reach the DB.
    const parsePage = (s: string | undefined) => {
      const n = s ? parseInt(s, 10) : NaN;
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    const result = await adminService.getAuditLogs({
      page: parsePage(query.page),
      limit: parsePage(query.limit),
      action: query.action,
    });
    const mapped = result.logs.map((l) => ({
      id: l.id,
      timestamp: (l.createdAt as Date).toISOString(),
      actorId: l.actorId,
      actorRole: l.actorRole ?? 'system',
      action: l.action,
      targetType: (l.entityType?.toLowerCase() ?? 'system') as
        | 'listing'
        | 'request'
        | 'dispute'
        | 'user'
        | 'system',
      targetId: l.entityId ?? '',
      details: l.metadata != null ? JSON.stringify(l.metadata) : undefined,
    }));
    return reply.status(200).send(apiData(mapped));
  });

  /** POST /audit — record an audit entry */
  app.post(
    '/audit',
    { preValidation: validate(createAuditLogSchema) },
    async (request, reply) => {
      const { action, targetUserId, entityType, metadata } = request.body as CreateAuditLogInput;
      const actorId = request.userId!;

      const entry = await adminService.createAuditLog({
        actorId,
        action,
        entityType: entityType ?? 'USER',
        entityId: targetUserId,
        metadata: metadata as Prisma.InputJsonObject | undefined,
        actorRole: request.userRole,
        ipAddress: request.ip,
      });

      return reply.status(201).send(apiData(entry));
    },
  );

  /** GET /fraud — fraud overview (mapped to FraudDashboardData shape) */
  app.get('/fraud', async (_request, reply) => {
    const report = await adminService.getFraudOverview();
    const flaggedUsers = report.map((u) => ({
      userId: u.id,
      email: u.email,
      fullName: u.fullName,
      riskLevel: u.heuristics.riskLevel,
      flags: u.heuristics.flags,
      trust:
        u.heuristics.riskLevel === 'HIGH'
          ? 'RESTRICTED'
          : u.heuristics.riskLevel === 'MEDIUM'
          ? 'REVIEW_REQUIRED'
          : 'GOOD_STANDING',
      activeDisputes: u._count.disputes,
    }));
    return reply.status(200).send(
      apiData({
        flaggedUsers,
        totalFlagged: flaggedUsers.length,
        highRisk: flaggedUsers.filter((u) => u.riskLevel === 'HIGH').length,
        mediumRisk: flaggedUsers.filter((u) => u.riskLevel === 'MEDIUM').length,
      }),
    );
  });

  /** GET /integrity — referential integrity report (SUPER only) */
  app.get('/integrity', async (request, reply) => {
    await adminService.requireSuperPrivilege(request.userId!);
    const report = await adminService.getIntegrityReport();
    return reply.status(200).send(apiData(report));
  });

  /** POST /recovery — recover stale transactions (SUPER only) */
  app.post('/recovery', async (request, reply) => {
    await adminService.requireSuperPrivilege(request.userId!);
    const result = await adminService.recoverStaleTransactions();
    return reply.status(200).send(apiData(result));
  });
}
