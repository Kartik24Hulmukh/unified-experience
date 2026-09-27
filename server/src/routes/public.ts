/**
 * BErozgar — Public read-only discovery (APODEX priority 6)
 *
 * GET /api/public/listings — anonymous, cacheable browse of APPROVED listings.
 *
 * Deliberately narrow DTO: no owner id/name/email, no request rows, no
 * moderation states. Lets prospective students and search engines see real
 * campus supply before signup without weakening the verified-exchange model.
 */

import type { FastifyInstance } from 'fastify';
import { ListingModule } from '@prisma/client';
import * as listingService from '@/services/listingService';

const VALID_MODULES = new Set<string>(Object.values(ListingModule));
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/listings',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const q = request.query as Record<string, string | undefined>;

      const module = q.module?.toUpperCase();
      if (module && !VALID_MODULES.has(module)) {
        return reply.status(400).send({
          error: 'Bad Request',
          code: 'VALIDATION_ERROR',
          message: `Invalid module parameter. Must be one of: ${[...VALID_MODULES].join(', ')}`,
        });
      }
      if (q.cursor && !UUID_REGEX.test(q.cursor)) {
        return reply.status(400).send({
          error: 'Bad Request',
          code: 'VALIDATION_ERROR',
          message: 'Invalid cursor parameter.',
        });
      }
      const limitNum = q.limit ? Number.parseInt(q.limit, 10) : undefined;
      const category = q.category?.trim().slice(0, 60) || undefined;
      const search = q.search?.trim().slice(0, 80) || undefined;

      const result = await listingService.listPublicListings({
        module,
        category,
        search,
        cursor: q.cursor,
        limit: Number.isFinite(limitNum) ? limitNum : undefined,
      });

      reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      reply.header('Vary', 'Accept-Encoding');
      return reply.status(200).send({
        data: result.items,
        meta: { nextCursor: result.nextCursor, count: result.items.length },
      });
    },
  );
}
