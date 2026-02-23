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
    draft: {
      SUBMIT: 'pending_review',
    },
    pending_review: {
      APPROVE: 'approved',
      REJECT: 'rejected',
    },
    approved: {
      RECEIVE_INTEREST: 'interest_received',
      EXPIRE: 'expired',
      FLAG: 'flagged',
      REMOVE: 'removed',
    },
    rejected: {
      RESUBMIT: 'pending_review',
    },
    interest_received: {
      ACCEPT_REQUEST: 'in_transaction',
      DECLINE_REQUEST: 'approved',
      EXPIRE: 'expired',
      FLAG: 'flagged',
    },
    in_transaction: {
      CONFIRM_EXCHANGE: 'completed',
      CANCEL_TRANSACTION: 'approved',
      FLAG: 'flagged',
    },
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
    archived: {},
  },
} as const;

/* ── Factory ───────────────────────────────────────────────── */

export type ListingMachine = MachineInstance<ListingState, ListingEvent>;

export function createListingMachine(
  snapshot?: { state: ListingState; history: ReadonlyArray<readonly [ListingEvent, ListingState, ListingState]> },
): ListingMachine {
  return createMachine(ListingDefinition, snapshot);
}

/* ── Helpers ───────────────────────────────────────────────── */

export function listingNextStates(state: ListingState): ListingState[] {
  const row = ListingDefinition.transitions[state];
  if (!row) return [];
  return [...new Set(Object.values(row))] as ListingState[];
}

export function isListingTerminal(state: ListingState): boolean {
  return listingNextStates(state).length === 0;
}

export function isListingVisible(state: ListingState): boolean {
  return state === 'approved' || state === 'interest_received';
}

export function isListingAwaitingAdmin(state: ListingState): boolean {
  return state === 'pending_review' || state === 'flagged';
}
