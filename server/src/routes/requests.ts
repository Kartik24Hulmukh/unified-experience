/**
 * BErozgar — Request Routes
 *
 * GET    /api/requests          — List user's requests
 * GET    /api/requests/:id      — Single request
 * POST   /api/requests          — Create request
 * PATCH  /api/requests/:id/event — Apply FSM event
 */

import { z } from 'zod';
import * as messageService from '@/services/messageService';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '@/middleware/authenticate';
import { requireVerifiedStudent } from '@/middleware/requireVerifiedStudent';
import { idempotency } from '@/middleware/idempotency';
import { validate } from '@/middleware/validate';
import { createRequestSchema, updateRequestEventSchema } from '@/shared/validation';
import type { CreateRequestInput, UpdateRequestEventInput } from '@/shared/validation';
import { apiData, apiPage } from '@/shared/response';
import * as requestService from '@/services/requestService';

// Safe parseInt: rejects NaN, negative, and non-finite values to prevent Prisma crashes.
const safeParseInt = (s: string | undefined) => {
  const n = s ? parseInt(s, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export async function requestRoutes(app: FastifyInstance): Promise<void> {
  const messageBody = z.object({ body: z.string().trim().min(1).max(2000), clientId: z.string().uuid() }).strict();
  const messageParams = z.object({ id: z.string().uuid() });
  const messageQuery = z.object({ before: z.string().uuid().optional() }).strict();
  app.get('/requests/:id/messages', { preHandler: authenticate }, async (request, reply) => {
    if (!messageParams.safeParse(request.params).success) return reply.status(400).send({ error: 'Invalid request ID', code: 'VALIDATION_ERROR' });
    const parsed = messageQuery.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid message cursor', code: 'VALIDATION_ERROR' });
    const { id } = request.params as { id: string };
    return reply.header('Cache-Control', 'private, no-store').send(apiData(await messageService.listMessages(id, request.userId!, parsed.data.before)));
  });
  app.post('/requests/:id/messages', {
    preHandler: [authenticate, requireVerifiedStudent],
    preValidation: validate(messageBody),
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!messageParams.safeParse(request.params).success) return reply.status(400).send({ error: 'Invalid request ID', code: 'VALIDATION_ERROR' });
    return reply.status(201).send(apiData(await messageService.sendMessage(id, request.userId!, request.body as { body: string; clientId: string })));
  });

  /** GET /requests — list user's requests */
  app.get(
    '/requests',
    { preHandler: authenticate },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const result = await requestService.listRequests({
        userId: request.userId!,
        role: request.userRole!,
        page: safeParseInt(query.page),
        limit: safeParseInt(query.limit),
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
      preHandler: [authenticate, requireVerifiedStudent, idempotency],
      preValidation: validate(createRequestSchema),
    },
    async (request, reply) => {
      const req = await requestService.createRequest(
        request.body as CreateRequestInput,
        request.userId!,
      );
      return reply.status(201).send(apiData(req));
    },
  );

  /** PATCH /requests/:id/event — apply FSM event */
  app.patch(
    '/requests/:id/event',
    {
      preHandler: [authenticate, requireVerifiedStudent, idempotency],
      preValidation: validate(updateRequestEventSchema),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!messageParams.safeParse(request.params).success) return reply.status(400).send({ error: 'Invalid request ID', code: 'VALIDATION_ERROR' });
      const req = await requestService.updateRequestEvent(
        id,
        request.body as UpdateRequestEventInput,
        request.userId!,
        request.userRole!,
      );
      return reply.status(200).send(apiData(req));
    },
  );
}
