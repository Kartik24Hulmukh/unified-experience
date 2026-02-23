/**
 * Fraud Heuristics Tests
 *
 * Validates:
 *   - Each heuristic rule fires correctly at thresholds
 *   - Risk level derived from flag count (0=LOW, 1=MEDIUM, 2+=HIGH)
 *   - New account sensitivity
 *   - Flags are informational only (no auto-restrict)
 *   - Input sanitization
 *   - Determinism
 *   - Spike simulations
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateFraudHeuristics,
  isFraudReviewRequired,
  FRAUD_THRESHOLDS,
  type FraudHeuristicInput,
} from '@/domain/fraudHeuristics';

/* ── Helper ────────────────────────────────────────────────── */

function cleanInput(overrides: Partial<FraudHeuristicInput> = {}): FraudHeuristicInput {
  return {
    recentListings: 0,
    recentCancellations: 0,
    recentDisputes: 0,
    accountAgeDays: 60,
    ...overrides,
  };
}

describe('Fraud Heuristics: Listing Spike', () => {
  it('listings at threshold → no flag', () => {
    const result = evaluateFraudHeuristics(cleanInput({
      recentListings: FRAUD_THRESHOLDS.listingSpike,
    }));
    expect(result.flags).toHaveLength(0);
    expect(result.riskLevel).toBe('LOW');
  });

  it('listings above threshold → MEDIUM', () => {
    const result = evaluateFraudHeuristics(cleanInput({
      recentListings: FRAUD_THRESHOLDS.listingSpike + 1,
    }));
    expect(result.flags).toHaveLength(1);
    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.flags[0]).toContain('listing volume');
  });
});

describe('Fraud Heuristics: Cancellation Spike', () => {
  it('cancellations at threshold → no flag', () => {
    const result = evaluateFraudHeuristics(cleanInput({
      recentCancellations: FRAUD_THRESHOLDS.cancellationSpike,
    }));
    expect(result.flags).toHaveLength(0);
  });

  it('cancellations above threshold → MEDIUM', () => {
    const result = evaluateFraudHeuristics(cleanInput({
      recentCancellations: FRAUD_THRESHOLDS.cancellationSpike + 1,
    }));
    expect(result.flags).toHaveLength(1);
    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.flags[0]).toContain('cancellations');
  });
});

describe('Fraud Heuristics: Dispute Spike', () => {
  it('disputes at threshold → no flag', () => {
    const result = evaluateFraudHeuristics(cleanInput({
      recentDisputes: FRAUD_THRESHOLDS.disputeSpike,
    }));
    expect(result.flags).toHaveLength(0);
  });

  it('disputes above threshold → MEDIUM', () => {
    const result = evaluateFraudHeuristics(cleanInput({
      recentDisputes: FRAUD_THRESHOLDS.disputeSpike + 1,
    }));
    expect(result.flags).toHaveLength(1);
    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.flags[0]).toContain('disputes');
  });
});

describe('Fraud Heuristics: New Account Sensitivity', () => {
  it('new account (< 14 days) with listings above new account limit → flag', () => {
    const result = evaluateFraudHeuristics(cleanInput({
      accountAgeDays: 5,
      recentListings: FRAUD_THRESHOLDS.newAccountListingLimit + 1,
    }));
    expect(result.flags.some(f => f.includes('New account'))).toBe(true);
  });

  it('old account with same listings → no new-account flag', () => {
    const result = evaluateFraudHeuristics(cleanInput({
      accountAgeDays: 60,
      recentListings: FRAUD_THRESHOLDS.newAccountListingLimit + 1,
    }));
    // No new-account flag (but may have listing spike if above main threshold)
    expect(result.flags.every(f => !f.includes('New account'))).toBe(true);
  });

  it('exact boundary: accountAgeDays == newAccountDays → no new-account flag', () => {
    const result = evaluateFraudHeuristics(cleanInput({
      accountAgeDays: FRAUD_THRESHOLDS.newAccountDays,
      recentListings: FRAUD_THRESHOLDS.newAccountListingLimit + 1,
    }));
    expect(result.flags.every(f => !f.includes('New account'))).toBe(true);
  });
});

