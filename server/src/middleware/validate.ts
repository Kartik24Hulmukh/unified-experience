/**
 * BErozgar — Zod Validation Middleware
 *
 * Factory that creates a preValidation hook from a Zod schema.
 * Parsed data is attached to request.body (replacing raw input).
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '@/errors/index';

/**
 * Create a Fastify preValidation hook that validates request.body
 * against the provided Zod schema.
 *
 * Usage:
 *   { preValidation: validate(createListingSchema) }
 */
export function validate<T>(
  schema: ZodSchema<T>,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      const details = formatZodError(result.error);
      throw new ValidationError('Validation failed', details);
    }

    // Replace raw body with parsed (trimmed, coerced) data
    (request as any).body = result.data;
  };
}

/**
 * Convert ZodError into a { field: [messages] } map.
 */
function formatZodError(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(issue.message);
  }

  return details;
}
