/**
 * BErozgar - Analytics Routes
 *
 * POST /api/analytics/events - Ingest client telemetry events.
 */

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

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

function clampRecord(
  input?: Record<string, string | number | boolean | null | Array<string | number | boolean | null>>,
): Record<string, string | number | boolean | null | Array<string | number | boolean | null>> | undefined {
  if (!input) return undefined;

  const out: Record<string, string | number | boolean | null | Array<string | number | boolean | null>> = {};
  let keys = 0;

  for (const [k, v] of Object.entries(input)) {
    if (keys >= 25) break;
    const key = k.slice(0, 64);

    if (typeof v === 'string') {
      out[key] = v.slice(0, 500);
    } else if (Array.isArray(v)) {
      out[key] = v.slice(0, 20).map((item) =>
        typeof item === 'string' ? item.slice(0, 200) : item,
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
          max: 30,
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
      const events = parsed.data.events.map((ev) => ({
        name: ev.name,
        level: ev.level,
        timestamp: ev.timestamp && ev.timestamp > 0 ? Math.min(ev.timestamp, now + 60_000) : now,
        properties: clampRecord(ev.properties),
        context: clampRecord(ev.context),
        user: ev.user
          ? {
              id: ev.user.id.slice(0, 128),
              role: ev.user.role?.slice(0, 64),
            }
          : undefined,
      }));

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
