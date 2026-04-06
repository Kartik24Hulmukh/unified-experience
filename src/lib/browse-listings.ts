import type { Listing } from '@/hooks/api/useApi';

export function isBrowseVisibleListing(listing: Pick<Listing, 'status'>): boolean {
  // Server normalizes enums to lowercase in shared/response.ts, so we check for 'approved'
  return listing.status.toLowerCase() === 'approved';
}

export function getBrowseVisibleListings<T extends Pick<Listing, 'status'>>(listings: T[]): T[] {
  return listings.filter(isBrowseVisibleListing);
}

export function countBrowseListingsByCategory<T extends Pick<Listing, 'status' | 'category'>>(
  listings: T[],
): Record<string, number> {
  return getBrowseVisibleListings(listings).reduce<Record<string, number>>((counts, listing) => {
    const key = listing.category.toLowerCase();
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}
