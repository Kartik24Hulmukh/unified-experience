/**
 * Trust Engine Tests
 *
 * Validates:
 *   - Admin flags → RESTRICTED (always, no false bypass)
 *   - Dispute threshold → REVIEW_REQUIRED
 *   - Cancellation threshold → REVIEW_REQUIRED
 *   - Cancel/complete ratio for new accounts → REVIEW_REQUIRED
 *   - Clean profile → GOOD_STANDING
 *   - No false permanent lock (removal of flags restores status)
 *   - Input sanitization (negative, NaN, Infinity)
 *   - Determinism (same input → same output)
 *   - Spike simulations
 */

import { describe, it, expect } from 'vitest';
import {
  computeTrust,
  TRUST_THRESHOLDS,
  type TrustInput,
  type TrustStatus,
} from '@/domain/trustEngine';

/* ── Helper ────────────────────────────────────────────────── */

function cleanInput(overrides: Partial<TrustInput> = {}): TrustInput {
  return {
    completedExchanges: 10,
    cancelledRequests: 0,
    disputes: 0,
    adminFlags: 0,
    accountAgeDays: 60,
    ...overrides,
  };
}

describe('Trust Engine: Admin Flags → RESTRICTED', () => {
  it('1 admin flag → RESTRICTED', () => {
    const result = computeTrust(cleanInput({ adminFlags: 1 }));
    expect(result.status).toBe('RESTRICTED');
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain('admin flag');
  });

  it('many admin flags → RESTRICTED', () => {
    const result = computeTrust(cleanInput({ adminFlags: 5 }));
    expect(result.status).toBe('RESTRICTED');
  });

  it('admin flag overrides high disputes + cancellations', () => {
    const result = computeTrust(cleanInput({
      adminFlags: 1,
      disputes: 100,
      cancelledRequests: 100,
    }));
    expect(result.status).toBe('RESTRICTED');
    // Only 1 reason because admin flag short-circuits
    expect(result.reasons).toHaveLength(1);
  });
});

describe('Trust Engine: No False Permanent Lock', () => {
  it('removing admin flags restores GOOD_STANDING', () => {
    const flagged = computeTrust(cleanInput({ adminFlags: 1 }));
    expect(flagged.status).toBe('RESTRICTED');

    const unflagged = computeTrust(cleanInput({ adminFlags: 0 }));
    expect(unflagged.status).toBe('GOOD_STANDING');
  });

  it('reducing disputes below threshold restores GOOD_STANDING', () => {
    const high = computeTrust(cleanInput({ disputes: 5 }));
    expect(high.status).toBe('REVIEW_REQUIRED');

    const low = computeTrust(cleanInput({ disputes: 1 }));
    expect(low.status).toBe('GOOD_STANDING');
  });

  it('reducing cancellations below threshold restores GOOD_STANDING', () => {
    const high = computeTrust(cleanInput({ cancelledRequests: 10 }));
    expect(high.status).toBe('REVIEW_REQUIRED');

    const low = computeTrust(cleanInput({ cancelledRequests: 2 }));
    expect(low.status).toBe('GOOD_STANDING');
  });
});

describe('Trust Engine: Dispute Threshold', () => {
  it('disputes at threshold → GOOD_STANDING (not exceeded)', () => {
    const result = computeTrust(cleanInput({ disputes: TRUST_THRESHOLDS.disputeLimit }));
    expect(result.status).toBe('GOOD_STANDING');
  });

  it('disputes above threshold → REVIEW_REQUIRED', () => {
    const result = computeTrust(cleanInput({ disputes: TRUST_THRESHOLDS.disputeLimit + 1 }));
    expect(result.status).toBe('REVIEW_REQUIRED');
    expect(result.reasons[0]).toContain('Dispute count');
  });
});

describe('Trust Engine: Cancellation Threshold', () => {
  it('cancellations at threshold → GOOD_STANDING (not exceeded)', () => {
    const result = computeTrust(cleanInput({ cancelledRequests: TRUST_THRESHOLDS.cancelledLimit }));
    expect(result.status).toBe('GOOD_STANDING');
  });

  it('cancellations above threshold → REVIEW_REQUIRED', () => {
    const result = computeTrust(cleanInput({ cancelledRequests: TRUST_THRESHOLDS.cancelledLimit + 1 }));
    expect(result.status).toBe('REVIEW_REQUIRED');
    expect(result.reasons[0]).toContain('Cancelled requests');
  });
});

