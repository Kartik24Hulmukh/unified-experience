/**
 * Dispute FSM + Dispute Service Tests
 *
 * Validates:
 *   - Dispute FSM transitions (OPEN → UNDER_REVIEW → RESOLVED/REJECTED/ESCALATED)
 *   - Invalid transitions blocked
 *   - Terminal states cannot transition further
 *   - disputeService.createDispute creates in OPEN state
 *   - disputeService.transitionDispute advances FSM correctly
 *   - Terminal guard in transitionDispute
 *   - Timestamps updated correctly
 *   - Available actions match FSM state
 *   - Active/resolved dispute counts
 *   - Store reset for test isolation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDisputeMachine,
  DisputeDefinition,
  isDisputeTerminal,
  isDisputeActive,
  isDisputeResolved,
  type DisputeState,
  type DisputeEvent,
} from '@/domain/disputeEngine';
import {
  createDispute,
  transitionDispute,
  getDispute,
  getAllDisputes,
  getDisputesAgainstUser,
  countActiveDisputesAgainst,
  countResolvedDisputesAgainst,
  getAvailableActions,
  getDisputeCountsForUser,
  resetDisputeStore,
} from '@/services/disputeService';
import { InvalidTransitionError } from '@/lib/fsm/types';

/* ── Reset store before each test ──────────────────────────── */

beforeEach(() => {
  resetDisputeStore();
});

/* ═══════════════════════════════════════════════════
   Dispute FSM (Pure)
   ═══════════════════════════════════════════════════ */

describe('Dispute FSM: Valid Transitions', () => {
  const validPaths: Array<[DisputeState, DisputeEvent, DisputeState]> = [
    ['OPEN', 'BEGIN_REVIEW', 'UNDER_REVIEW'],
    ['UNDER_REVIEW', 'RESOLVE', 'RESOLVED'],
    ['UNDER_REVIEW', 'REJECT', 'REJECTED'],
    ['UNDER_REVIEW', 'ESCALATE', 'ESCALATED'],
  ];

  it.each(validPaths)(
    '%s + %s → %s',
    (fromState, event, expectedState) => {
      const m = createDisputeMachine({ state: fromState, history: [] });
      const next = m.send(event);
      expect(next.state).toBe(expectedState);
    },
  );
});

describe('Dispute FSM: Invalid Transitions Blocked', () => {
  const ALL_STATES: DisputeState[] = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'ESCALATED'];
  const ALL_EVENTS: DisputeEvent[] = ['BEGIN_REVIEW', 'RESOLVE', 'REJECT', 'ESCALATE'];

  const invalidCases: Array<[DisputeState, DisputeEvent]> = [];
  for (const state of ALL_STATES) {
    const row = DisputeDefinition.transitions[state] ?? {};
    const validEvents = new Set(Object.keys(row));
    for (const event of ALL_EVENTS) {
      if (!validEvents.has(event)) {
        invalidCases.push([state, event]);
      }
    }
  }

  it.each(invalidCases)(
    '%s + %s → throws InvalidTransitionError',
    (fromState, event) => {
      const m = createDisputeMachine({ state: fromState, history: [] });
      expect(() => m.send(event)).toThrow(InvalidTransitionError);
    },
  );
});

describe('Dispute FSM: Terminal States', () => {
  it.each(['RESOLVED', 'REJECTED', 'ESCALATED'] as DisputeState[])(
    '%s is terminal',
    (state) => {
      expect(isDisputeTerminal(state)).toBe(true);
    },
  );

  it.each(['OPEN', 'UNDER_REVIEW'] as DisputeState[])(
    '%s is NOT terminal',
    (state) => {
      expect(isDisputeTerminal(state)).toBe(false);
    },
  );
});

describe('Dispute FSM: No Cycles', () => {
  it('RESOLVED cannot go back to UNDER_REVIEW', () => {
    const m = createDisputeMachine({ state: 'RESOLVED', history: [] });
    expect(m.can('BEGIN_REVIEW')).toBe(false);
  });

  it('REJECTED cannot go back to OPEN', () => {
    const m = createDisputeMachine({ state: 'REJECTED', history: [] });
    expect(m.can('BEGIN_REVIEW')).toBe(false);
  });

  it('ESCALATED cannot be resolved', () => {
    const m = createDisputeMachine({ state: 'ESCALATED', history: [] });
    expect(m.can('RESOLVE')).toBe(false);
    expect(m.can('REJECT')).toBe(false);
  });
});

