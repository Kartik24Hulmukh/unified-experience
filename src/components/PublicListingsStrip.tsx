/**
 * "What's on campus now" — signed-out landing strip backed by /api/public/listings.
 * Renders nothing on error or when there is no real supply: we never show
 * placeholder/fake listings to anonymous visitors.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchPublicListings,
  formatPublicPrice,
  moduleLabel,
  relativeAge,
  type PublicListing,
} from '@/lib/public-listings';

export function PublicListingsStrip({ limit = 8 }: { limit?: number }) {
  const [items, setItems] = useState<PublicListing[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchPublicListings(limit, ctrl.signal)
      .then(setItems)
      .catch(() => setItems([]));
    return () => ctrl.abort();
  }, [limit]);

  if (!items || items.length === 0) return null;

  return (
    <section
      aria-label="Live campus listings"
      data-testid="public-listings-strip"
      className="relative z-30 mt-10 w-full max-w-5xl px-6 md:px-12 pointer-events-auto"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-white/40 text-[10px] font-mono tracking-[0.3em] uppercase">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
          What&apos;s on campus now
        </p>
        <Link to="/signup" className="text-white/40 hover:text-white text-[10px] font-mono tracking-[0.3em] uppercase">
          Verify to trade →
        </Link>
      </div>
      <ul className="flex gap-3 overflow-x-auto pb-2 snap-x" role="list">
        {items.map((l) => (
          <li key={l.id} className="snap-start shrink-0 w-56">
            <Link
              to="/signup"
              state={{ intent: 'public-listing', listingId: l.id }}
              className="block rounded-md border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:border-white/30"
            >
              <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-white/35">
                {moduleLabel(l.module)}{l.category ? ` · ${l.category}` : ''}
              </p>
              <p className="mt-1 truncate text-sm text-white/85 font-body" title={l.title}>{l.title}</p>
              <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                <span className="text-white">{formatPublicPrice(l.price)}</span>
                <span className="text-white/30">{relativeAge(l.createdAt)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default PublicListingsStrip;