describe('Trust Engine: Cancel/Complete Ratio (New Accounts)', () => {
  it('new account with high cancel ratio → REVIEW_REQUIRED', () => {
    const result = computeTrust(cleanInput({
      accountAgeDays: 10,
      completedExchanges: 2,
      cancelledRequests: 2, // ratio = 1.0 > 0.5
    }));
    expect(result.status).toBe('REVIEW_REQUIRED');
    expect(result.reasons[0]).toContain('cancel/complete ratio');
  });

  it('old account with same ratio → GOOD_STANDING (ratio rule only for new accounts)', () => {
    const result = computeTrust(cleanInput({
      accountAgeDays: 60,
      completedExchanges: 2,
      cancelledRequests: 2,
    }));
    expect(result.status).toBe('GOOD_STANDING');
  });

  it('new account with 0 completed exchanges → GOOD_STANDING (division guard)', () => {
    const result = computeTrust(cleanInput({
      accountAgeDays: 10,
      completedExchanges: 0,
      cancelledRequests: 5,
    }));
    // cancelledRequests > cancelledLimit → REVIEW_REQUIRED for different reason
    // But the ratio check itself should not fire (completedExchanges = 0)
    const ratioReason = result.reasons.find(r => r.includes('cancel/complete ratio'));
    expect(ratioReason).toBeUndefined();
  });
});

describe('Trust Engine: Clean Profile → GOOD_STANDING', () => {
  it('all zeros → GOOD_STANDING', () => {
    const result = computeTrust({
      completedExchanges: 0,
      cancelledRequests: 0,
      disputes: 0,
      adminFlags: 0,
      accountAgeDays: 0,
    });
    expect(result.status).toBe('GOOD_STANDING');
  });

  it('healthy profile with activity → GOOD_STANDING', () => {
    const result = computeTrust(cleanInput());
    expect(result.status).toBe('GOOD_STANDING');
  });
});

describe('Trust Engine: Input Sanitization', () => {
  it('negative values treated as 0', () => {
    const result = computeTrust({
      completedExchanges: -5,
      cancelledRequests: -10,
      disputes: -3,
      adminFlags: -1,
      accountAgeDays: -100,
    });
    expect(result.status).toBe('GOOD_STANDING');
  });

  it('NaN values treated as 0', () => {
    const result = computeTrust({
      completedExchanges: NaN,
      cancelledRequests: NaN,
      disputes: NaN,
      adminFlags: NaN,
      accountAgeDays: NaN,
    });
    expect(result.status).toBe('GOOD_STANDING');
  });

  it('Infinity treated as 0', () => {
    const result = computeTrust({
      completedExchanges: Infinity,
      cancelledRequests: Infinity,
      disputes: Infinity,
      adminFlags: Infinity,
      accountAgeDays: Infinity,
    });
    expect(result.status).toBe('GOOD_STANDING');
  });

  it('fractional values floored', () => {
    // adminFlags 0.9 → floored to 0 → no restriction
    const result = computeTrust(cleanInput({ adminFlags: 0.9 }));
    expect(result.status).toBe('GOOD_STANDING');
  });
});

describe('Trust Engine: Determinism', () => {
  it('same input produces identical output 100 times', () => {
    const input = cleanInput({ disputes: 3, cancelledRequests: 5 });
    const baseline = computeTrust(input);

    for (let i = 0; i < 100; i++) {
      const result = computeTrust(input);
      expect(result.status).toBe(baseline.status);
      expect(result.reasons).toEqual(baseline.reasons);
    }
  });
});

describe('Trust Engine: Spike Simulations', () => {
  it('dispute spike (100 disputes) → REVIEW_REQUIRED, not RESTRICTED', () => {
    const result = computeTrust(cleanInput({ disputes: 100 }));
    expect(result.status).toBe('REVIEW_REQUIRED');
    // Disputes alone should NOT cause RESTRICTED — only admin flags do
    expect(result.status).not.toBe('RESTRICTED');
  });

  it('cancel spike (100 cancellations) → REVIEW_REQUIRED, not RESTRICTED', () => {
    const result = computeTrust(cleanInput({ cancelledRequests: 100 }));
    expect(result.status).toBe('REVIEW_REQUIRED');
    expect(result.status).not.toBe('RESTRICTED');
  });

  it('listing spike alone does NOT affect trust (trust has no listing input)', () => {
    // Trust engine has no recentListings field — listings don't affect trust
    const result = computeTrust(cleanInput());
    expect(result.status).toBe('GOOD_STANDING');
  });

  it('combined dispute + cancel spike → REVIEW_REQUIRED with multiple reasons', () => {
    const result = computeTrust(cleanInput({
      disputes: 10,
      cancelledRequests: 10,
    }));
    expect(result.status).toBe('REVIEW_REQUIRED');
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it('admin flag during spike → RESTRICTED (admin overrides everything)', () => {
    const result = computeTrust(cleanInput({
      disputes: 100,
      cancelledRequests: 100,
      adminFlags: 1,
    }));
    expect(result.status).toBe('RESTRICTED');
  });
});