describe('Fraud Heuristics: Risk Level Derivation', () => {
  it('0 flags → LOW', () => {
    const result = evaluateFraudHeuristics(cleanInput());
    expect(result.riskLevel).toBe('LOW');
    expect(result.flags).toHaveLength(0);
  });

  it('1 flag → MEDIUM', () => {
    const result = evaluateFraudHeuristics(cleanInput({
      recentListings: FRAUD_THRESHOLDS.listingSpike + 1,
    }));
    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.flags).toHaveLength(1);
  });

  it('2 flags → HIGH', () => {
    const result = evaluateFraudHeuristics(cleanInput({
      recentListings: FRAUD_THRESHOLDS.listingSpike + 1,
      recentCancellations: FRAUD_THRESHOLDS.cancellationSpike + 1,
    }));
    expect(result.riskLevel).toBe('HIGH');
    expect(result.flags.length).toBeGreaterThanOrEqual(2);
  });

  it('3+ flags → still HIGH (no escalation beyond HIGH)', () => {
    const result = evaluateFraudHeuristics(cleanInput({
      recentListings: FRAUD_THRESHOLDS.listingSpike + 1,
      recentCancellations: FRAUD_THRESHOLDS.cancellationSpike + 1,
      recentDisputes: FRAUD_THRESHOLDS.disputeSpike + 1,
    }));
    expect(result.riskLevel).toBe('HIGH');
    expect(result.flags.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Fraud Heuristics: isFraudReviewRequired', () => {
  it('LOW → no review required', () => {
    expect(isFraudReviewRequired({ riskLevel: 'LOW', flags: [] })).toBe(false);
  });

  it('MEDIUM → no review required (only HIGH triggers)', () => {
    expect(isFraudReviewRequired({ riskLevel: 'MEDIUM', flags: ['test'] })).toBe(false);
  });

  it('HIGH → review required', () => {
    expect(isFraudReviewRequired({ riskLevel: 'HIGH', flags: ['a', 'b'] })).toBe(true);
  });
});

describe('Fraud Heuristics: Input Sanitization', () => {
  it('negative values treated as 0 → LOW risk', () => {
    const result = evaluateFraudHeuristics({
      recentListings: -10,
      recentCancellations: -5,
      recentDisputes: -3,
      accountAgeDays: -100,
    });
    expect(result.riskLevel).toBe('LOW');
    expect(result.flags).toHaveLength(0);
  });

  it('NaN values treated as 0 → LOW risk', () => {
    const result = evaluateFraudHeuristics({
      recentListings: NaN,
      recentCancellations: NaN,
      recentDisputes: NaN,
      accountAgeDays: NaN,
    });
    expect(result.riskLevel).toBe('LOW');
  });

  it('Infinity values treated as 0 → LOW risk', () => {
    const result = evaluateFraudHeuristics({
      recentListings: Infinity,
      recentCancellations: Infinity,
      recentDisputes: Infinity,
      accountAgeDays: Infinity,
    });
    expect(result.riskLevel).toBe('LOW');
  });
});

describe('Fraud Heuristics: Determinism', () => {
  it('same input produces identical output', () => {
    const input = cleanInput({ recentListings: 10, recentCancellations: 8 });
    const baseline = evaluateFraudHeuristics(input);

    for (let i = 0; i < 50; i++) {
      const result = evaluateFraudHeuristics(input);
      expect(result.riskLevel).toBe(baseline.riskLevel);
      expect(result.flags).toEqual(baseline.flags);
    }
  });
});

describe('Fraud Heuristics: Spike Simulations', () => {
  it('massive listing spike (1000) → flagged but does NOT auto-restrict', () => {
    const result = evaluateFraudHeuristics(cleanInput({ recentListings: 1000 }));
    // Flags fired, but the heuristics engine ONLY flags — never restricts
    expect(result.flags.length).toBeGreaterThan(0);
    // The result is just flags. Restriction is a separate engine.
  });

  it('combined spike → HIGH risk with all flags', () => {
    const result = evaluateFraudHeuristics({
      recentListings: 100,
      recentCancellations: 100,
      recentDisputes: 100,
      accountAgeDays: 5,
    });
    expect(result.riskLevel).toBe('HIGH');
    // Should have 4 flags: listing, cancel, dispute, new account
    expect(result.flags).toHaveLength(4);
  });
});
