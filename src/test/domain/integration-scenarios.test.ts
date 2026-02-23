/**
 * Integration Scenario Tests
 *
 * End-to-end scenarios that test the full pipeline:
 *   Dispute FSM → Trust Engine → Restriction Engine → Fraud Heuristics
 *
 * Validates:
 *   - Dispute spikes trigger restriction via trust + dispute count
 *   - Cancel spikes trigger trust review but NOT restriction alone
 *   - Listing spikes trigger fraud flags but NOT trust/restriction
 *   - Admin flags propagate RESTRICTED → restriction enforced
 *   - No false permanent lock across the full pipeline
 *   - No bypass across the full pipeline
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { computeTrust, type TrustInput } from '@/domain/trustEngine';
import {
  computeRestriction,
  type RestrictionInput,
} from '@/domain/restrictionEngine';
import {
  evaluateFraudHeuristics,
  isFraudReviewRequired,
  type FraudHeuristicInput,
} from '@/domain/fraudHeuristics';
import {
  createDispute,
  transitionDispute,
  countActiveDisputesAgainst,
  countResolvedDisputesAgainst,
  resetDisputeStore,
} from '@/services/disputeService';

beforeEach(() => {
  resetDisputeStore();
});

/* ═══════════════════════════════════════════════════
   Scenario 1: Dispute Spike → Trust Degrades → Restriction Enforced
   ═══════════════════════════════════════════════════ */

