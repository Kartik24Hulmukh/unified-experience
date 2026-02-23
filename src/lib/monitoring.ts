/**
 * BErozgar - Client Monitoring and Telemetry
 *
 * Provides a concrete monitoring layer that always captures local diagnostics
 * and can forward analytics/error events to the backend ingestion endpoint.
 */

import logger from '@/lib/logger';
import { env } from '@/lib/env';

interface MonitoringUser {
  id: string;
  email: string;
  role?: string;
}

interface AnalyticsEvent {
  name: string;
  level: 'info' | 'warning' | 'error';
  timestamp: number;
  properties?: Record<string, unknown>;
  context?: Record<string, unknown>;
  user?: {
    id: string;
    role?: string;
  };
}

const INGEST_ENDPOINT = '/api/analytics/events';
const MAX_BUFFER_SIZE = 200;
const MAX_BATCH_SIZE = 25;
const FLUSH_INTERVAL_MS = 5000;

let initialized = false;
let currentUser: MonitoringUser | null = null;
const analyticsBuffer: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const breadcrumbRing: Array<{ category: string; message: string; ts: number }> = [];
const MAX_BREADCRUMBS = 25;

function sanitizeValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitizeValue);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    let count = 0;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (count >= 25) break;
      out[k.slice(0, 64)] = sanitizeValue(v);
      count += 1;
    }
    return out;
  }
  return String(value).slice(0, 500);
}

function sanitizeRecord(record?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!record) return undefined;
  return sanitizeValue(record) as Record<string, unknown>;
}

function enqueueEvent(event: AnalyticsEvent): void {
  if (analyticsBuffer.length >= MAX_BUFFER_SIZE) {
    analyticsBuffer.shift();
  }
  analyticsBuffer.push(event);
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer) return;

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAnalyticsBuffer();
  }, FLUSH_INTERVAL_MS);
}

async function flushAnalyticsBuffer(): Promise<void> {
  if (!env.VITE_ENABLE_ANALYTICS) return;
  if (analyticsBuffer.length === 0) return;

  const events = analyticsBuffer.splice(0, MAX_BATCH_SIZE);
  const payload = JSON.stringify({ events });

  try {
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator && document.visibilityState === 'hidden') {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(INGEST_ENDPOINT, blob);
      return;
    }

    await fetch(INGEST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
      credentials: 'include',
    });
  } catch {
    // Requeue once on failure to avoid silent loss during transient issues.
    for (const ev of events.reverse()) {
      if (analyticsBuffer.length < MAX_BUFFER_SIZE) analyticsBuffer.unshift(ev);
    }
  }

  if (analyticsBuffer.length > 0) scheduleFlush();
}

function baseEvent(level: 'info' | 'warning' | 'error', name: string): AnalyticsEvent {
  return {
    name,
    level,
    timestamp: Date.now(),
    user: currentUser
      ? { id: currentUser.id, role: currentUser.role }
      : undefined,
  };
}

export function initMonitoring(): void {
  if (initialized) return;
  initialized = true;

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        void flushAnalyticsBuffer();
      }
    });
  }

  logger.info('Monitoring', `Monitoring initialized (analytics=${env.VITE_ENABLE_ANALYTICS})`);
}

export function identifyUser(user: MonitoringUser): void {
  currentUser = user;
}

export function clearUser(): void {
  currentUser = null;
}

export function captureException(error: Error, context?: Record<string, unknown>): void {
  const breadcrumbSnapshot = breadcrumbRing.slice(-10);
  logger.error('Exception', error.message, {
    stack: error.stack,
    ...context,
    breadcrumbs: breadcrumbSnapshot,
  });

  enqueueEvent({
    ...baseEvent('error', 'client_exception'),
    properties: sanitizeRecord({
      message: error.message,
      name: error.name,
      stack: error.stack,
    }),
    context: sanitizeRecord({
      ...context,
      breadcrumbs: breadcrumbSnapshot,
    }),
  });
}

export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
): void {
  const logFn = level === 'error' ? logger.error : level === 'warning' ? logger.warn : logger.info;
  logFn('Monitoring', message);

  enqueueEvent({
    ...baseEvent(level, 'client_message'),
    properties: { message: message.slice(0, 500) },
  });
}

export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  breadcrumbRing.push({
    category: category.slice(0, 64),
    message: message.slice(0, 200),
    ts: Date.now(),
  });

  if (breadcrumbRing.length > MAX_BREADCRUMBS) breadcrumbRing.shift();

  if (data) {
    logger.debug('Breadcrumb', `${category}: ${message}`, sanitizeRecord(data));
  }
}

export function trackEvent(
  name: string,
  properties?: Record<string, unknown>,
): void {
  if (!env.VITE_ENABLE_ANALYTICS) return;

  enqueueEvent({
    ...baseEvent('info', name.slice(0, 64)),
    properties: sanitizeRecord(properties),
  });
}

export function trackPageView(path: string): void {
  trackEvent('page_view', {
    path: path.slice(0, 300),
    referrer: document.referrer?.slice(0, 300) || '',
  });
  addBreadcrumb('navigation', `Navigated to ${path}`);
}
