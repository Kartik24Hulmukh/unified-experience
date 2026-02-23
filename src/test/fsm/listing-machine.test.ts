/**
 * Listing FSM Tests
 *
 * Validates every valid transition, blocks every invalid one,
 * confirms terminal state behavior, and tests helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  createListingMachine,
  ListingDefinition,
  listingNextStates,
  isListingTerminal,
  isListingVisible,
  isListingAwaitingAdmin,
  type ListingState,
  type ListingEvent,
} from '@/lib/fsm/ListingMachine';
import { InvalidTransitionError } from '@/lib/fsm/types';

/* ── All defined states & events ──────────────────────────── */

const ALL_STATES: ListingState[] = [
  'draft', 'pending_review', 'approved', 'rejected',
  'interest_received', 'in_transaction', 'completed',
  'expired', 'flagged', 'archived', 'removed',
];

const ALL_EVENTS: ListingEvent[] = [
  'SUBMIT', 'APPROVE', 'REJECT', 'RESUBMIT', 'RECEIVE_INTEREST',
  'ACCEPT_REQUEST', 'DECLINE_REQUEST', 'CONFIRM_EXCHANGE',
  'CANCEL_TRANSACTION', 'EXPIRE', 'FLAG', 'RESOLVE_FLAG',
  'ARCHIVE', 'REMOVE', 'RELIST',
];

describe('Listing FSM: Valid Transitions', () => {
  const validPaths: Array<[ListingState, ListingEvent, ListingState]> = [
    ['draft', 'SUBMIT', 'pending_review'],
    ['pending_review', 'APPROVE', 'approved'],
    ['pending_review', 'REJECT', 'rejected'],
    ['approved', 'RECEIVE_INTEREST', 'interest_received'],
    ['approved', 'EXPIRE', 'expired'],
    ['approved', 'FLAG', 'flagged'],
    ['approved', 'REMOVE', 'removed'],
    ['rejected', 'RESUBMIT', 'pending_review'],
    ['interest_received', 'ACCEPT_REQUEST', 'in_transaction'],
    ['interest_received', 'DECLINE_REQUEST', 'approved'],
    ['interest_received', 'EXPIRE', 'expired'],
    ['interest_received', 'FLAG', 'flagged'],
    ['in_transaction', 'CONFIRM_EXCHANGE', 'completed'],
    ['in_transaction', 'CANCEL_TRANSACTION', 'approved'],
    ['in_transaction', 'FLAG', 'flagged'],
    ['completed', 'ARCHIVE', 'archived'],
    ['expired', 'RELIST', 'draft'],
    ['expired', 'ARCHIVE', 'archived'],
    ['flagged', 'RESOLVE_FLAG', 'approved'],
    ['flagged', 'REMOVE', 'removed'],
    ['removed', 'ARCHIVE', 'archived'],
  ];

  it.each(validPaths)(
    '%s + %s → %s',
    (fromState, event, expectedState) => {
      const m = createListingMachine({ state: fromState, history: [] });
      const next = m.send(event);
      expect(next.state).toBe(expectedState);
    },
  );
});

describe('Listing FSM: Invalid Transitions Blocked', () => {
  // For each state, compute which events are NOT in its transition row
  const invalidCases: Array<[ListingState, ListingEvent]> = [];

  for (const state of ALL_STATES) {
    const row = ListingDefinition.transitions[state] ?? {};
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
      const m = createListingMachine({ state: fromState, history: [] });
      expect(() => m.send(event)).toThrow(InvalidTransitionError);
    },
  );
});

describe('Listing FSM: Terminal States', () => {
  it('archived has no outgoing transitions', () => {
    expect(isListingTerminal('archived')).toBe(true);
    expect(listingNextStates('archived')).toEqual([]);
  });

  it('non-terminal states have outgoing transitions', () => {
    const nonTerminal: ListingState[] = [
      'draft', 'pending_review', 'approved', 'rejected',
      'interest_received', 'in_transaction', 'completed',
      'expired', 'flagged', 'removed',
    ];
    for (const s of nonTerminal) {
      expect(isListingTerminal(s)).toBe(false);
      expect(listingNextStates(s).length).toBeGreaterThan(0);
    }
  });
});

describe('Listing FSM: Happy Path', () => {
  it('draft → pending_review → approved → interest → in_transaction → completed → archived', () => {
    let m = createListingMachine();
    expect(m.state).toBe('draft');

    m = m.send('SUBMIT');
    expect(m.state).toBe('pending_review');

    m = m.send('APPROVE');
    expect(m.state).toBe('approved');

    m = m.send('RECEIVE_INTEREST');
    expect(m.state).toBe('interest_received');

    m = m.send('ACCEPT_REQUEST');
    expect(m.state).toBe('in_transaction');

    m = m.send('CONFIRM_EXCHANGE');
    expect(m.state).toBe('completed');

    m = m.send('ARCHIVE');
    expect(m.state).toBe('archived');
    expect(isListingTerminal(m.state)).toBe(true);
  });
});

describe('Listing FSM: Rejection + Resubmit Path', () => {
  it('draft → pending_review → rejected → pending_review → approved', () => {
    let m = createListingMachine();
    m = m.send('SUBMIT');
    m = m.send('REJECT');
    expect(m.state).toBe('rejected');

    m = m.send('RESUBMIT');
    expect(m.state).toBe('pending_review');

    m = m.send('APPROVE');
    expect(m.state).toBe('approved');
  });
});

describe('Listing FSM: Flag + Resolution Path', () => {
  it('approved → flagged → resolved back to approved', () => {
    let m = createListingMachine({ state: 'approved', history: [] });
    m = m.send('FLAG');
    expect(m.state).toBe('flagged');
    expect(isListingAwaitingAdmin(m.state)).toBe(true);

    m = m.send('RESOLVE_FLAG');
    expect(m.state).toBe('approved');
  });

  it('flagged → removed → archived', () => {
    let m = createListingMachine({ state: 'flagged', history: [] });
    m = m.send('REMOVE');
    expect(m.state).toBe('removed');
    m = m.send('ARCHIVE');
    expect(m.state).toBe('archived');
  });
});

describe('Listing FSM: Expiry + Relist Path', () => {
  it('approved → expired → relist → draft', () => {
    let m = createListingMachine({ state: 'approved', history: [] });
    m = m.send('EXPIRE');
    expect(m.state).toBe('expired');
    m = m.send('RELIST');
    expect(m.state).toBe('draft');
  });
});

describe('Listing FSM: Helpers', () => {
  it('isListingVisible checks approved and interest_received', () => {
    expect(isListingVisible('approved')).toBe(true);
    expect(isListingVisible('interest_received')).toBe(true);
    expect(isListingVisible('draft')).toBe(false);
    expect(isListingVisible('pending_review')).toBe(false);
    expect(isListingVisible('archived')).toBe(false);
  });

  it('isListingAwaitingAdmin checks pending_review and flagged', () => {
    expect(isListingAwaitingAdmin('pending_review')).toBe(true);
    expect(isListingAwaitingAdmin('flagged')).toBe(true);
    expect(isListingAwaitingAdmin('approved')).toBe(false);
    expect(isListingAwaitingAdmin('draft')).toBe(false);
  });
});
