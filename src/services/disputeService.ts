/**
 * BErozgar — Dispute Service (TEST-ONLY)
 *
 * In-memory dispute store used exclusively by unit/integration tests.
 * Production code uses useDisputes/useCreateDispute hooks from useApi.ts
 * which call the real backend API.
 *
 * NOT imported by any production component or page.
 */

import {
  type Dispute,
  type DisputeState,
  type DisputeEvent,
  type DisputeMachine,
  createDisputeMachine,
  fileDispute,
  isDisputeActive,
  isDisputeTerminal,
} from '@/domain/disputeEngine';

/* ═══════════════════════════════════════════════════
   In-memory store (mock — replace with backend)
   ═══════════════════════════════════════════════════ */

const disputes: Map<string, Dispute> = new Map();
const machines: Map<string, DisputeMachine> = new Map();
let nextId = 1;

/**
 * Reset the in-memory dispute store.
 * ONLY for test isolation — never call in production code.
 */
export function resetDisputeStore(): void {
  disputes.clear();
  machines.clear();
  nextId = 1;
}

/* ═══════════════════════════════════════════════════
   Write operations (admin only at transition layer)
   ═══════════════════════════════════════════════════ */

/**
 * File a new dispute. Returns the created dispute record.
 * Caller must validate that the initiator is a student.
 */
export function createDispute(params: {
  listingId: string;
  initiatorId: string;
  targetId: string;
  reason: string;
  evidenceLinks?: string[];
}): Dispute {
  const id = `dispute-${nextId++}`;
  const dispute = fileDispute({ ...params, id });
  const machine = createDisputeMachine();

  disputes.set(id, dispute);
  machines.set(id, machine);

  return dispute;
}

/**
 * Advance a dispute through its FSM.
 * Only admin-level callers should invoke this.
 *
 * Returns the updated dispute with new state + timestamps,
 * or throws `InvalidTransitionError` if the event is illegal.
 */
export function transitionDispute(
  disputeId: string,
  event: DisputeEvent,
  resolutionNote?: string,
): Dispute {
  const dispute = disputes.get(disputeId);
  const machine = machines.get(disputeId);

  if (!dispute || !machine) {
    throw new Error(`Dispute "${disputeId}" not found.`);
  }

  if (isDisputeTerminal(dispute.state)) {
    throw new Error(`Dispute "${disputeId}" is already in terminal state "${dispute.state}".`);
  }

  // FSM transition (throws InvalidTransitionError on illegal event)
  const next = machine.send(event);
  machines.set(disputeId, next);

  // Derive timestamp key from the new state
  const updatedTimestamps = { ...dispute.timestamps };
  const now = new Date().toISOString();

  switch (next.state) {
    case 'UNDER_REVIEW':
      updatedTimestamps.reviewStartedAt = now;
      break;
    case 'RESOLVED':
      updatedTimestamps.resolvedAt = now;
      break;
    case 'REJECTED':
      updatedTimestamps.rejectedAt = now;
      break;
    case 'ESCALATED':
      updatedTimestamps.escalatedAt = now;
      break;
  }

  const updated: Dispute = {
    ...dispute,
    state: next.state,
    resolutionNote: resolutionNote ?? dispute.resolutionNote,
    timestamps: updatedTimestamps,
  };

  disputes.set(disputeId, updated);
  return updated;
}

/* ═══════════════════════════════════════════════════
   Read operations
   ═══════════════════════════════════════════════════ */

/** Get a single dispute by ID */
export function getDispute(disputeId: string): Dispute | undefined {
  return disputes.get(disputeId);
}

/** Get all disputes (admin observation) */
export function getAllDisputes(): Dispute[] {
  return Array.from(disputes.values());
}

/** Get disputes where the given user is the target */
export function getDisputesAgainstUser(userId: string): Dispute[] {
  return Array.from(disputes.values()).filter((d) => d.targetId === userId);
}

/** Get disputes filed by a user */
export function getDisputesFiledBy(userId: string): Dispute[] {
  return Array.from(disputes.values()).filter((d) => d.initiatorId === userId);
}

/**
 * Count active (non-terminal) disputes against a user.
 * Used by restriction engine to compute `activeDisputes`.
 */
export function countActiveDisputesAgainst(userId: string): number {
  return getDisputesAgainstUser(userId).filter((d) => isDisputeActive(d.state)).length;
}

/**
 * Count resolved disputes against a user.
 * Used by trust engine to compute `disputes` count.
 */
export function countResolvedDisputesAgainst(userId: string): number {
  return getDisputesAgainstUser(userId).filter((d) => d.state === 'RESOLVED').length;
}

/**
 * Get available FSM events for a dispute.
 * Useful for admin UI to know which actions are valid.
 */
export function getAvailableActions(disputeId: string): DisputeEvent[] {
  const machine = machines.get(disputeId);
  if (!machine) return [];
  return machine.availableEvents();
}

/**
 * Derive dispute counts for a user (used by trust + restriction).
 * Single function to avoid duplicate iterations.
 */
export function getDisputeCountsForUser(userId: string): {
  activeDisputes: number;
  resolvedDisputes: number;
  totalDisputes: number;
} {
  const against = getDisputesAgainstUser(userId);
  let active = 0;
  let resolved = 0;

  for (const d of against) {
    if (isDisputeActive(d.state)) active++;
    if (d.state === 'RESOLVED') resolved++;
  }

  return {
    activeDisputes: active,
    resolvedDisputes: resolved,
    totalDisputes: against.length,
  };
}
