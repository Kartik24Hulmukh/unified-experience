/**
 * Restriction Engine Tests
 *
 * Validates:
 *   - Admin override → always restricted
 *   - Trust RESTRICTED → restricted
 *   - Active disputes >= threshold → restricted
 *   - Otherwise → unrestricted
 *   - All actions blocked when restricted
 *   - No bypass possible
 *   - Input sanitization
 *   - isActionBlocked convenience
 */

import { describe, it, expect } from 'vitest';
import {
  computeRestriction,
  isActionBlocked,
  RESTRICTION_THRESHOLDS,
  type RestrictionInput,
  type RestrictableAction,
} from '@/domain/restrictionEngine';

/* ── All actions ──────────────────────────────────────────── */

const ALL_ACTIONS: RestrictableAction[] = [
  'CREATE_LISTING',
  'REQUEST_EXCHANGE',
  'REQUEST_CONTACT',
];

/* ── Helper ────────────────────────────────────────────────── */

function cleanInput(overrides: Partial<RestrictionInput> = {}): RestrictionInput {
  return {
    trustStatus: 'GOOD_STANDING',
    activeDisputes: 0,
    adminOverride: false,
    ...overrides,
  };
}

describe('Restriction Engine: Admin Override', () => {
  it('admin override → restricted regardless of trust & disputes', () => {
    const result = computeRestriction(cleanInput({ adminOverride: true }));
    expect(result.isRestricted).toBe(true);
    expect(result.blockedActions).toEqual(ALL_ACTIONS);
    expect(result.reasons[0]).toContain('Administrative override');
  });

  it('admin override with GOOD_STANDING + 0 disputes → still restricted', () => {
    const result = computeRestriction({
      trustStatus: 'GOOD_STANDING',
      activeDisputes: 0,
      adminOverride: true,
    });
    expect(result.isRestricted).toBe(true);
  });

  it('admin override takes priority over trust and disputes', () => {
    const result = computeRestriction({
      trustStatus: 'RESTRICTED',
      activeDisputes: 100,
      adminOverride: true,
    });
    expect(result.isRestricted).toBe(true);
    // Only admin override reason (short-circuits)
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain('Administrative override');
  });
});

describe('Restriction Engine: Trust-Based Restriction', () => {
  it('trust RESTRICTED → restricted', () => {
    const result = computeRestriction(cleanInput({ trustStatus: 'RESTRICTED' }));
    expect(result.isRestricted).toBe(true);
    expect(result.blockedActions).toEqual(ALL_ACTIONS);
  });

  it('trust REVIEW_REQUIRED → NOT restricted (review ≠ restriction)', () => {
    const result = computeRestriction(cleanInput({ trustStatus: 'REVIEW_REQUIRED' }));
    expect(result.isRestricted).toBe(false);
    expect(result.blockedActions).toEqual([]);
  });

  it('trust GOOD_STANDING → NOT restricted', () => {
    const result = computeRestriction(cleanInput({ trustStatus: 'GOOD_STANDING' }));
    expect(result.isRestricted).toBe(false);
  });
});

describe('Restriction Engine: Dispute-Based Restriction', () => {
  it('active disputes at threshold → restricted', () => {
    const result = computeRestriction(cleanInput({
      activeDisputes: RESTRICTION_THRESHOLDS.disputeLimit,
    }));
    expect(result.isRestricted).toBe(true);
    expect(result.reasons[0]).toContain('Active disputes');
  });

  it('active disputes above threshold → restricted', () => {
    const result = computeRestriction(cleanInput({
      activeDisputes: RESTRICTION_THRESHOLDS.disputeLimit + 5,
    }));
    expect(result.isRestricted).toBe(true);
  });

  it('active disputes below threshold → NOT restricted', () => {
    const result = computeRestriction(cleanInput({
      activeDisputes: RESTRICTION_THRESHOLDS.disputeLimit - 1,
    }));
    expect(result.isRestricted).toBe(false);
  });
});

describe('Restriction Engine: No Bypass', () => {
  it('cannot bypass restriction by GOOD_STANDING trust with high disputes', () => {
    const result = computeRestriction({
      trustStatus: 'GOOD_STANDING',
      activeDisputes: 10,
      adminOverride: false,
    });
    expect(result.isRestricted).toBe(true);
  });

  it('cannot bypass by low disputes when trust is RESTRICTED', () => {
    const result = computeRestriction({
      trustStatus: 'RESTRICTED',
      activeDisputes: 0,
      adminOverride: false,
    });
    expect(result.isRestricted).toBe(true);
  });
});

describe('Restriction Engine: Unrestricted State', () => {
  it('clean input → unrestricted', () => {
    const result = computeRestriction(cleanInput());
    expect(result.isRestricted).toBe(false);
    expect(result.blockedActions).toEqual([]);
    expect(result.reasons).toEqual([]);
  });
});

describe('Restriction Engine: isActionBlocked', () => {
  it('all actions blocked when restricted', () => {
    const result = computeRestriction(cleanInput({ adminOverride: true }));
    for (const action of ALL_ACTIONS) {
      expect(isActionBlocked(result, action)).toBe(true);
    }
  });

  it('no actions blocked when unrestricted', () => {
    const result = computeRestriction(cleanInput());
    for (const action of ALL_ACTIONS) {
      expect(isActionBlocked(result, action)).toBe(false);
    }
  });
});

describe('Restriction Engine: Input Sanitization', () => {
  it('negative active disputes treated as 0 → unrestricted', () => {
    const result = computeRestriction(cleanInput({ activeDisputes: -10 }));
    expect(result.isRestricted).toBe(false);
  });

  it('NaN active disputes treated as 0 → unrestricted', () => {
    const result = computeRestriction(cleanInput({ activeDisputes: NaN }));
    expect(result.isRestricted).toBe(false);
  });

  it('Infinity active disputes treated as 0 → unrestricted', () => {
    const result = computeRestriction(cleanInput({ activeDisputes: Infinity }));
    expect(result.isRestricted).toBe(false);
  });

  it('adminOverride coerced to boolean', () => {
    // @ts-expect-error — intentionally testing coercion
    const result = computeRestriction(cleanInput({ adminOverride: 1 }));
    expect(result.isRestricted).toBe(true);
  });
});
