/**
 * Listing FSM — lifecycle of a user-submitted listing.
 *
 * States derived from existing UI assumptions:
 *   ResalePage    "How Exchange Works" (5-step flow)
 *   AdminPage     pending / approve / reject actions
 *   Notifications "Listing Approved", "New Transaction Request"
 *   ResourceListingForm  "submitted for admin verification"
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
 * Every discrete state a listing can occupy.
 *
 * ```
 * draft ──SUBMIT──▸ pending_review ──APPROVE──▸ approved (live)
 *                                  ──REJECT───▸ rejected
 *
 * approved ──RECEIVE_INTEREST──▸ interest_received
 *         ──EXPIRE─────────────▸ expired
 *         ──FLAG───────────────▸ flagged
 *
 * interest_received ──ACCEPT_REQUEST──▸ in_transaction
 *                   ──DECLINE_REQUEST─▸ approved
 *                   ──EXPIRE──────────▸ expired
 *                   ──FLAG────────────▸ flagged
 *
 * in_transaction ──CONFIRM_EXCHANGE──▸ completed
 *                ──CANCEL_TRANSACTION▸ approved
 *                ──FLAG──────────────▸ flagged
 *
 * rejected ──RESUBMIT──▸ pending_review
 *
 * expired ──RELIST──▸ draft
 *         ──ARCHIVE─▸ archived
 *
 * flagged ──RESOLVE_FLAG──▸ approved
 *         ──REMOVE────────▸ removed
 *
 * completed ──ARCHIVE──▸ archived
 *
 * removed ──ARCHIVE──▸ archived
 * ```
 */
export type ListingState =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'interest_received'
  | 'in_transaction'
  | 'completed'
  | 'expired'
  | 'flagged'
  | 'archived'
  | 'removed';

/* ── Events ────────────────────────────────────────────────── */

export type ListingEvent =
  | 'SUBMIT'
  | 'APPROVE'
  | 'REJECT'
  | 'RESUBMIT'
  | 'RECEIVE_INTEREST'
  | 'ACCEPT_REQUEST'
  | 'DECLINE_REQUEST'
  | 'CONFIRM_EXCHANGE'
  | 'CANCEL_TRANSACTION'
  | 'EXPIRE'
  | 'FLAG'
  | 'RESOLVE_FLAG'
  | 'ARCHIVE'
  | 'REMOVE'
  | 'RELIST';

/* ── Definition ────────────────────────────────────────────── */

export const ListingDefinition: MachineDefinition<
  ListingState,
  ListingEvent
> = {
  id: 'Listing',
  initial: 'draft',
  transitions: {
    /* ── User creates listing ── */
    draft: {
      SUBMIT: 'pending_review',
    },

    /* ── Admin reviews ── */
    pending_review: {
      APPROVE: 'approved',
      REJECT: 'rejected',
    },

    /* ── Live on platform ── */
    approved: {
      RECEIVE_INTEREST: 'interest_received',
      EXPIRE: 'expired',
      FLAG: 'flagged',
      REMOVE: 'removed',
    },

    /* ── Admin rejected ── */
    rejected: {
      RESUBMIT: 'pending_review',
    },

    /* ── Buyer expressed interest ── */
    interest_received: {
      ACCEPT_REQUEST: 'in_transaction',
      DECLINE_REQUEST: 'approved',
      EXPIRE: 'expired',
      FLAG: 'flagged',
    },

    /* ── Active exchange in progress ── */
    in_transaction: {
      CONFIRM_EXCHANGE: 'completed',
      CANCEL_TRANSACTION: 'approved',
      FLAG: 'flagged',
    },

    /* ── Terminal-ish states ── */
    completed: {
      ARCHIVE: 'archived',
    },

    expired: {
      RELIST: 'draft',
      ARCHIVE: 'archived',
    },

    flagged: {
      RESOLVE_FLAG: 'approved',
      REMOVE: 'removed',
    },

    removed: {
      ARCHIVE: 'archived',
    },

    /* ── Final absorbing state ── */
    archived: {
      // No outbound transitions — fully terminal.
    },
  },
} as const;

/* ── Factory ───────────────────────────────────────────────── */

export type ListingMachine = MachineInstance<ListingState, ListingEvent>;

/**
 * Create a new listing machine starting in `draft`.
 *
 * ```ts
 * const listing = createListingMachine();
 * const submitted = listing.send('SUBMIT');   // → pending_review
 * const live = submitted.send('APPROVE');     // → approved
 * ```
 */
export function createListingMachine(
  snapshot?: { state: ListingState; history: ReadonlyArray<readonly [ListingEvent, ListingState, ListingState]> },
): ListingMachine {
  return createMachine(ListingDefinition, snapshot);
}

/* ── Helpers ───────────────────────────────────────────────── */

/** All states reachable from a given state via one event. */
export function listingNextStates(state: ListingState): ListingState[] {
  const row = ListingDefinition.transitions[state];
  if (!row) return [];
  return [...new Set(Object.values(row))] as ListingState[];
}

/** Whether a listing is in a terminal state (no further transitions). */
export function isListingTerminal(state: ListingState): boolean {
  return listingNextStates(state).length === 0;
}

/** Whether the listing is publicly visible to buyers. */
export function isListingVisible(state: ListingState): boolean {
  return state === 'approved' || state === 'interest_received';
}

/** Whether admin action is required. */
export function isListingAwaitingAdmin(state: ListingState): boolean {
  return state === 'pending_review' || state === 'flagged';
}
