import { describe, it, expect } from 'vitest';
import {
  buildPublicListingsPath,
  sanitizePublicListings,
  formatPublicPrice,
  relativeAge,
  moduleLabel,
} from '@/lib/public-listings';

describe('public listings client', () => {
  it('clamps limit and caps search', () => {
    expect(buildPublicListingsPath({ limit: 500 })).toBe('/public/listings?limit=50');
    expect(buildPublicListingsPath({ limit: 0 })).toBe('/public/listings?limit=1');
    const p = buildPublicListingsPath({ search: 'x'.repeat(200), module: 'resale' });
    expect(p).toContain('module=RESALE');
    expect(new URLSearchParams(p.split('?')[1]).get('search')!.length).toBe(80);
  });

  it('strips owner identity and non-approved rows', () => {
    const out = sanitizePublicListings([
      { id: 'a', title: 'Drafter', category: 'Tools', module: 'RESALE', price: '250', status: 'APPROVED', createdAt: '2026-09-27T00:00:00Z', owner: { id: 'u1', fullName: 'Leak' }, requests: [{ buyerId: 'b' }] },
      { id: 'b', title: 'Hidden', status: 'PENDING_REVIEW' },
      { title: 'no id' },
      null,
    ]);
    expect(out).toHaveLength(1);
    expect(Object.keys(out[0]).sort()).toEqual(['category', 'createdAt', 'id', 'module', 'price', 'title']);
    expect(out[0].price).toBe(250);
    expect(JSON.stringify(out)).not.toContain('Leak');
  });

  it('returns [] for malformed payloads', () => {
    expect(sanitizePublicListings(undefined)).toEqual([]);
    expect(sanitizePublicListings({ data: [] })).toEqual([]);
  });

  it('formats price and age', () => {
    expect(formatPublicPrice(null)).toBe('Ask');
    expect(formatPublicPrice(0)).toBe('Free');
    expect(formatPublicPrice(1500)).toBe('₹1,500');
    const now = Date.parse('2026-09-27T12:00:00Z');
    expect(relativeAge('2026-09-27T11:30:00Z', now)).toBe('30m ago');
    expect(relativeAge('2026-09-25T12:00:00Z', now)).toBe('2d ago');
    expect(relativeAge('garbage', now)).toBe('');
    expect(moduleLabel('resale')).toBe('Resale');
    expect(moduleLabel('???')).toBe('Campus');
  });
});
