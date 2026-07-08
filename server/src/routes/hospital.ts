/**
 * BErozgar — Hospital Routes
 *
 * GET    /api/hospitals            — List all active hospitals (public)
 * POST   /api/admin/hospitals      — Create hospital (admin only)
 * PUT    /api/admin/hospitals/:id  — Update hospital (admin only)
 * DELETE /api/admin/hospitals/:id  — Delete hospital (admin only)
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { createHospitalSchema, updateHospitalSchema } from '@/shared/validation';
import type { CreateHospitalInput, UpdateHospitalInput } from '@/shared/validation';
import { apiData } from '@/shared/response';
import * as hospitalService from '@/services/hospitalService';

export async function hospitalRoutes(app: FastifyInstance): Promise<void> {
  /** GET /hospitals — List all active hospitals */
  app.get('/hospitals', async (_request, reply) => {
    const hospitals = await hospitalService.listHospitals();
    return reply.status(200).send(apiData(hospitals));
  });

  /** POST /admin/hospitals — Create hospital (admin only) */
  app.post(
    '/admin/hospitals',
    {
      preHandler: [authenticate, authorize('ADMIN')],
      preValidation: validate(createHospitalSchema),
    },
    async (request, reply) => {
      const hospital = await hospitalService.createHospital(
        request.body as CreateHospitalInput,
      );
      return reply.status(201).send(apiData(hospital));
    },
  );

  /** PUT /admin/hospitals/:id — Update hospital (admin only) */
  app.put(
    '/admin/hospitals/:id',
    {
      preHandler: [authenticate, authorize('ADMIN')],
      preValidation: validate(updateHospitalSchema),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const hospital = await hospitalService.updateHospital(
        id,
        request.body as UpdateHospitalInput,
      );
      return reply.status(200).send(apiData(hospital));
    },
  );

  /** DELETE /admin/hospitals/:id — Delete hospital (admin only) */
  app.delete(
    '/admin/hospitals/:id',
    { preHandler: [authenticate, authorize('ADMIN')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await hospitalService.deleteHospital(id);
      return reply.status(200).send({ message: 'Hospital deleted successfully' });
    },
  );
}
