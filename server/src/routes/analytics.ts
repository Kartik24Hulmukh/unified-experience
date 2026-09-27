/**
 * BErozgar - Analytics Routes
 *
 * POST /api/analytics/events       — Ingest client telemetry events
 * GET  /api/admin/analytics/funnel — Admin: view funnel metrics
 */

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import * as analyticsService from '@/services/analyticsService';
import { apiData } from '@/shared/response';

const eventNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_.:-]+$/);

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

const funnelQuerySchema = z.object({
  events: z.string().min(1), // CSV: "listing_created,request_sent"
  days: z.coerce.number().int().positive().default(7),
});

function clampRecord(
  input?: Record<string, string | number | boolean | null | Array<string | number | boolean | null>>,
): Record<string, string | number | boolean | null | Array<string | number | boolean | null>> | undefined {
  if (!input) return undefined;

  const out: Record<string, string | number | boolean | null | Array<string | number | boolean | null>> = {};
  let keys = 0;

  for (const [k, v] of Object.entries(input)) {
    if (keys >= 25) break;
    const key = k.slice(0, 64);

    if (typeof v === "string") {
      out[key] = v.slice(0, 500);
    } else if (Array.isArray(v)) {
      out[key] = v.slice(0, 20).map((item) =>
        typeof item === "string" ? item.slice(0, 200) : item,
      );
    } else {
      out[key] = v;
    }

    keys += 1;
  }

  return out;
}

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
      let persistedCount = 0;

      for (const ev of parsed.data.events) {
        try {
          // PHASE0-02: Persist event to database instead of discarding
          await analyticsService.createEvent({
            name: ev.name,
            level: ev.level,
            userId: request.userId,
            userRole: request.userRole,
            properties: clampRecord(ev.properties),
            context: clampRecord(ev.context),
            timestamp: ev.timestamp && ev.timestamp > 0 ? Math.min(ev.timestamp, now + 60_000) : now,
          });
          persistedCount += 1;
        } catch (err) {
          request.log.warn(
            { eventName: ev.name, error: err instanceof Error ? err.message : String(err) },
            'Failed to persist analytics event — continuing',
          );
        }
      }

      const names = [...new Set(parsed.data.events.map((e) => e.name))].slice(0, 10);
      request.log.info(
        {
          analyticsEventCount: parsed.data.events.length,
          analyticsPersisted: persistedCount,
          analyticsEventNames: names,
          hasErrors: parsed.data.events.some((e) => e.level === 'error'),
        },
        'Analytics events processed',
      );

      return reply.status(202).send({
        accepted: true,
        received: persistedCount,
      });
    },
  );

  // Admin funnel metrics endpoint
  app.get(
    '/funnel',
    { preHandler: [authenticate, authorize('ADMIN')] },
    async (request, reply) => {
      const query = request.query as Record<string, string | string[]>;
      
      const eventsParam = typeof query.events === 'string' ? query.events : (query.events?.[0] ?? '');
      const daysParam = typeof query.days === 'string' ? query.days : (query.days?.[0] ?? '7');

      const parsed = funnelQuerySchema.safeParse({ events: eventsParam, days: daysParam });
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid funnel query',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const eventNames = parsed.data.events.split(',').map((e) => e.trim()).filter(Boolean);
      const metrics = await analyticsService.getFunnelMetrics(eventNames, parsed.data.days);

      return reply.status(200).send(apiData({
        metrics,
        days: parsed.data.days,
        eventNames,
      }));
    },
  );
}
