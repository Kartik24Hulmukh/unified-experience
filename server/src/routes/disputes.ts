/**
 * BErozgar — Dispute Routes
 *
 * GET    /api/disputes              — List disputes
 * POST   /api/disputes              — File a dispute
 * PATCH  /api/disputes/:id/status   — Update dispute status (admin)
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { idempotency } from '@/middleware/idempotency';
import { validate } from '@/middleware/validate';
import { createDisputeSchema, updateDisputeStatusSchema } from '@/shared/validation';
import type { CreateDisputeInput, UpdateDisputeStatusInput } from '@/shared/validation';
import { apiData, apiPage } from '@/shared/response';
import * as disputeService from '@/services/disputeService';

// Safe parseInt: rejects NaN, negative, and non-finite values to prevent Prisma crashes.
const safeParseInt = (s: string | undefined) => {
  const n = s ? parseInt(s, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export async function disputeRoutes(app: FastifyInstance): Promise<void> {
  /** GET /disputes — list disputes for current user (admin sees all) */
  app.get(
    '/disputes',
    { preHandler: authenticate },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const result = await disputeService.listDisputes({
        userId: request.userId!,
        role: request.userRole!,
        page: safeParseInt(query.page),
        limit: safeParseInt(query.limit),
      });
      return reply.status(200).send(apiPage(result.disputes, result.pagination));
    },
  );

  /** POST /disputes — file a new dispute */
  app.post(
    '/disputes',
    {
      preHandler: [authenticate, idempotency],
      preValidation: validate(createDisputeSchema),
    },
    async (request, reply) => {
      const dispute = await disputeService.createDispute(
        request.body as CreateDisputeInput,
        request.userId!,
      );
      return reply.status(201).send(apiData(dispute));
    },
  );

  /** PATCH /disputes/:id/status — admin updates dispute status */
  app.patch(
    '/disputes/:id/status',
    {
      preHandler: [authenticate, authorize('ADMIN'), idempotency],
      preValidation: validate(updateDisputeStatusSchema),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const dispute = await disputeService.updateDisputeStatus(
        id,
        request.body as UpdateDisputeStatusInput,
        request.userId!,
      );
      return reply.status(200).send(apiData(dispute));
    },
  );
}
