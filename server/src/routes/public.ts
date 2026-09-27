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
import { answerCampusQuestion, listCampusQuestions } from '@/services/campusQaService';
import { recordCampusQaOutcome } from '@/services/campusQaMetricsService';
import { recordUnmatchedQuery } from '@/services/campusQaGapService';
import { ensureReviewedAnswersFresh } from '@/services/campusQaCorpusService';

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

  /**
   * GET /api/public/campus-qa/questions - the full reviewed question set.
   * Powers suggestion chips and indexable help pages.
   */
  app.get(
    '/campus-qa/questions',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (_request, reply) => {
      reply.header('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
      await ensureReviewedAnswersFresh();
      const questions = listCampusQuestions();
      return reply.status(200).send({ data: questions, meta: { count: questions.length } });
    },
  );

  /**
   * GET /api/public/campus-qa?q=... - deterministic, cited campus Q&A.
   * Anonymous and safe: answers are drawn only from reviewed in-repo documents,
   * never from student records or user-generated content.
   */
  app.get(
    '/campus-qa',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
      const q = (request.query as Record<string, string | undefined>).q;
      if (!q || q.trim().length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          code: 'VALIDATION_ERROR',
          message: 'Query parameter q is required.',
        });
      }
      if (q.length > 200) {
        return reply.status(400).send({
          error: 'Bad Request',
          code: 'VALIDATION_ERROR',
          message: 'Query parameter q must be 200 characters or fewer.',
        });
      }

      // Merge admin-reviewed DB answers (TTL-cached; static corpus serves if the DB is down).
      await ensureReviewedAnswersFresh();
      const result = answerCampusQuestion(q);
      // Wait for best-effort writes rather than losing them on process shutdown.
      // Both helpers contain DB failures; no visitor/query text in the counters.
      await Promise.all([
        recordCampusQaOutcome(result.matched),
        ...(!result.matched ? [recordUnmatchedQuery(q)] : []),
      ]);
      // Shared caches would hide requests from the denominator and can retain
      // sensitive query URLs / withdrawn answers. Suggestions remain cacheable.
      reply.header('Cache-Control', 'private, no-store');
      return reply.status(200).send({ data: result });
    },
  );
}
