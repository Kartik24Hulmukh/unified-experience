/**
 * BErozgar — Authenticate Middleware
 *
 * Enforces authentication. Throws 401 if no valid token is present.
 * Must be used AFTER the auth plugin has decoded the token.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError, ForbiddenError } from '@/errors/index';
import { prisma } from '@/lib/prisma';

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (!request.userId) {
    throw new UnauthorizedError('Authentication required');
  }

  // P0-SEC-009 FIX: Enforce user restriction globally in middleware.
  // This ensures RESTRICTED users are blocked from authenticated APIs,
  // preventing them from bypassing UI blocks via direct API calls.
  // We exclude safe paths that users need access to even when restricted.
  const safePaths = [
    '/profile',
    '/auth/logout',
    '/profile/link-college-email'
  ];

  if (request.routeOptions?.url && !safePaths.some((p) => request.routeOptions!.url!.endsWith(p))) {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { isRestricted: true },
    });

    if (user?.isRestricted) {
      throw new ForbiddenError('Your account has been restricted from performing this action');
    }
  }
}
