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
import { validate } from '@/middleware/validate';
import { createDisputeSchema, updateDisputeStatusSchema } from '@/shared/validation';
import { apiData, apiPage } from '@/shared/response';
import * as disputeService from '@/services/disputeService';

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
        page: query.page ? parseInt(query.page, 10) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
      });
      return reply.status(200).send(apiPage(result.disputes, result.pagination));
    },
  );

  /** POST /disputes — file a new dispute */
  app.post(
    '/disputes',
    {
      preHandler: authenticate,
      preValidation: validate(createDisputeSchema),
    },
    async (request, reply) => {
      const dispute = await disputeService.createDispute(
        request.body as any,
        request.userId!,
      );
      return reply.status(201).send(apiData(dispute));
    },
  );

  /** PATCH /disputes/:id/status — admin updates dispute status */
  app.patch(
    '/disputes/:id/status',
    {
      preHandler: [authenticate, authorize('ADMIN')],
      preValidation: validate(updateDisputeStatusSchema),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const dispute = await disputeService.updateDisputeStatus(
        id,
        request.body as any,
        request.userId!,
      );
      return reply.status(200).send(apiData(dispute));
    },
  );
}
