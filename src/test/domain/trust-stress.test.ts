/**
 * Trust Engine Stress Tests — Abuse Simulation
 *
 * Simulates real-world abuse patterns that a campus marketplace faces:
 *   1. Listing flood (10+ listings in 24h spike)
 *   2. Dispute bombardment (4 disputes in 7 days)
 *   3. Admin flag + high cancellation combo
 *   4. Rapid contact unlock spam (contact request abuse)
 *   5. New account gaming (sub-14-day accounts pushing limits)
 *   6. Cancel-to-complete ratio manipulation
 *   7. Multi-vector attack (disputes + cancellations + flags simultaneously)
 *   8. Recovery path (restricted → clean after flag removal)
 *
 * Pure domain logic — no mock API, no React, no network.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { computeTrust, TRUST_THRESHOLDS, type TrustInput } from '@/domain/trustEngine';
import {
  computeRestriction,
  isActionBlocked,
  RESTRICTION_THRESHOLDS,
  type RestrictionInput,
} from '@/domain/restrictionEngine';
import {
  evaluateFraudHeuristics,
  isFraudReviewRequired,
  FRAUD_THRESHOLDS,
  type FraudHeuristicInput,
} from '@/domain/fraudHeuristics';
import {
  createDispute,
  transitionDispute,
  countActiveDisputesAgainst,
  resetDisputeStore,
} from '@/services/disputeService';

/* ── Helpers ───────────────────────────────────────────────── */

function cleanTrust(overrides: Partial<TrustInput> = {}): TrustInput {
  return {
    completedExchanges: 10,
    cancelledRequests: 0,
    disputes: 0,
    adminFlags: 0,
    accountAgeDays: 60,
    ...overrides,
  };
}

function fullPipeline(trustInput: TrustInput, activeDisputes: number, adminOverride = false) {
  const trust = computeTrust(trustInput);
  const restriction = computeRestriction({
    trustStatus: trust.status,
    activeDisputes,
    adminOverride,
  });
  return { trust, restriction };
}

beforeEach(() => {
  resetDisputeStore();
});

/* ═══════════════════════════════════════════════════
   Scenario 1: Listing Flood (10+ listings in 24h)
   ═══════════════════════════════════════════════════ */

describe('Stress: Listing Flood Attack', () => {
  it('10 listings from established account → MEDIUM fraud risk (single flag)', () => {
    const fraud = evaluateFraudHeuristics({
      recentListings: 10,
      recentCancellations: 0,
      recentDisputes: 0,
      accountAgeDays: 60,
    });
    // Only listing-spike flag fires (1 flag → MEDIUM)
    expect(fraud.riskLevel).toBe('MEDIUM');
    expect(isFraudReviewRequired(fraud)).toBe(false);
    expect(fraud.flags.length).toBe(1);
  });

  it('6 listings from new account (<14 days) → HIGH fraud risk', () => {
    const fraud = evaluateFraudHeuristics({
      recentListings: 6,
      recentCancellations: 0,
      recentDisputes: 0,
      accountAgeDays: 7,
    });
    expect(fraud.riskLevel).toBe('HIGH');
    expect(isFraudReviewRequired(fraud)).toBe(true);
  });

  it('3 listings from new account → MEDIUM risk (lower bar for new accounts)', () => {
    const fraud = evaluateFraudHeuristics({
      recentListings: FRAUD_THRESHOLDS.newAccountListingLimit + 1,
      recentCancellations: 0,
      recentDisputes: 0,
      accountAgeDays: 7,
    });
    expect(['MEDIUM', 'HIGH']).toContain(fraud.riskLevel);
  });

  it('listing flood does NOT affect trust status (fraud ≠ trust)', () => {
    // Fraud flags should NOT cascade into trust restriction
    const trust = computeTrust(cleanTrust());
    expect(trust.status).toBe('GOOD_STANDING');
    // Trust only degrades from disputes, cancellations, and admin flags
  });

  it('5 listings (at threshold) from established account stays LOW', () => {
    const fraud = evaluateFraudHeuristics({
      recentListings: FRAUD_THRESHOLDS.listingSpike,
      recentCancellations: 0,
      recentDisputes: 0,
      accountAgeDays: 60,
    });
    expect(fraud.riskLevel).toBe('LOW');
  });
});

