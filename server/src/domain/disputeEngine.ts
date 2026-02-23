/**
 * BErozgar — Dispute Lifecycle Engine
 *
 * Finite state machine for dispute resolution.
 * Built on the existing FSM infrastructure.
 *
 * Pure TypeScript. No React, no UI, no styling.
 *
 * States:
 *   OPEN          — student has filed a dispute
 *   UNDER_REVIEW  — admin is investigating
 *   RESOLVED      — admin concluded, dispute closed
 *   REJECTED      — admin determined dispute is invalid
 *   ESCALATED     — admin escalated for higher authority (rare)
 *
 * All transitions are admin-only. Students cannot modify dispute
 * state after filing. No circular transitions.
 */

import {
  type MachineDefinition,
  type MachineInstance,
  createMachine,
} from '@/domain/fsm/types';

/* ═══════════════════════════════════════════════════
   States & Events
   ═══════════════════════════════════════════════════ */

export type DisputeState =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'RESOLVED'
  | 'REJECTED'
  | 'ESCALATED';

export type DisputeEvent =
  | 'BEGIN_REVIEW'
  | 'RESOLVE'
  | 'REJECT'
  | 'ESCALATE';

export type DisputeMachine = MachineInstance<DisputeState, DisputeEvent>;

/* ═══════════════════════════════════════════════════
   Transition Table (no cycles)
   ═══════════════════════════════════════════════════

   OPEN          → BEGIN_REVIEW  → UNDER_REVIEW
   UNDER_REVIEW  → RESOLVE       → RESOLVED
   UNDER_REVIEW  → REJECT        → REJECTED
   UNDER_REVIEW  → ESCALATE      → ESCALATED

   RESOLVED, REJECTED, ESCALATED are terminal.
   ═══════════════════════════════════════════════════ */

export const DisputeDefinition: MachineDefinition<DisputeState, DisputeEvent> = {
  id: 'Dispute',
  initial: 'OPEN',
  transitions: {
    OPEN: {
      BEGIN_REVIEW: 'UNDER_REVIEW',
    },
    UNDER_REVIEW: {
      RESOLVE:  'RESOLVED',
      REJECT:   'REJECTED',
      ESCALATE: 'ESCALATED',
    },
    // RESOLVED, REJECTED, ESCALATED — no outgoing transitions (terminal)
  },
};

/* ═══════════════════════════════════════════════════
   Data Model
   ═══════════════════════════════════════════════════ */

export interface DisputeTimestamps {
  filedAt: string;           // ISO-8601
  reviewStartedAt?: string;
  resolvedAt?: string;
  rejectedAt?: string;
  escalatedAt?: string;
}

export interface Dispute {
  id: string;
  listingId: string;
  initiatorId: string;       // student who filed
  targetId: string;          // student being disputed
  reason: string;
  evidenceLinks: string[];
  state: DisputeState;
  resolutionNote: string | null;
  timestamps: DisputeTimestamps;
}

/* ═══════════════════════════════════════════════════
   Factory
   ═══════════════════════════════════════════════════ */

/**
 * Create a new dispute machine instance.
 * Optionally resume from a persisted state.
 */
export function createDisputeMachine(
  snapshot?: { state: DisputeState; history?: ReadonlyArray<readonly [DisputeEvent, DisputeState, DisputeState]> },
): DisputeMachine {
  return createMachine(DisputeDefinition, snapshot ? {
    state: snapshot.state,
    history: snapshot.history ?? [],
  } : undefined);
}

/* ═══════════════════════════════════════════════════
   Convenience Helpers
   ═══════════════════════════════════════════════════ */

/** Terminal states — dispute cannot transition further */
const TERMINAL_STATES: ReadonlySet<DisputeState> = new Set([
  'RESOLVED',
  'REJECTED',
  'ESCALATED',
]);

export function isDisputeTerminal(state: DisputeState): boolean {
  return TERMINAL_STATES.has(state);
}

/** Whether the dispute has been resolved (counts toward trust) */
export function isDisputeResolved(state: DisputeState): boolean {
  return state === 'RESOLVED';
}

/** Whether the dispute is still active (OPEN or UNDER_REVIEW) */
export function isDisputeActive(state: DisputeState): boolean {
  return state === 'OPEN' || state === 'UNDER_REVIEW';
}

/**
 * Create a new Dispute data object.
 * Returns the dispute in OPEN state with initial timestamps.
 */
export function fileDispute(params: {
  id: string;
  listingId: string;
  initiatorId: string;
  targetId: string;
  reason: string;
  evidenceLinks?: string[];
}): Dispute {
  return {
    id: params.id,
    listingId: params.listingId,
    initiatorId: params.initiatorId,
    targetId: params.targetId,
    reason: params.reason,
    evidenceLinks: params.evidenceLinks ?? [],
    state: 'OPEN',
    resolutionNote: null,
    timestamps: {
      filedAt: new Date().toISOString(),
    },
  };
}