describe('Dispute FSM: Helpers', () => {
  it('isDisputeActive for OPEN and UNDER_REVIEW', () => {
    expect(isDisputeActive('OPEN')).toBe(true);
    expect(isDisputeActive('UNDER_REVIEW')).toBe(true);
    expect(isDisputeActive('RESOLVED')).toBe(false);
    expect(isDisputeActive('REJECTED')).toBe(false);
    expect(isDisputeActive('ESCALATED')).toBe(false);
  });

  it('isDisputeResolved only for RESOLVED', () => {
    expect(isDisputeResolved('RESOLVED')).toBe(true);
    expect(isDisputeResolved('REJECTED')).toBe(false);
    expect(isDisputeResolved('ESCALATED')).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════
   Dispute Service (Stateful)
   ═══════════════════════════════════════════════════ */

describe('Dispute Service: createDispute', () => {
  it('creates a dispute in OPEN state', () => {
    const d = createDispute({
      listingId: 'listing-1',
      initiatorId: 'student-a',
      targetId: 'student-b',
      reason: 'Item not as described',
    });
    expect(d.state).toBe('OPEN');
    expect(d.listingId).toBe('listing-1');
    expect(d.initiatorId).toBe('student-a');
    expect(d.targetId).toBe('student-b');
    expect(d.reason).toBe('Item not as described');
    expect(d.timestamps.filedAt).toBeDefined();
  });

  it('assigns unique IDs', () => {
    const d1 = createDispute({ listingId: 'l1', initiatorId: 'a', targetId: 'b', reason: 'r' });
    const d2 = createDispute({ listingId: 'l2', initiatorId: 'c', targetId: 'd', reason: 's' });
    expect(d1.id).not.toBe(d2.id);
  });
});

describe('Dispute Service: transitionDispute', () => {
  it('OPEN → BEGIN_REVIEW → UNDER_REVIEW', () => {
    const d = createDispute({ listingId: 'l1', initiatorId: 'a', targetId: 'b', reason: 'r' });
    const updated = transitionDispute(d.id, 'BEGIN_REVIEW');
    expect(updated.state).toBe('UNDER_REVIEW');
    expect(updated.timestamps.reviewStartedAt).toBeDefined();
  });

  it('UNDER_REVIEW → RESOLVE → RESOLVED with note', () => {
    const d = createDispute({ listingId: 'l1', initiatorId: 'a', targetId: 'b', reason: 'r' });
    transitionDispute(d.id, 'BEGIN_REVIEW');
    const resolved = transitionDispute(d.id, 'RESOLVE', 'Issue resolved via refund');
    expect(resolved.state).toBe('RESOLVED');
    expect(resolved.resolutionNote).toBe('Issue resolved via refund');
    expect(resolved.timestamps.resolvedAt).toBeDefined();
  });

  it('UNDER_REVIEW → REJECT → REJECTED', () => {
    const d = createDispute({ listingId: 'l1', initiatorId: 'a', targetId: 'b', reason: 'r' });
    transitionDispute(d.id, 'BEGIN_REVIEW');
    const rejected = transitionDispute(d.id, 'REJECT');
    expect(rejected.state).toBe('REJECTED');
    expect(rejected.timestamps.rejectedAt).toBeDefined();
  });

  it('UNDER_REVIEW → ESCALATE → ESCALATED', () => {
    const d = createDispute({ listingId: 'l1', initiatorId: 'a', targetId: 'b', reason: 'r' });
    transitionDispute(d.id, 'BEGIN_REVIEW');
    const escalated = transitionDispute(d.id, 'ESCALATE');
    expect(escalated.state).toBe('ESCALATED');
    expect(escalated.timestamps.escalatedAt).toBeDefined();
  });
});

describe('Dispute Service: Terminal Guard', () => {
  it('cannot transition from RESOLVED', () => {
    const d = createDispute({ listingId: 'l1', initiatorId: 'a', targetId: 'b', reason: 'r' });
    transitionDispute(d.id, 'BEGIN_REVIEW');
    transitionDispute(d.id, 'RESOLVE');

    expect(() => transitionDispute(d.id, 'BEGIN_REVIEW')).toThrow('terminal state');
    expect(() => transitionDispute(d.id, 'RESOLVE')).toThrow('terminal state');
  });

  it('cannot transition from REJECTED', () => {
    const d = createDispute({ listingId: 'l1', initiatorId: 'a', targetId: 'b', reason: 'r' });
    transitionDispute(d.id, 'BEGIN_REVIEW');
    transitionDispute(d.id, 'REJECT');

    expect(() => transitionDispute(d.id, 'BEGIN_REVIEW')).toThrow('terminal state');
  });

  it('cannot transition from ESCALATED', () => {
    const d = createDispute({ listingId: 'l1', initiatorId: 'a', targetId: 'b', reason: 'r' });
    transitionDispute(d.id, 'BEGIN_REVIEW');
    transitionDispute(d.id, 'ESCALATE');

    expect(() => transitionDispute(d.id, 'RESOLVE')).toThrow('terminal state');
  });
});

describe('Dispute Service: Invalid Transitions', () => {
  it('OPEN → RESOLVE throws (must go through UNDER_REVIEW)', () => {
    const d = createDispute({ listingId: 'l1', initiatorId: 'a', targetId: 'b', reason: 'r' });
    expect(() => transitionDispute(d.id, 'RESOLVE')).toThrow(InvalidTransitionError);
  });

  it('OPEN → REJECT throws', () => {
    const d = createDispute({ listingId: 'l1', initiatorId: 'a', targetId: 'b', reason: 'r' });
    expect(() => transitionDispute(d.id, 'REJECT')).toThrow(InvalidTransitionError);
  });

  it('non-existent dispute throws', () => {
    expect(() => transitionDispute('fake-id', 'BEGIN_REVIEW')).toThrow('not found');
  });
});

describe('Dispute Service: Available Actions', () => {
  it('OPEN → only BEGIN_REVIEW available', () => {
    const d = createDispute({ listingId: 'l1', initiatorId: 'a', targetId: 'b', reason: 'r' });
    const actions = getAvailableActions(d.id);
    expect(actions).toEqual(['BEGIN_REVIEW']);
  });

  it('UNDER_REVIEW → RESOLVE, REJECT, ESCALATE available', () => {
    const d = createDispute({ listingId: 'l1', initiatorId: 'a', targetId: 'b', reason: 'r' });
    transitionDispute(d.id, 'BEGIN_REVIEW');
    const actions = getAvailableActions(d.id);
    expect(actions).toContain('RESOLVE');
    expect(actions).toContain('REJECT');
    expect(actions).toContain('ESCALATE');
    expect(actions).toHaveLength(3);
  });

  it('RESOLVED → no actions available', () => {
    const d = createDispute({ listingId: 'l1', initiatorId: 'a', targetId: 'b', reason: 'r' });
    transitionDispute(d.id, 'BEGIN_REVIEW');
    transitionDispute(d.id, 'RESOLVE');
    const actions = getAvailableActions(d.id);
    expect(actions).toEqual([]);
  });
});

describe('Dispute Service: Query & Counts', () => {
  it('counts active disputes against a user', () => {
    createDispute({ listingId: 'l1', initiatorId: 'a', targetId: 'target', reason: 'r' });
    createDispute({ listingId: 'l2', initiatorId: 'b', targetId: 'target', reason: 's' });
    createDispute({ listingId: 'l3', initiatorId: 'c', targetId: 'other', reason: 't' });

    expect(countActiveDisputesAgainst('target')).toBe(2);
    expect(countActiveDisputesAgainst('other')).toBe(1);
    expect(countActiveDisputesAgainst('nobody')).toBe(0);
  });

  it('resolved disputes not counted as active', () => {
    const d = createDispute({ listingId: 'l1', initiatorId: 'a', targetId: 'target', reason: 'r' });
    transitionDispute(d.id, 'BEGIN_REVIEW');
    transitionDispute(d.id, 'RESOLVE');

    expect(countActiveDisputesAgainst('target')).toBe(0);
    expect(countResolvedDisputesAgainst('target')).toBe(1);
  });

  it('getDisputeCountsForUser returns correct counts', () => {
    const d1 = createDispute({ listingId: 'l1', initiatorId: 'a', targetId: 'target', reason: 'r' });
    const d2 = createDispute({ listingId: 'l2', initiatorId: 'b', targetId: 'target', reason: 's' });
    createDispute({ listingId: 'l3', initiatorId: 'c', targetId: 'target', reason: 't' });

    // Resolve d1, reject d2
    transitionDispute(d1.id, 'BEGIN_REVIEW');
    transitionDispute(d1.id, 'RESOLVE');
    transitionDispute(d2.id, 'BEGIN_REVIEW');
    transitionDispute(d2.id, 'REJECT');

    const counts = getDisputeCountsForUser('target');
    expect(counts.activeDisputes).toBe(1); // d3 still OPEN
    expect(counts.resolvedDisputes).toBe(1); // d1
    expect(counts.totalDisputes).toBe(3);
  });
});

describe('Dispute Service: Store Reset', () => {
  it('resetDisputeStore clears all data', () => {
    createDispute({ listingId: 'l1', initiatorId: 'a', targetId: 'b', reason: 'r' });
    expect(getAllDisputes()).toHaveLength(1);

    resetDisputeStore();
    expect(getAllDisputes()).toHaveLength(0);
  });
});
