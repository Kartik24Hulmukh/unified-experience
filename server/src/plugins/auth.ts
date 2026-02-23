/**
 * BErozgar — Auth Plugin (JWT Verification)
 *
 * Fastify plugin that decorates requests with user identity.
 * Does NOT enforce auth — that's the authenticate middleware's job.
 * This plugin simply parses the token if present.
 */

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { verifyAccessToken, type AccessTokenPayload } from '@/lib/jwt';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    userEmail?: string;
    userRole?: string;
    tokenPayload?: AccessTokenPayload;
  }
}

async function authPlugin(app: FastifyInstance): Promise<void> {
  app.decorateRequest('userId', undefined);
  app.decorateRequest('userEmail', undefined);
  app.decorateRequest('userRole', undefined);
  app.decorateRequest('tokenPayload', undefined);

  app.addHook('onRequest', async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return;

    const token = authHeader.slice(7);
    try {
      const payload = verifyAccessToken(token);
      request.userId = payload.sub;
      request.userEmail = payload.email;
      request.userRole = payload.role;
      request.tokenPayload = payload;
    } catch {
      // Token invalid/expired — don't throw here.
      // The authenticate middleware will enforce if the route requires auth.
    }
  });
}

export default fp(authPlugin, {
  name: 'auth-plugin',
  fastify: '5.x',
});