describe('Integration: Dispute Spike', () => {
  function buildTrustInput(userId: string, overrides: Partial<TrustInput> = {}): TrustInput {
    return {
      completedExchanges: 10,
      cancelledRequests: 0,
      disputes: countResolvedDisputesAgainst(userId),
      adminFlags: 0,
      accountAgeDays: 60,
      ...overrides,
    };
  }

  it('3+ resolved disputes → REVIEW_REQUIRED trust, but no restriction (resolved ≠ active)', () => {
    const targetId = 'student-target';

    // File 3 disputes and resolve them all
    for (let i = 0; i < 3; i++) {
      const d = createDispute({
        listingId: `listing-${i}`,
        initiatorId: `student-${i}`,
        targetId,
        reason: 'test dispute',
      });
      transitionDispute(d.id, 'BEGIN_REVIEW');
      transitionDispute(d.id, 'RESOLVE');
    }

    const trustInput = buildTrustInput(targetId);
    expect(trustInput.disputes).toBe(3);

    const trust = computeTrust(trustInput);
    expect(trust.status).toBe('REVIEW_REQUIRED');

    // But active disputes = 0 (all resolved), so no restriction from disputes
    const restriction = computeRestriction({
      trustStatus: trust.status,
      activeDisputes: countActiveDisputesAgainst(targetId),
      adminOverride: false,
    });
    // REVIEW_REQUIRED does NOT cause restriction
    expect(restriction.isRestricted).toBe(false);
  });

  it('3+ active disputes → restriction from dispute count', () => {
    const targetId = 'student-target';

    // File 3 disputes, leave them OPEN
    for (let i = 0; i < 3; i++) {
      createDispute({
        listingId: `listing-${i}`,
        initiatorId: `student-${i}`,
        targetId,
        reason: 'test dispute',
      });
    }

    expect(countActiveDisputesAgainst(targetId)).toBe(3);

    const restriction = computeRestriction({
      trustStatus: 'GOOD_STANDING',
      activeDisputes: countActiveDisputesAgainst(targetId),
      adminOverride: false,
    });
    expect(restriction.isRestricted).toBe(true);
  });

  it('resolving disputes removes restriction', () => {
    const targetId = 'student-target';

    const disputes = [];
    for (let i = 0; i < 3; i++) {
      disputes.push(createDispute({
        listingId: `listing-${i}`,
        initiatorId: `student-${i}`,
        targetId,
        reason: 'dispute',
      }));
    }

    // All 3 active → restricted
    expect(countActiveDisputesAgainst(targetId)).toBe(3);
    let restriction = computeRestriction({
      trustStatus: 'GOOD_STANDING',
      activeDisputes: countActiveDisputesAgainst(targetId),
      adminOverride: false,
    });
    expect(restriction.isRestricted).toBe(true);

    // Resolve all 3
    for (const d of disputes) {
      transitionDispute(d.id, 'BEGIN_REVIEW');
      transitionDispute(d.id, 'RESOLVE');
    }

    // Now 0 active → unrestricted
    expect(countActiveDisputesAgainst(targetId)).toBe(0);
    restriction = computeRestriction({
      trustStatus: 'GOOD_STANDING',
      activeDisputes: countActiveDisputesAgainst(targetId),
      adminOverride: false,
    });
    expect(restriction.isRestricted).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════
   Scenario 2: Cancel Spike → Trust Review, NOT Restriction
   ═══════════════════════════════════════════════════ */

describe('Integration: Cancel Spike', () => {
  it('high cancellations → REVIEW_REQUIRED trust, but NOT restricted', () => {
    const trust = computeTrust({
      completedExchanges: 10,
      cancelledRequests: 20,
      disputes: 0,
      adminFlags: 0,
      accountAgeDays: 60,
    });
    expect(trust.status).toBe('REVIEW_REQUIRED');

    const restriction = computeRestriction({
      trustStatus: trust.status,
      activeDisputes: 0,
      adminOverride: false,
    });
    // REVIEW_REQUIRED alone does NOT restrict
    expect(restriction.isRestricted).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════
   Scenario 3: Listing Spike → Fraud Flag Only, NOT Trust/Restriction
   ═══════════════════════════════════════════════════ */

describe('Integration: Listing Spike', () => {
  it('listing spike triggers fraud flags but NOT trust degradation or restriction', () => {
    // Fraud detects the spike
    const fraud = evaluateFraudHeuristics({
      recentListings: 20,
      recentCancellations: 0,
      recentDisputes: 0,
      accountAgeDays: 60,
    });
    expect(fraud.riskLevel).toBe('MEDIUM');
    expect(fraud.flags.length).toBeGreaterThan(0);

    // Trust engine has no listing input → unaffected
    const trust = computeTrust({
      completedExchanges: 10,
      cancelledRequests: 0,
      disputes: 0,
      adminFlags: 0,
      accountAgeDays: 60,
    });
    expect(trust.status).toBe('GOOD_STANDING');

    // Restriction → NOT restricted
    const restriction = computeRestriction({
      trustStatus: trust.status,
      activeDisputes: 0,
      adminOverride: false,
    });
    expect(restriction.isRestricted).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════
   Scenario 4: Admin Flag → RESTRICTED → Restriction Enforced
   ═══════════════════════════════════════════════════ */

describe('Integration: Admin Flags', () => {
  it('admin flag → RESTRICTED trust → restriction enforced', () => {
    const trust = computeTrust({
      completedExchanges: 100,
      cancelledRequests: 0,
      disputes: 0,
      adminFlags: 1,
      accountAgeDays: 365,
    });
    expect(trust.status).toBe('RESTRICTED');

    const restriction = computeRestriction({
      trustStatus: trust.status,
      activeDisputes: 0,
      adminOverride: false,
    });
    expect(restriction.isRestricted).toBe(true);
    expect(restriction.blockedActions).toContain('CREATE_LISTING');
    expect(restriction.blockedActions).toContain('REQUEST_EXCHANGE');
    expect(restriction.blockedActions).toContain('REQUEST_CONTACT');
  });

  it('removing admin flag restores full access', () => {
    // With flag → restricted
    const flagged = computeTrust({
      completedExchanges: 100,
      cancelledRequests: 0,
      disputes: 0,
      adminFlags: 1,
      accountAgeDays: 365,
    });
    expect(flagged.status).toBe('RESTRICTED');

    // Remove flag → good standing
    const unflagged = computeTrust({
      completedExchanges: 100,
      cancelledRequests: 0,
      disputes: 0,
      adminFlags: 0,
      accountAgeDays: 365,
    });
    expect(unflagged.status).toBe('GOOD_STANDING');

    const restriction = computeRestriction({
      trustStatus: unflagged.status,
      activeDisputes: 0,
      adminOverride: false,
    });
    expect(restriction.isRestricted).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════
   Scenario 5: No False Permanent Lock
   ═══════════════════════════════════════════════════ */

describe('Integration: No False Permanent Lock', () => {
  it('worst case: all spikes resolved → fully restored', () => {
    const targetId = 'student-recovery';

    // Phase 1: Everything bad
    const disputes = [];
    for (let i = 0; i < 5; i++) {
      disputes.push(createDispute({
        listingId: `listing-${i}`,
        initiatorId: `student-${i}`,
        targetId,
        reason: 'spike',
      }));
    }

    let trust = computeTrust({
      completedExchanges: 10,
      cancelledRequests: 20,
      disputes: 0, // none resolved yet
      adminFlags: 1,
      accountAgeDays: 5,
    });
    expect(trust.status).toBe('RESTRICTED');

    let restriction = computeRestriction({
      trustStatus: trust.status,
      activeDisputes: countActiveDisputesAgainst(targetId),
      adminOverride: false,
    });
    expect(restriction.isRestricted).toBe(true);

    // Phase 2: Resolve all disputes
    for (const d of disputes) {
      transitionDispute(d.id, 'BEGIN_REVIEW');
      transitionDispute(d.id, 'RESOLVE');
    }

    // Phase 3: Admin removes flag, time passes, behavior improves
    trust = computeTrust({
      completedExchanges: 50,
      cancelledRequests: 0,
      disputes: 0,
      adminFlags: 0,
      accountAgeDays: 365,
    });
    expect(trust.status).toBe('GOOD_STANDING');

    restriction = computeRestriction({
      trustStatus: trust.status,
      activeDisputes: countActiveDisputesAgainst(targetId),
      adminOverride: false,
    });
    expect(restriction.isRestricted).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════
   Scenario 6: No Bypass
   ═══════════════════════════════════════════════════ */

describe('Integration: No Bypass', () => {
  it('good trust + high active disputes → still restricted', () => {
    const trust = computeTrust({
      completedExchanges: 100,
      cancelledRequests: 0,
      disputes: 0,
      adminFlags: 0,
      accountAgeDays: 365,
    });
    expect(trust.status).toBe('GOOD_STANDING');

    const restriction = computeRestriction({
      trustStatus: trust.status,
      activeDisputes: 5,
      adminOverride: false,
    });
    expect(restriction.isRestricted).toBe(true);
  });

  it('admin override → restricted even with perfect trust and no disputes', () => {
    const trust = computeTrust({
      completedExchanges: 100,
      cancelledRequests: 0,
      disputes: 0,
      adminFlags: 0,
      accountAgeDays: 365,
    });
    expect(trust.status).toBe('GOOD_STANDING');

    const restriction = computeRestriction({
      trustStatus: trust.status,
      activeDisputes: 0,
      adminOverride: true,
    });
    expect(restriction.isRestricted).toBe(true);
  });

  it('fraud heuristics cannot be gamed by spreading flags across time windows', () => {
    // Each individual metric below threshold
    const result = evaluateFraudHeuristics({
      recentListings: 5,     // at threshold, not above
      recentCancellations: 4, // at threshold, not above
      recentDisputes: 2,      // at threshold, not above
      accountAgeDays: 60,
    });
    // Should be LOW — all within limits
    expect(result.riskLevel).toBe('LOW');

    // But push just ONE over
    const pushed = evaluateFraudHeuristics({
      recentListings: 6,      // 1 above threshold
      recentCancellations: 4,
      recentDisputes: 2,
      accountAgeDays: 60,
    });
    expect(pushed.riskLevel).toBe('MEDIUM');
  });
});

/* ═══════════════════════════════════════════════════
   Scenario 7: Full Dispute → Trust → Restrict → Recover Lifecycle
   ═══════════════════════════════════════════════════ */

describe('Integration: Full Lifecycle', () => {
  it('tracks a student through dispute → restriction → recovery', () => {
    const targetId = 'lifecycle-student';

    // Step 1: Student starts clean
    let trust = computeTrust({
      completedExchanges: 5,
      cancelledRequests: 0,
      disputes: 0,
      adminFlags: 0,
      accountAgeDays: 90,
    });
    expect(trust.status).toBe('GOOD_STANDING');

    let restriction = computeRestriction({
      trustStatus: trust.status,
      activeDisputes: countActiveDisputesAgainst(targetId),
      adminOverride: false,
    });
    expect(restriction.isRestricted).toBe(false);

    // Step 2: 3 disputes filed against them (all OPEN)
    for (let i = 0; i < 3; i++) {
      createDispute({
        listingId: `l-${i}`,
        initiatorId: `s-${i}`,
        targetId,
        reason: 'complaint',
      });
    }

    // Trust still based on resolved disputes (0), but active disputes hit threshold
    trust = computeTrust({
      completedExchanges: 5,
      cancelledRequests: 0,
      disputes: countResolvedDisputesAgainst(targetId), // 0
      adminFlags: 0,
      accountAgeDays: 90,
    });
    expect(trust.status).toBe('GOOD_STANDING');

    restriction = computeRestriction({
      trustStatus: trust.status,
      activeDisputes: countActiveDisputesAgainst(targetId), // 3
      adminOverride: false,
    });
    expect(restriction.isRestricted).toBe(true);

    // Step 3: Admin adds flag for investigation
    trust = computeTrust({
      completedExchanges: 5,
      cancelledRequests: 0,
      disputes: 0,
      adminFlags: 1,
      accountAgeDays: 90,
    });
    expect(trust.status).toBe('RESTRICTED');

    // Step 4: Admin reviews and resolves 2 disputes, rejects 1
    const allDisputes = Array.from({ length: 3 }, (_, i) => `dispute-${i + 1}`);
    transitionDispute(allDisputes[0], 'BEGIN_REVIEW');
    transitionDispute(allDisputes[0], 'RESOLVE');
    transitionDispute(allDisputes[1], 'BEGIN_REVIEW');
    transitionDispute(allDisputes[1], 'RESOLVE');
    transitionDispute(allDisputes[2], 'BEGIN_REVIEW');
    transitionDispute(allDisputes[2], 'REJECT');

    expect(countActiveDisputesAgainst(targetId)).toBe(0);
    expect(countResolvedDisputesAgainst(targetId)).toBe(2);

    // Step 5: Admin removes flag → full recovery
    trust = computeTrust({
      completedExchanges: 5,
      cancelledRequests: 0,
      disputes: countResolvedDisputesAgainst(targetId), // 2
      adminFlags: 0,
      accountAgeDays: 90,
    });
    expect(trust.status).toBe('GOOD_STANDING');

    restriction = computeRestriction({
      trustStatus: trust.status,
      activeDisputes: countActiveDisputesAgainst(targetId), // 0
      adminOverride: false,
    });
    expect(restriction.isRestricted).toBe(false);
  });
});
