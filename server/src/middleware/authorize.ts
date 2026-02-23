/**
 * BErozgar — Authorization Middleware
 *
 * Role-based access control. Used after authenticate middleware.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '@/errors/index';

/**
 * Factory that creates an authorization hook for the specified roles.
 *
 * Usage:
 *   { preHandler: [authenticate, authorize('ADMIN')] }
 */
export function authorize(
  ...allowedRoles: string[]
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.userRole || !allowedRoles.includes(request.userRole)) {
      throw new ForbiddenError(
        `Role '${request.userRole ?? 'unknown'}' is not authorized. Required: ${allowedRoles.join(', ')}`,
      );
    }
  };
}
