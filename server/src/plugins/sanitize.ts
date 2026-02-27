/**
 * BErozgar — Input Sanitization
 *
 * Strips potentially dangerous HTML/script content from string inputs.
 * Applied as a Fastify preHandler hook on all routes.
 *
 * Strategy: regex-based tag stripping (no external deps).
 * This is a defense-in-depth measure — Prisma's parameterized queries
 * already prevent SQL injection, and React escapes output by default.
 */

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';

/* ═══════════════════════════════════════════════════
   Sanitizer
   ═══════════════════════════════════════════════════ */

// Matches <script>, <iframe>, <object>, <embed>, <form>, event handlers, etc.
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // <script>...</script>
  /<\/?(?:script|iframe|object|embed|form|link|meta|base|applet)\b[^>]*>/gi, // dangerous tags
  /on\w+\s*=\s*["'][^"']*["']/gi,        // event handlers: onclick="..."
  /javascript\s*:/gi,                      // javascript: protocol
  /data\s*:\s*text\/html/gi,              // data:text/html injection
  /vbscript\s*:/gi,                        // vbscript: protocol
  /expression\s*\(/gi,                    // CSS expression()
];

/**
 * Sanitize a single string value — strips dangerous HTML patterns.
 * SEC-XSS-01: runs iteratively until stable (max 5 passes).
 * A single pass cannot handle double-wrapped payloads like:
 *   <<script>script>alert(1)<</script>/script>
 * which after one strip becomes <script>alert(1)</script>.
 */
export function sanitizeString(input: string): string {
  let result = input;
  let previous: string;
  let passes = 0;
  const MAX_PASSES = 5;

  do {
    previous = result;
    for (const pattern of DANGEROUS_PATTERNS) {
      result = result.replace(pattern, '');
    }
    // Encode any remaining angle-bracket tags in suspicious positions
    result = result.replace(/<(\/?[a-zA-Z])/g, '&lt;$1');
    passes++;
  } while (result !== previous && passes < MAX_PASSES);

  return result;
}

/**
 * Recursively sanitize all string values in an object or array.
 * Non-string primitive values pass through unchanged.
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = sanitizeValue(val);
    }
    return result;
  }
  return value;
}

/**
 * Sanitize request body — only processes JSON object/array bodies.
 */
function sanitizeBody(request: FastifyRequest): void {
  if (
    request.body &&
    typeof request.body === 'object' &&
    request.headers['content-type']?.includes('application/json')
  ) {
    request.body = sanitizeValue(request.body);
  }
}

/* ═══════════════════════════════════════════════════
   Plugin
   ═══════════════════════════════════════════════════ */

/**
 * Sanitize URL query parameters.
 * SEC-XSS-02: the original sanitizer only sanitized JSON body.
 * XSS payloads in query strings (e.g. ?category=<script>...) passed through.
 */
function sanitizeQuery(request: FastifyRequest): void {
  if (request.query && typeof request.query === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(request.query as Record<string, unknown>)) {
      sanitized[key] = sanitizeValue(val);
    }
    (request as any).query = sanitized;
  }
}

async function sanitizePlugin(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request) => {
    sanitizeBody(request);
    sanitizeQuery(request);
  });
}

export default fp(sanitizePlugin, {
  name: 'sanitize',
  fastify: '5.x',
});
