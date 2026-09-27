/**
 * BErozgar - Analytics Routes
 *
 * POST /api/analytics/events - Ingest client telemetry events.
 */

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { FastifyInstance } from 'fastify';

// Fixed vocabulary prevents contact details/queries being smuggled into event names.
const eventNameSchema = z.enum(['page_view', 'client_exception', 'client_message',
  'listing_view', 'listing_created', 'request_sent', 'request_accepted', 'exchange_completed']);

const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const eventSchema = z.object({
  name: eventNameSchema,
  level: z.enum(['info', 'warning', 'error']).default('info'),
  timestamp: z.number().int().positive().optional(),
  properties: z.record(z.union([scalarSchema, z.array(scalarSchema)])).optional(),
  context: z.record(z.union([scalarSchema, z.array(scalarSchema)])).optional(),
  user: z
    .object({
      id: z.string().min(1).max(128),
      role: z.string().min(1).max(64).optional(),
    })
    .optional(),
});

const analyticsPayloadSchema = z.object({
  events: z.array(eventSchema).min(1).max(100),
});

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/events',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parsed = analyticsPayloadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid analytics payload',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const now = Date.now();
      // Discard arbitrary properties/context/body user identity: these can contain PII.
      // Server receipt time is authoritative; client time is diagnostic and bounded.
      const events = parsed.data.events.map((ev) => ({
        name: ev.name,
        level: ev.level,
        occurredAt: new Date(Math.max(now - 86400000, Math.min(ev.timestamp ?? now, now))),
        userId: request.userId ?? null,
      }));
      // Await durable storage BEFORE acknowledging acceptance. On failure the API
      // returns an error rather than falsely claiming that evidence was retained.
      await prisma.analyticsEvent.createMany({ data: events });

      const names = [...new Set(events.map((e) => e.name))].slice(0, 10);
      request.log.info(
        {
          analyticsEventCount: events.length,
          analyticsEventNames: names,
          hasErrors: events.some((e) => e.level === 'error'),
        },
        'Analytics events ingested',
      );

      return reply.status(202).send({
        accepted: true,
        received: events.length,
      });
    },
  );
}
