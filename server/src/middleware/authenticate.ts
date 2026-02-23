/**
 * BErozgar — Authenticate Middleware
 *
 * Enforces authentication. Throws 401 if no valid token is present.
 * Must be used AFTER the auth plugin has decoded the token.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '@/errors/index';

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (!request.userId) {
    throw new UnauthorizedError('Authentication required');
  }
}
