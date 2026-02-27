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
      // SEC-INFO-01 & INFO-02: log the detailed reason server-side only.
      // Never leak which roles are required or what role the actor has
      // in the HTTP response body — that aids targeted escalation probes.
      request.log.warn(
        { actorRole: request.userRole, requiredRoles: allowedRoles, url: request.url },
        'Authorization failed',
      );
      throw new ForbiddenError('Insufficient permissions');
    }
  };
}
