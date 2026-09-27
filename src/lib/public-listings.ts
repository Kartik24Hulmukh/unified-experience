/**
 * Public discovery client (APODEX priority 6, frontend half).
 *
 * Talks ONLY to GET /api/public/listings, which returns a minimal DTO
 * ({id,title,category,module,price,status,createdAt}) of APPROVED listings.
 * We re-whitelist fields client-side as defence in depth so that a future
 * server regression can never leak owner identity into the signed-out landing page.
 */
import { api } from '@/lib/api-client';

export interface PublicListing {
  id: string;
  title: string;
  category: string;
  module: string;
  price: number | null;
  createdAt: string;
}

const MODULE_LABELS: Record<string, string> = {
  RESALE: 'Resale',
  ACCOMMODATION: 'Stay',
  ACADEMICS: 'Academics',
  MESS: 'Mess',
  HOSPITAL: 'Health',
};

export function moduleLabel(module: string): string {
  return MODULE_LABELS[module?.toUpperCase?.()] ?? 'Campus';
}

export function buildPublicListingsPath(opts: { limit?: number; module?: string; search?: string } = {}): string {
  const params = new URLSearchParams();
  const limit = Math.min(50, Math.max(1, Math.trunc(opts.limit ?? 8)));
  params.set('limit', String(limit));
  if (opts.module) params.set('module', opts.module.toUpperCase());
  const search = opts.search?.trim().slice(0, 80);
  if (search) params.set('search', search);
  return `/public/listings?${params.toString()}`;
}

/** Keep only well-formed APPROVED items and only whitelisted fields. */
export function sanitizePublicListings(raw: unknown): PublicListing[] {
  if (!Array.isArray(raw)) return [];
  const out: PublicListing[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.title !== 'string') continue;
    if (r.status !== undefined && r.status !== 'APPROVED') continue;
    const priceNum = r.price === null || r.price === undefined ? null : Number(r.price);
    out.push({
      id: r.id,
      title: r.title.slice(0, 120),
      category: typeof r.category === 'string' ? r.category.slice(0, 60) : '',
      module: typeof r.module === 'string' ? r.module : '',
      price: priceNum !== null && Number.isFinite(priceNum) ? priceNum : null,
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
    });
  }
  return out;
}

export function formatPublicPrice(price: number | null): string {
  if (price === null) return 'Ask';
  if (price <= 0) return 'Free';
  return `₹${Math.round(price).toLocaleString('en-IN')}`;
}

export function relativeAge(createdAt: string, now: number = Date.now()): string {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return '';
  const mins = Math.max(0, Math.floor((now - t) / 60000));
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export async function fetchPublicListings(limit = 8, signal?: AbortSignal): Promise<PublicListing[]> {
  const res = await api.get<{ data: unknown }>(buildPublicListingsPath({ limit }), {
    skipAuth: true,
    signal,
    timeout: 8000,
  });
  return sanitizePublicListings(res?.data);
}