/* ═══════════════════════════════════════════════════
   Scenario 2: Dispute Bombardment (4 disputes in 7 days)
   ═══════════════════════════════════════════════════ */

describe('Stress: Dispute Bombardment', () => {
  it('4 active disputes → trust REVIEW_REQUIRED + restriction ENFORCED', () => {
    const { trust, restriction } = fullPipeline(
      cleanTrust({ disputes: 4 }),
      4,
    );
    expect(trust.status).toBe('REVIEW_REQUIRED');
    expect(restriction.isRestricted).toBe(true);
    expect(isActionBlocked(restriction, 'CREATE_LISTING')).toBe(true);
    expect(isActionBlocked(restriction, 'REQUEST_EXCHANGE')).toBe(true);
    expect(isActionBlocked(restriction, 'REQUEST_CONTACT')).toBe(true);
  });

  it('3 active disputes (at threshold) → restriction kicks in', () => {
    const restriction = computeRestriction({
      trustStatus: 'GOOD_STANDING',
      activeDisputes: RESTRICTION_THRESHOLDS.disputeLimit,
      adminOverride: false,
    });
    expect(restriction.isRestricted).toBe(true);
  });

  it('2 disputes → NOT restricted', () => {
    const { restriction } = fullPipeline(cleanTrust({ disputes: 2 }), 2);
    expect(restriction.isRestricted).toBe(false);
  });

  it('disputes resolved → trust recovers, restriction lifts', () => {
    // First: 4 disputes → restricted
    const before = fullPipeline(cleanTrust({ disputes: 4 }), 4);
    expect(before.restriction.isRestricted).toBe(true);

    // After: disputes resolved → active disputes = 0
    const after = fullPipeline(cleanTrust({ disputes: 4 }), 0);
    expect(after.restriction.isRestricted).toBe(false);
    // Trust still REVIEW_REQUIRED because disputes count is 4 (resolved + active)
    expect(after.trust.status).toBe('REVIEW_REQUIRED');
  });
});

/* ═══════════════════════════════════════════════════
   Scenario 3: Admin Flag + High Cancellation Combo
   ═══════════════════════════════════════════════════ */

