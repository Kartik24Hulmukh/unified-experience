/**
 * BErozgar — requireVerifiedStudent Middleware
 *
 * Ensures the authenticated user has verified their college email (role must not be PUBLIC_USER).
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '@/errors/index';

export async function requireVerifiedStudent(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (request.userRole === 'PUBLIC_USER') {
    request.log.warn(
      { userId: request.userId, url: request.url },
      'PUBLIC_USER blocked from write operation',
    );
    throw new ForbiddenError(
      'College email verification required to perform this action',
    );
  }
}
