/**
 * Request FSM — lifecycle of a buyer-to-seller transaction request.
 *
 * States derived from existing UI assumptions:
 *   ResalePage     steps 3–5 ("Connect → Exchange → Complete")
 *   Notifications  "New Transaction Request" (message type)
 *   AdminPage      "Disputes" tab (dispute state)
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

/**
 * Every discrete state a transaction request can occupy.
 *
 * ```
 * idle ──SEND──▸ sent ──ACCEPT──▸ accepted ──SCHEDULE──▸ meeting_scheduled
 *                    ──DECLINE─▸ declined                ──CONFIRM──▸ completed
 *                    ──EXPIRE──▸ expired                  ──CANCEL───▸ cancelled
 *                    ──WITHDRAW▸ withdrawn
 *
 * accepted ──CANCEL──▸ cancelled
 *
 * completed ──DISPUTE──▸ disputed ──RESOLVE──▸ resolved
 *
 * declined ──RETRY──▸ idle
 * expired  ──RETRY──▸ idle
 * ```
 */
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
    /* ── Buyer initiates interest ── */
    idle: {
      SEND: 'sent',
    },

    /* ── Awaiting seller response ── */
    sent: {
      ACCEPT: 'accepted',
      DECLINE: 'declined',
      EXPIRE: 'expired',
      WITHDRAW: 'withdrawn',
    },

    /* ── Seller accepted the request ── */
    accepted: {
      SCHEDULE: 'meeting_scheduled',
      CANCEL: 'cancelled',
    },

    /* ── Seller declined ── */
    declined: {
      RETRY: 'idle',
    },

    /* ── Campus meeting arranged ── */
    meeting_scheduled: {
      CONFIRM: 'completed',
      CANCEL: 'cancelled',
    },

    /* ── Exchange confirmed by both parties ── */
    completed: {
      DISPUTE: 'disputed',
    },

    /* ── No response within time limit ── */
    expired: {
      RETRY: 'idle',
    },

    /* ── Either party cancelled ── */
    cancelled: {
      RETRY: 'idle',
    },

    /* ── Buyer took back the request before response ── */
    withdrawn: {
      RETRY: 'idle',
    },

    /* ── Post-completion dispute raised ── */
    disputed: {
      RESOLVE: 'resolved',
    },

    /* ── Dispute settled — fully terminal ── */
    resolved: {
      // No outbound transitions.
    },
  },
} as const;

/* ── Factory ───────────────────────────────────────────────── */

export type RequestMachine = MachineInstance<RequestState, RequestEvent>;

/**
 * Create a new request machine starting in `idle`.
 *
 * ```ts
 * const req = createRequestMachine();
 * const sent = req.send('SEND');           // → sent
 * const accepted = sent.send('ACCEPT');    // → accepted
 * const meeting = accepted.send('SCHEDULE'); // → meeting_scheduled
 * const done = meeting.send('CONFIRM');    // → completed
 * ```
 */
export function createRequestMachine(
  snapshot?: { state: RequestState; history: ReadonlyArray<readonly [RequestEvent, RequestState, RequestState]> },
): RequestMachine {
  return createMachine(RequestDefinition, snapshot);
}

/* ── Helpers ───────────────────────────────────────────────── */

/** All states reachable from a given state via one event. */
export function requestNextStates(state: RequestState): RequestState[] {
  const row = RequestDefinition.transitions[state];
  if (!row) return [];
  return [...new Set(Object.values(row))] as RequestState[];
}

/** Whether a request is in a terminal state (no further transitions). */
export function isRequestTerminal(state: RequestState): boolean {
  return requestNextStates(state).length === 0;
}

/** Whether the request is actively in progress (not yet resolved). */
export function isRequestActive(state: RequestState): boolean {
  return (
    state === 'sent' ||
    state === 'accepted' ||
    state === 'meeting_scheduled'
  );
}

/** Whether the request ended unsuccessfully. */
export function isRequestFailed(state: RequestState): boolean {
  return (
    state === 'declined' ||
    state === 'expired' ||
    state === 'cancelled' ||
    state === 'withdrawn'
  );
}

/** Whether the buyer can retry the request. */
export function canRetryRequest(state: RequestState): boolean {
  return (
    state === 'declined' ||
    state === 'expired' ||
    state === 'cancelled' ||
    state === 'withdrawn'
  );
}
