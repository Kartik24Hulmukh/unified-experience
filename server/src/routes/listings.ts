/**
 * BErozgar — Listing Routes
 *
 * GET    /api/listings          — List all (filtered)
 * GET    /api/listings/:id      — Single listing
 * POST   /api/listings          — Create listing
 * PATCH  /api/listings/:id/status — Update listing status
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '@/middleware/authenticate';
import { requireVerifiedStudent } from '@/middleware/requireVerifiedStudent';
import { idempotency } from '@/middleware/idempotency';
import { validate } from '@/middleware/validate';
import { createListingSchema, updateListingStatusSchema } from '@/shared/validation';
import type { CreateListingInput, UpdateListingStatusInput } from '@/shared/validation';
import { apiData, apiPage } from '@/shared/response';
import * as listingService from '@/services/listingService';

// Safe parseInt: rejects NaN, negative, and non-finite values to prevent Prisma crashes.
const safeParseInt = (s: string | undefined) => {
  const n = s ? parseInt(s, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export async function listingRoutes(app: FastifyInstance): Promise<void> {
  /** GET /listings — list with optional filters */
  app.get('/listings', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const result = await listingService.listListings({
      status: query.status,
      category: query.category,
      module: query.module,
      limit: safeParseInt(query.limit),
      page: safeParseInt(query.page),
      cursor: query.cursor,
      search: query.search,
    });
    return reply.status(200).send(apiPage(result.listings, result.pagination));
  });

  /** GET /listings/:id — single listing */
  app.get('/listings/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const listing = await listingService.getListing(id);
    return reply.status(200).send(apiData(listing));
  });

  /** POST /listings — create new listing (auth required) */
  app.post(
    '/listings',
    {
      preHandler: [authenticate, requireVerifiedStudent, idempotency],
      preValidation: validate(createListingSchema),
    },
    async (request, reply) => {
      const listing = await listingService.createListing(
        request.body as CreateListingInput,
        request.userId!,
      );
      return reply.status(201).send(apiData(listing));
    },
  );

  /** PATCH /listings/:id/status — update listing status (auth required) */
  app.patch(
    '/listings/:id/status',
    {
      preHandler: [authenticate, requireVerifiedStudent, idempotency],
      preValidation: validate(updateListingStatusSchema),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const listing = await listingService.updateListingStatus(
        id,
        request.body as UpdateListingStatusInput,
        request.userId!,
        request.userRole!,
      );
      return reply.status(200).send(apiData(listing));
    },
  );

  /** PUT /listings/:id — update listing details (auth required) */
  app.put(
    '/listings/:id',
    {
      preHandler: [authenticate, requireVerifiedStudent, idempotency],
      preValidation: validate(createListingSchema),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const listing = await listingService.updateListing(
        id,
        request.body as CreateListingInput,
        request.userId!,
        request.userRole!,
      );
      return reply.status(200).send(apiData(listing));
    },
  );

  /** DELETE /listings/:id — delete listing (auth required) */
  app.delete(
    '/listings/:id',
    { preHandler: [authenticate, requireVerifiedStudent] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await listingService.deleteListing(id, request.userId!, request.userRole!);
      return reply.status(200).send({ message: 'Listing deleted successfully' });
    },
  );
}
