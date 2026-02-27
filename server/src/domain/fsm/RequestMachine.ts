/**
 * Request FSM — lifecycle of a buyer-to-seller transaction request.
 *
 * A Request is the buyer-side counterpart to a Listing.
 * One approved Listing can have multiple Requests over its lifetime,
 * but only one can be in `accepted` / `meeting_scheduled` at a time
 * (enforced at the application layer, not here).
 *
 * Pure domain logic. No UI, no React, no styling.
 */

import {
  type MachineDefinition,
  type MachineInstance,
  createMachine,
} from './types';

/* ── States ────────────────────────────────────────────────── */

export type RequestState =
  | 'idle'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'meeting_scheduled'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'withdrawn'
  | 'disputed'
  | 'resolved';

/* ── Events ────────────────────────────────────────────────── */

export type RequestEvent =
  | 'SEND'
  | 'ACCEPT'
  | 'DECLINE'
  | 'EXPIRE'
  | 'SCHEDULE'
  | 'CONFIRM'
  | 'CANCEL'
  | 'WITHDRAW'
  | 'DISPUTE'
  | 'RESOLVE'
  | 'RETRY';

/* ── Definition ────────────────────────────────────────────── */

export const RequestDefinition: MachineDefinition<
  RequestState,
  RequestEvent
> = {
  id: 'Request',
  initial: 'idle',
  transitions: {
    idle: {
      SEND: 'sent',
    },
    sent: {
      ACCEPT: 'accepted',
      DECLINE: 'declined',
      EXPIRE: 'expired',
      WITHDRAW: 'withdrawn',
    },
    accepted: {
      SCHEDULE: 'meeting_scheduled',
      CANCEL: 'cancelled',
      DISPUTE: 'disputed',
    },
    declined: {
      RETRY: 'idle',
    },
    meeting_scheduled: {
      CONFIRM: 'completed',
      CANCEL: 'cancelled',
      DISPUTE: 'disputed',
    },
    completed: {
      DISPUTE: 'disputed',
    },
    expired: {
      RETRY: 'idle',
    },
    cancelled: {
      RETRY: 'idle',
    },
    withdrawn: {
      RETRY: 'idle',
    },
    disputed: {
      RESOLVE: 'resolved',
    },
    resolved: {},
  },
} as const;

/* ── Factory ───────────────────────────────────────────────── */

export type RequestMachine = MachineInstance<RequestState, RequestEvent>;

export function createRequestMachine(
  snapshot?: { state: RequestState; history: ReadonlyArray<readonly [RequestEvent, RequestState, RequestState]> },
): RequestMachine {
  return createMachine(RequestDefinition, snapshot);
}

/* ── Helpers ───────────────────────────────────────────────── */

export function requestNextStates(state: RequestState): RequestState[] {
  const row = RequestDefinition.transitions[state];
  if (!row) return [];
  return [...new Set(Object.values(row))] as RequestState[];
}

export function isRequestTerminal(state: RequestState): boolean {
  return requestNextStates(state).length === 0;
}

export function isRequestActive(state: RequestState): boolean {
  return (
    state === 'sent' ||
    state === 'accepted' ||
    state === 'meeting_scheduled'
  );
}

export function isRequestFailed(state: RequestState): boolean {
  return (
    state === 'declined' ||
    state === 'expired' ||
    state === 'cancelled' ||
    state === 'withdrawn'
  );
}

export function canRetryRequest(state: RequestState): boolean {
  return (
    state === 'declined' ||
    state === 'expired' ||
    state === 'cancelled' ||
    state === 'withdrawn'
  );
}