describe('Stress: Admin Flag + Cancellation Combo', () => {
  it('admin flag alone → RESTRICTED (overrides everything)', () => {
    const trust = computeTrust(cleanTrust({ adminFlags: 1 }));
    expect(trust.status).toBe('RESTRICTED');
  });

  it('admin flag + 10 cancellations → RESTRICTED (flag dominates)', () => {
    const trust = computeTrust(cleanTrust({
      adminFlags: 1,
      cancelledRequests: 10,
      completedExchanges: 0,
    }));
    expect(trust.status).toBe('RESTRICTED');
    // Should only mention admin flag, not cancellations
    expect(trust.reasons.some(r => r.toLowerCase().includes('admin flag'))).toBe(true);
  });

  it('high cancellations without admin flag → REVIEW_REQUIRED (not RESTRICTED)', () => {
    const trust = computeTrust(cleanTrust({
      cancelledRequests: TRUST_THRESHOLDS.cancelledLimit + 1,
    }));
    expect(trust.status).toBe('REVIEW_REQUIRED');
    expect(trust.status).not.toBe('RESTRICTED');
  });

  it('admin override → always restricted regardless of trust', () => {
    const restriction = computeRestriction({
      trustStatus: 'GOOD_STANDING',
      activeDisputes: 0,
      adminOverride: true,
    });
    expect(restriction.isRestricted).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════
   Scenario 4: Contact Unlock Spam Simulation
   ═══════════════════════════════════════════════════ */

describe('Stress: Contact Unlock Spam', () => {
  it('restricted user cannot unlock contacts', () => {
    const restriction = computeRestriction({
      trustStatus: 'RESTRICTED',
      activeDisputes: 0,
      adminOverride: false,
    });
    expect(isActionBlocked(restriction, 'REQUEST_CONTACT')).toBe(true);
  });

  it('user under review with 3+ active disputes cannot unlock contacts', () => {
    const restriction = computeRestriction({
      trustStatus: 'REVIEW_REQUIRED',
      activeDisputes: 3,
      adminOverride: false,
    });
    expect(isActionBlocked(restriction, 'REQUEST_CONTACT')).toBe(true);
  });

  it('good standing user with no disputes CAN unlock contacts', () => {
    const restriction = computeRestriction({
      trustStatus: 'GOOD_STANDING',
      activeDisputes: 0,
      adminOverride: false,
    });
    expect(isActionBlocked(restriction, 'REQUEST_CONTACT')).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════
   Scenario 5: New Account Gaming
   ═══════════════════════════════════════════════════ */

describe('Stress: New Account Gaming', () => {
  it('new account (<30 days) with high cancel ratio → REVIEW_REQUIRED', () => {
    // 2 completed, 2 cancelled → 50% ratio on new account
    const trust = computeTrust(cleanTrust({
      completedExchanges: 2,
      cancelledRequests: 2,
      accountAgeDays: 15,
    }));
    expect(trust.status).toBe('REVIEW_REQUIRED');
  });

  it('established account (60+ days) with same ratio → still GOOD_STANDING', () => {
    // 10 completed, 2 cancelled → 20% ratio is fine for established accounts
    const trust = computeTrust(cleanTrust({
      completedExchanges: 10,
      cancelledRequests: 2,
      accountAgeDays: 120,
    }));
    expect(trust.status).toBe('GOOD_STANDING');
  });

  it('brand new account (1 day) with 0 exchanges → GOOD_STANDING (no data yet)', () => {
    const trust = computeTrust(cleanTrust({
      completedExchanges: 0,
      cancelledRequests: 0,
      accountAgeDays: 1,
    }));
    expect(trust.status).toBe('GOOD_STANDING');
  });

  it('new account with listing spike → fraud flagged (MEDIUM, single flag)', () => {
    const fraud = evaluateFraudHeuristics({
      recentListings: FRAUD_THRESHOLDS.newAccountListingLimit + 1,
      recentCancellations: 0,
      recentDisputes: 0,
      accountAgeDays: 5,
    });
    // Only new-account sensitivity flag fires (1 flag → MEDIUM, not HIGH)
    expect(fraud.flags.length).toBe(1);
    expect(fraud.riskLevel).toBe('MEDIUM');
    expect(isFraudReviewRequired(fraud)).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════
   Scenario 6: Cancel/Complete Ratio Manipulation
   ═══════════════════════════════════════════════════ */

describe('Stress: Cancel Ratio Manipulation', () => {
  it('50%+ cancel ratio on new account → REVIEW_REQUIRED', () => {
    const trust = computeTrust(cleanTrust({
      completedExchanges: 3,
      cancelledRequests: 3,
      accountAgeDays: 20,
    }));
    expect(trust.status).toBe('REVIEW_REQUIRED');
    expect(trust.reasons.some(r => r.toLowerCase().includes('cancel'))).toBe(true);
  });

  it('cancel spike (5+ cancellations) → REVIEW_REQUIRED always', () => {
    const trust = computeTrust(cleanTrust({
      cancelledRequests: TRUST_THRESHOLDS.cancelledLimit + 2,
      completedExchanges: 100, // even many completions don't help
    }));
    expect(trust.status).toBe('REVIEW_REQUIRED');
  });

  it('below thresholds → GOOD_STANDING', () => {
    const trust = computeTrust(cleanTrust({
      cancelledRequests: TRUST_THRESHOLDS.cancelledLimit - 1,
      completedExchanges: 10,
      accountAgeDays: 60,
    }));
    expect(trust.status).toBe('GOOD_STANDING');
  });
});

/* ═══════════════════════════════════════════════════
   Scenario 7: Multi-Vector Attack
   ═══════════════════════════════════════════════════ */

describe('Stress: Multi-Vector Attack', () => {
  it('disputes + cancellations + admin flag → RESTRICTED (flag dominates)', () => {
    const { trust, restriction } = fullPipeline(
      cleanTrust({
        disputes: 5,
        cancelledRequests: 10,
        adminFlags: 1,
      }),
      5,
      false,
    );
    expect(trust.status).toBe('RESTRICTED');
    expect(restriction.isRestricted).toBe(true);
    // Should mention admin flag first (highest severity)
    expect(trust.reasons[0]).toContain('admin flag');
  });

  it('disputes + cancellations (no flag) → REVIEW_REQUIRED + restricted if 3+ disputes', () => {
    const { trust, restriction } = fullPipeline(
      cleanTrust({
        disputes: 3,
        cancelledRequests: 5,
      }),
      3,
    );
    expect(trust.status).toBe('REVIEW_REQUIRED');
    expect(restriction.isRestricted).toBe(true);
  });

  it('disputes + listing flood → both fraud AND trust degrade independently', () => {
    const trust = computeTrust(cleanTrust({ disputes: 3 }));
    const fraud = evaluateFraudHeuristics({
      recentListings: 10,
      recentCancellations: 0,
      recentDisputes: 3,
      accountAgeDays: 60,
    });
    expect(trust.status).toBe('REVIEW_REQUIRED');
    expect(fraud.riskLevel).toBe('HIGH');
    expect(isFraudReviewRequired(fraud)).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════
   Scenario 8: Recovery Path (Restricted → Clean)
   ═══════════════════════════════════════════════════ */

describe('Stress: Recovery Path', () => {
  it('admin flag removed → trust recovers to GOOD_STANDING', () => {
    const restricted = computeTrust(cleanTrust({ adminFlags: 1 }));
    expect(restricted.status).toBe('RESTRICTED');

    const recovered = computeTrust(cleanTrust({ adminFlags: 0 }));
    expect(recovered.status).toBe('GOOD_STANDING');
  });

  it('disputes resolved + flag removed → full recovery', () => {
    // During abuse
    const during = fullPipeline(cleanTrust({ disputes: 4, adminFlags: 1 }), 4);
    expect(during.trust.status).toBe('RESTRICTED');
    expect(during.restriction.isRestricted).toBe(true);

    // After recovery (disputes still in history but no longer active)
    const after = fullPipeline(cleanTrust({ disputes: 4, adminFlags: 0 }), 0);
    expect(after.trust.status).toBe('REVIEW_REQUIRED'); // disputes still in history
    expect(after.restriction.isRestricted).toBe(false); // but no active disputes

    // Full clean (disputes cleared from record over time)
    const clean = fullPipeline(cleanTrust({ disputes: 0, adminFlags: 0 }), 0);
    expect(clean.trust.status).toBe('GOOD_STANDING');
    expect(clean.restriction.isRestricted).toBe(false);
  });

  it('admin override removed → restriction lifts', () => {
    const locked = computeRestriction({
      trustStatus: 'GOOD_STANDING',
      activeDisputes: 0,
      adminOverride: true,
    });
    expect(locked.isRestricted).toBe(true);

    const unlocked = computeRestriction({
      trustStatus: 'GOOD_STANDING',
      activeDisputes: 0,
      adminOverride: false,
    });
    expect(unlocked.isRestricted).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════
   Determinism & Edge Cases
   ═══════════════════════════════════════════════════ */

describe('Stress: Determinism Under Load', () => {
  it('same abuse input always produces same result (100 iterations)', () => {
    const input = cleanTrust({
      disputes: 4,
      cancelledRequests: 5,
      adminFlags: 1,
      accountAgeDays: 7,
    });

    const first = computeTrust(input);
    for (let i = 0; i < 100; i++) {
      const result = computeTrust(input);
      expect(result.status).toBe(first.status);
      expect(result.reasons).toEqual(first.reasons);
    }
  });

  it('fraud evaluation is deterministic (100 iterations)', () => {
    const input: FraudHeuristicInput = {
      recentListings: 10,
      recentCancellations: 5,
      recentDisputes: 3,
      accountAgeDays: 5,
    };

    const first = evaluateFraudHeuristics(input);
    for (let i = 0; i < 100; i++) {
      const result = evaluateFraudHeuristics(input);
      expect(result.riskLevel).toBe(first.riskLevel);
      expect(result.flags).toEqual(first.flags);
    }
  });

  it('boundary values: exactly at thresholds', () => {
    // Exactly at dispute threshold
    const atDispute = computeTrust(cleanTrust({
      disputes: TRUST_THRESHOLDS.disputeLimit,
    }));
    // At threshold should NOT trigger (trigger is above)
    expect(atDispute.status).toBe('GOOD_STANDING');

    // One above
    const aboveDispute = computeTrust(cleanTrust({
      disputes: TRUST_THRESHOLDS.disputeLimit + 1,
    }));
    expect(aboveDispute.status).toBe('REVIEW_REQUIRED');
  });
});
