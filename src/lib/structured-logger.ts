/**
 * BErozgar — Structured Logger
 *
 * Production-grade structured logging with JSON output.
 * Replaces console.* calls with typed, filterable log entries.
 *
 * Features:
 * - JSON-structured log entries (parseable by log aggregators)
 * - Severity levels with environment-aware filtering
 * - Request correlation IDs
 * - Performance timing (duration tracking)
 * - Log buffer for batch export to analytics endpoint
 * - Context enrichment (userId, sessionId, route)
 *
 * In development: pretty-prints to console.
 * In production: emits structured JSON, buffers for async export.
 */

import { isDev, isProd } from '@/lib/env';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface StructuredLogEntry {
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Log severity */
  level: LogLevel;
  /** Source module/component */
  source: string;
  /** Human-readable message */
  message: string;
  /** Optional correlation ID for request tracing */
  correlationId?: string;
  /** Optional user context */
  userId?: string;
  /** Duration in ms (for performance tracking) */
  durationMs?: number;
  /** Structured metadata */
  meta?: Record<string, unknown>;
  /** Error details if applicable */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/* ═══════════════════════════════════════════════════
   Configuration
   ═══════════════════════════════════════════════════ */

/** Minimum log level for output (environment-aware) */
const MIN_LEVEL: LogLevel = isDev ? 'DEBUG' : 'WARN';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
};

/** Maximum buffer size before auto-flush */
const MAX_BUFFER_SIZE = 100;

/** Auto-flush interval (30 seconds) */
const FLUSH_INTERVAL_MS = 30_000;

/* ═══════════════════════════════════════════════════
   Log Buffer (for async export)
   ═══════════════════════════════════════════════════ */

const logBuffer: StructuredLogEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

/** Flush buffered logs to analytics endpoint */
async function flushLogs(): Promise<void> {
  if (logBuffer.length === 0) return;

  const batch = logBuffer.splice(0, logBuffer.length);

  if (isProd) {
    try {
      // Non-blocking fire-and-forget POST to analytics
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'structured_logs', entries: batch }),
      }).catch(() => {
        // Silently fail — logging should never break the app
      });
    } catch {
      // Swallow — never let logging crash the app
    }
  }
}

/* ═══════════════════════════════════════════════════
   Context (ambient state enrichment)
   ═══════════════════════════════════════════════════ */

interface LogContext {
  userId?: string;
  sessionId?: string;
  route?: string;
}

let globalContext: LogContext = {};

/** Set ambient log context (call on login, route change) */
export function setLogContext(ctx: Partial<LogContext>): void {
  globalContext = { ...globalContext, ...ctx };
}

/** Clear ambient log context (call on logout) */
export function clearLogContext(): void {
  globalContext = {};
}

/* ═══════════════════════════════════════════════════
   Correlation ID Generator
   ═══════════════════════════════════════════════════ */

let correlationCounter = 0;

/** Generate a short correlation ID for request tracing */
export function generateCorrelationId(): string {
  return `req-${Date.now().toString(36)}-${(++correlationCounter).toString(36)}`;
}

/* ═══════════════════════════════════════════════════
   Performance Timer
   ═══════════════════════════════════════════════════ */

/** Start a performance timer. Returns a function that logs the duration when called. */
export function startTimer(
  source: string,
  operation: string,
  meta?: Record<string, unknown>,
): () => void {
  const start = performance.now();
  return () => {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    structuredLogger.info(source, `${operation} completed`, { ...meta, durationMs });
  };
}

/* ═══════════════════════════════════════════════════
   Core Logger
   ═══════════════════════════════════════════════════ */

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

function createEntry(
  level: LogLevel,
  source: string,
  message: string,
  meta?: Record<string, unknown>,
): StructuredLogEntry {
  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
    ...(globalContext.userId ? { userId: globalContext.userId } : {}),
    ...(meta?.correlationId ? { correlationId: meta.correlationId as string } : {}),
    ...(meta?.durationMs !== undefined ? { durationMs: meta.durationMs as number } : {}),
  };

  // Separate non-reserved meta keys
  if (meta) {
    const reserved = new Set(['correlationId', 'durationMs', 'error']);
    const extraMeta: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(meta)) {
      if (!reserved.has(k)) extraMeta[k] = v;
    }
    if (Object.keys(extraMeta).length > 0) entry.meta = extraMeta;

    // Attach error if present
    if (meta.error instanceof Error) {
      entry.error = {
        name: meta.error.name,
        message: meta.error.message,
        ...(isDev ? { stack: meta.error.stack } : {}),
      };
    }
  }

  return entry;
}

function emit(entry: StructuredLogEntry): void {
  // Console output
  if (isDev) {
    // Pretty-print in development
    const prefix = `[${entry.level}][${entry.source}]`;
    const fn = entry.level === 'ERROR' || entry.level === 'FATAL'
      ? console.error
      : entry.level === 'WARN'
        ? console.warn
        : entry.level === 'DEBUG'
          ? console.debug
          : console.info;
    const parts: unknown[] = [prefix, entry.message];
    if (entry.durationMs !== undefined) parts.push(`(${entry.durationMs}ms)`);
    if (entry.meta) parts.push(entry.meta);
    if (entry.error) parts.push(entry.error);
    fn(...parts);
  } else {
    // Structured JSON in production (parseable by log aggregators)
    const fn = entry.level === 'ERROR' || entry.level === 'FATAL' ? console.error : console.warn;
    fn(JSON.stringify(entry));
  }

  // Buffer for async export
  logBuffer.push(entry);
  if (logBuffer.length >= MAX_BUFFER_SIZE) {
    flushLogs();
  }
}

/* ═══════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════ */

export const structuredLogger = {
  debug(source: string, message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog('DEBUG')) return;
    emit(createEntry('DEBUG', source, message, meta));
  },

  info(source: string, message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog('INFO')) return;
    emit(createEntry('INFO', source, message, meta));
  },

  warn(source: string, message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog('WARN')) return;
    emit(createEntry('WARN', source, message, meta));
  },

  error(source: string, message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog('ERROR')) return;
    emit(createEntry('ERROR', source, message, meta));
  },

  fatal(source: string, message: string, meta?: Record<string, unknown>): void {
    emit(createEntry('FATAL', source, message, meta));
    // Fatal logs flush immediately
    flushLogs();
  },

  /** Start auto-flush timer */
  startFlushTimer(): void {
    if (flushTimer) return;
    flushTimer = setInterval(flushLogs, FLUSH_INTERVAL_MS);
  },

  /** Stop auto-flush and flush remaining */
  stopFlushTimer(): void {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    flushLogs();
  },

  /** Force flush buffered logs now */
  flush: flushLogs,
} as const;

export default structuredLogger;
