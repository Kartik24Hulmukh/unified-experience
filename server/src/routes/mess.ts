/**
 * BErozgar — Mess Routes
 *
 * GET    /api/mess            — List all active mess providers (public)
 * POST   /api/admin/mess      — Create mess provider (admin only)
 * PUT    /api/admin/mess/:id  — Update mess provider (admin only)
 * DELETE /api/admin/mess/:id  — Delete mess provider (admin only)
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { createMessProviderSchema, updateMessProviderSchema } from '@/shared/validation';
import type { CreateMessProviderInput, UpdateMessProviderInput } from '@/shared/validation';
import { apiData } from '@/shared/response';
import * as messService from '@/services/messService';

export async function messRoutes(app: FastifyInstance): Promise<void> {
  /** GET /mess — List all active mess providers */
  app.get('/mess', async (_request, reply) => {
    const providers = await messService.listMessProviders();
    return reply.status(200).send(apiData(providers));
  });

  /** POST /admin/mess — Create mess provider (admin only) */
  app.post(
    '/admin/mess',
    {
      preHandler: [authenticate, authorize('ADMIN')],
      preValidation: validate(createMessProviderSchema),
    },
    async (request, reply) => {
      const provider = await messService.createMessProvider(
        request.body as CreateMessProviderInput,
      );
      return reply.status(201).send(apiData(provider));
    },
  );

  /** PUT /admin/mess/:id — Update mess provider (admin only) */
  app.put(
    '/admin/mess/:id',
    {
      preHandler: [authenticate, authorize('ADMIN')],
      preValidation: validate(updateMessProviderSchema),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const provider = await messService.updateMessProvider(
        id,
        request.body as UpdateMessProviderInput,
      );
      return reply.status(200).send(apiData(provider));
    },
  );

  /** DELETE /admin/mess/:id — Delete mess provider (admin only) */
  app.delete(
    '/admin/mess/:id',
    { preHandler: [authenticate, authorize('ADMIN')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await messService.deleteMessProvider(id);
      return reply.status(200).send({ message: 'Mess provider deleted successfully' });
    },
  );
}
