import { describe, expect, it } from 'vitest';

import type { Listing, PendingItem, Dispute, AuditLogEntry, FraudDashboardData } from '@/hooks/api/useApi';
import {
  filterAdminAuditLogs,
  filterAdminDisputes,
  filterAdminFraudUsers,
  filterAdminPendingListings,
  getAdminSearchConfig,
} from '@/lib/admin-console';
import { getBrowseVisibleListings } from '@/lib/browse-listings';

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    title: 'Signals Textbook',
    price: '250',
    category: 'books',
    module: 'resale',
    status: 'APPROVED',
    createdAt: '2026-03-10T10:00:00.000Z',
    ...overrides,
  };
}

function makePendingItem(overrides: Partial<PendingItem> = {}): PendingItem {
  return {
    id: 'pending-1',
    title: 'Laptop Stand',
    price: '500',
    status: 'PENDING_REVIEW',
    createdAt: '2026-03-10T10:00:00.000Z',
    owner: { id: 'user-1', fullName: 'Asha Student', email: 'asha@mctrgit.ac.in' },
    ...overrides,
  };
}

function makeDispute(overrides: Partial<Dispute> = {}): Dispute {
  return {
    id: 'dispute-1',
    type: 'fraud',
    status: 'OPEN',
    raisedById: 'user-1',
    againstId: 'user-2',
    description: 'Item was never delivered',
    createdAt: '2026-03-10T10:00:00.000Z',
    ...overrides,
  };
}

function makeAuditLog(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'audit-1',
    timestamp: '2026-03-10T10:00:00.000Z',
    actorId: 'admin-1',
    actorRole: 'ADMIN',
    action: 'SYSTEM_RECOVERY',
    targetType: 'system',
    targetId: 'system-1',
    details: 'Recovered stale transactions',
    ...overrides,
  };
}

describe('admin console and browse helpers', () => {
  it('shows only approved listings in browse views', () => {
    const listings = [
      makeListing({ id: 'approved-1', status: 'APPROVED' }),
      makeListing({ id: 'pending-1', status: 'PENDING_REVIEW' }),
      makeListing({ id: 'rejected-1', status: 'REJECTED' }),
    ];

    expect(getBrowseVisibleListings(listings).map((listing) => listing.id)).toEqual(['approved-1']);
  });

  it('uses tab-scoped search placeholders and disables unsupported tabs', () => {
    expect(getAdminSearchConfig('pending')).toEqual({ enabled: true, placeholder: 'Search pending listings...' });
    expect(getAdminSearchConfig('disputes')).toEqual({ enabled: true, placeholder: 'Search disputes...' });
    expect(getAdminSearchConfig('logs')).toEqual({ enabled: true, placeholder: 'Search audit logs...' });
    expect(getAdminSearchConfig('fraud')).toEqual({ enabled: true, placeholder: 'Search fraud flags...' });
    expect(getAdminSearchConfig('users')).toEqual({ enabled: true, placeholder: 'Search users by name or email...' });
    expect(getAdminSearchConfig('activity')).toEqual({ enabled: false, placeholder: 'Search unavailable on this tab' });
  });

  it('filters pending listings by title and owner name', () => {
    const results = filterAdminPendingListings([
      makePendingItem({ id: 'one', title: 'Laptop Stand', owner: { id: 'user-1', fullName: 'Asha Student', email: 'asha@mctrgit.ac.in' } }),
      makePendingItem({ id: 'two', title: 'Circuit Book', owner: { id: 'user-2', fullName: 'Rahul Test', email: 'rahul@mctrgit.ac.in' } }),
    ], 'asha');

    expect(results.map((item) => item.id)).toEqual(['one']);
  });

  it('filters disputes, audit logs, and fraud users with tab-specific matching', () => {
    expect(filterAdminDisputes([
      makeDispute({ id: 'fraud-1', description: 'Seller vanished after payment', type: 'fraud' }),
      makeDispute({ id: 'other-1', description: 'Meal was cold', type: 'other' }),
    ], 'seller').map((item) => item.id)).toEqual(['fraud-1']);

    expect(filterAdminAuditLogs([
      makeAuditLog({ id: 'audit-1', action: 'SYSTEM_RECOVERY', details: 'Recovered stale transactions' }),
      makeAuditLog({ id: 'audit-2', action: 'LISTING_APPROVED', details: 'Approved a listing' }),
    ], 'recovered').map((item) => item.id)).toEqual(['audit-1']);

    const fraudUsers: FraudDashboardData['flaggedUsers'] = [
      { userId: 'user-1', email: 'asha@mctrgit.ac.in', fullName: 'Asha Student', riskLevel: 'HIGH', flags: ['chargeback'], trust: 'REVIEW_REQUIRED', activeDisputes: 2 },
      { userId: 'user-2', email: 'rahul@mctrgit.ac.in', fullName: 'Rahul Test', riskLevel: 'MEDIUM', flags: ['spam'], trust: 'GOOD_STANDING', activeDisputes: 0 },
    ];

    expect(filterAdminFraudUsers(fraudUsers, 'chargeback').map((item) => item.userId)).toEqual(['user-1']);
  });
});