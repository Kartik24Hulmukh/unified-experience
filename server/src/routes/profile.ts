/**
 * BErozgar — Profile Routes
 *
 * GET /api/profile — current user profile with trust/restriction
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '@/middleware/authenticate';
import { apiData } from '@/shared/response';
import * as profileService from '@/services/profileService';

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  /** GET /profile — current user profile */
  app.get(
    '/profile',
    { preHandler: authenticate },
    async (request, reply) => {
      const profile = await profileService.getProfile(request.userId!);
      return reply.status(200).send(apiData(profile));
    },
  );
}
