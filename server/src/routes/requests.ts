/**
 * BErozgar — Request Routes
 *
 * GET    /api/requests          — List user's requests
 * GET    /api/requests/:id      — Single request
 * POST   /api/requests          — Create request
 * PATCH  /api/requests/:id/event — Apply FSM event
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import { createRequestSchema, updateRequestEventSchema } from '@/shared/validation';
import { apiData, apiPage } from '@/shared/response';
import * as requestService from '@/services/requestService';

export async function requestRoutes(app: FastifyInstance): Promise<void> {
  /** GET /requests — list user's requests */
  app.get(
    '/requests',
    { preHandler: authenticate },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const result = await requestService.listRequests({
        userId: request.userId!,
        role: request.userRole!,
        page: query.page ? parseInt(query.page, 10) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
      });
      return reply.status(200).send(apiPage(result.requests, result.pagination));
    },
  );

  /** GET /requests/:id — single request */
  app.get(
    '/requests/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const req = await requestService.getRequest(id, request.userId!, request.userRole!);
      return reply.status(200).send(apiData(req));
    },
  );

  /** POST /requests — create new request (auth required) */
  app.post(
    '/requests',
    {
      preHandler: authenticate,
      preValidation: validate(createRequestSchema),
    },
    async (request, reply) => {
      const req = await requestService.createRequest(
        request.body as any,
        request.userId!,
      );
      return reply.status(201).send(apiData(req));
    },
  );

  /** PATCH /requests/:id/event — apply FSM event */
  app.patch(
    '/requests/:id/event',
    {
      preHandler: authenticate,
      preValidation: validate(updateRequestEventSchema),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const req = await requestService.updateRequestEvent(
        id,
        request.body as any,
        request.userId!,
        request.userRole!,
      );
      return reply.status(200).send(apiData(req));
    },
  );
}
