/**
 * Request FSM Tests
 *
 * Validates every valid transition, blocks every invalid one,
 * confirms terminal state behavior, and tests retry loops.
 */

import { describe, it, expect } from 'vitest';
import {
  createRequestMachine,
  RequestDefinition,
  requestNextStates,
  isRequestTerminal,
  isRequestActive,
  isRequestFailed,
  canRetryRequest,
  type RequestState,
  type RequestEvent,
} from '@/lib/fsm/RequestMachine';
import { InvalidTransitionError } from '@/lib/fsm/types';

/* ── All defined states & events ──────────────────────────── */

const ALL_STATES: RequestState[] = [
  'idle', 'sent', 'accepted', 'declined', 'meeting_scheduled',
  'completed', 'expired', 'cancelled', 'withdrawn', 'disputed', 'resolved',
];

const ALL_EVENTS: RequestEvent[] = [
  'SEND', 'ACCEPT', 'DECLINE', 'EXPIRE', 'SCHEDULE',
  'CONFIRM', 'CANCEL', 'WITHDRAW', 'DISPUTE', 'RESOLVE', 'RETRY',
];

describe('Request FSM: Valid Transitions', () => {
  const validPaths: Array<[RequestState, RequestEvent, RequestState]> = [
    ['idle', 'SEND', 'sent'],
    ['sent', 'ACCEPT', 'accepted'],
    ['sent', 'DECLINE', 'declined'],
    ['sent', 'EXPIRE', 'expired'],
    ['sent', 'WITHDRAW', 'withdrawn'],
    ['accepted', 'SCHEDULE', 'meeting_scheduled'],
    ['accepted', 'CANCEL', 'cancelled'],
    ['declined', 'RETRY', 'idle'],
    ['meeting_scheduled', 'CONFIRM', 'completed'],
    ['meeting_scheduled', 'CANCEL', 'cancelled'],
    ['completed', 'DISPUTE', 'disputed'],
    ['expired', 'RETRY', 'idle'],
    ['cancelled', 'RETRY', 'idle'],
    ['withdrawn', 'RETRY', 'idle'],
    ['disputed', 'RESOLVE', 'resolved'],
  ];

  it.each(validPaths)(
    '%s + %s → %s',
    (fromState, event, expectedState) => {
      const m = createRequestMachine({ state: fromState, history: [] });
      const next = m.send(event);
      expect(next.state).toBe(expectedState);
    },
  );
});

describe('Request FSM: Invalid Transitions Blocked', () => {
  const invalidCases: Array<[RequestState, RequestEvent]> = [];

  for (const state of ALL_STATES) {
    const row = RequestDefinition.transitions[state] ?? {};
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
      const m = createRequestMachine({ state: fromState, history: [] });
      expect(() => m.send(event)).toThrow(InvalidTransitionError);
    },
  );
});

describe('Request FSM: Terminal States', () => {
  it('resolved is terminal', () => {
    expect(isRequestTerminal('resolved')).toBe(true);
    expect(requestNextStates('resolved')).toEqual([]);
  });

  it('non-terminal states have outgoing transitions', () => {
    const nonTerminal = ALL_STATES.filter(s => s !== 'resolved');
    for (const s of nonTerminal) {
      expect(isRequestTerminal(s)).toBe(false);
    }
  });
});

describe('Request FSM: Happy Path', () => {
  it('idle → sent → accepted → meeting → completed', () => {
    let m = createRequestMachine();
    expect(m.state).toBe('idle');

    m = m.send('SEND');
    expect(m.state).toBe('sent');
    expect(isRequestActive(m.state)).toBe(true);

    m = m.send('ACCEPT');
    expect(m.state).toBe('accepted');
    expect(isRequestActive(m.state)).toBe(true);

    m = m.send('SCHEDULE');
    expect(m.state).toBe('meeting_scheduled');
    expect(isRequestActive(m.state)).toBe(true);

    m = m.send('CONFIRM');
    expect(m.state).toBe('completed');
    expect(isRequestActive(m.state)).toBe(false);
  });
});

describe('Request FSM: Dispute Path', () => {
  it('completed → disputed → resolved (terminal)', () => {
    let m = createRequestMachine({ state: 'completed', history: [] });
    m = m.send('DISPUTE');
    expect(m.state).toBe('disputed');
    m = m.send('RESOLVE');
    expect(m.state).toBe('resolved');
    expect(isRequestTerminal(m.state)).toBe(true);
  });

  it('cannot dispute before completion', () => {
    for (const state of ['idle', 'sent', 'accepted', 'meeting_scheduled'] as RequestState[]) {
      const m = createRequestMachine({ state, history: [] });
      expect(m.can('DISPUTE')).toBe(false);
    }
  });
});

describe('Request FSM: Retry Loops', () => {
  const retryableStates: RequestState[] = ['declined', 'expired', 'cancelled', 'withdrawn'];

  it.each(retryableStates)('%s can RETRY back to idle', (state) => {
    const m = createRequestMachine({ state, history: [] });
    expect(canRetryRequest(state)).toBe(true);
    const retried = m.send('RETRY');
    expect(retried.state).toBe('idle');
  });

  it('non-retryable states cannot RETRY', () => {
    const nonRetryable: RequestState[] = ['idle', 'sent', 'accepted', 'meeting_scheduled', 'completed', 'disputed', 'resolved'];
    for (const state of nonRetryable) {
      expect(canRetryRequest(state)).toBe(false);
    }
  });

  it('retry loop does NOT create infinite cycles (bounded by explicit send)', () => {
    let m = createRequestMachine();
    // Cycle: idle → sent → declined → (retry) → idle → sent → declined
    m = m.send('SEND');
    m = m.send('DECLINE');
    m = m.send('RETRY');
    expect(m.state).toBe('idle');
    expect(m.history).toHaveLength(3);

    m = m.send('SEND');
    m = m.send('DECLINE');
    m = m.send('RETRY');
    expect(m.state).toBe('idle');
    expect(m.history).toHaveLength(6);
  });
});

describe('Request FSM: Helpers', () => {
  it('isRequestActive checks sent, accepted, meeting_scheduled', () => {
    expect(isRequestActive('sent')).toBe(true);
    expect(isRequestActive('accepted')).toBe(true);
    expect(isRequestActive('meeting_scheduled')).toBe(true);
    expect(isRequestActive('idle')).toBe(false);
    expect(isRequestActive('completed')).toBe(false);
    expect(isRequestActive('resolved')).toBe(false);
  });

  it('isRequestFailed checks declined, expired, cancelled, withdrawn', () => {
    expect(isRequestFailed('declined')).toBe(true);
    expect(isRequestFailed('expired')).toBe(true);
    expect(isRequestFailed('cancelled')).toBe(true);
    expect(isRequestFailed('withdrawn')).toBe(true);
    expect(isRequestFailed('completed')).toBe(false);
    expect(isRequestFailed('idle')).toBe(false);
  });
});
