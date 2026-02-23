/**
 * BErozgar — Restriction Engine
 *
 * Computes whether a student is restricted from performing actions.
 * Pure TypeScript. No React, no UI, no styling, no external dependencies.
 *
 * Restriction is enforcement, not punishment.
 * Computed dynamically — never permanently mutates user state.
 */

import type { TrustStatus } from '@/domain/trustEngine';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

/** Actions that can be blocked by restriction */
export type RestrictableAction =
  | 'CREATE_LISTING'
  | 'REQUEST_EXCHANGE'
  | 'REQUEST_CONTACT';

export interface RestrictionInput {
  trustStatus: TrustStatus;
  activeDisputes: number;
  adminOverride: boolean;
}

export interface RestrictionResult {
  isRestricted: boolean;
  blockedActions: RestrictableAction[];
  reasons: string[];
}

/* ═══════════════════════════════════════════════════
   Thresholds
   ═══════════════════════════════════════════════════ */

const THRESHOLDS = {
  /** Active disputes at or above this count → restriction */
  disputeLimit: 3,
} as const;

/** Exposed for test assertions */
export { THRESHOLDS as RESTRICTION_THRESHOLDS };

/* ═══════════════════════════════════════════════════
   All actions blocked when restricted
   ═══════════════════════════════════════════════════ */

const ALL_BLOCKED_ACTIONS: RestrictableAction[] = [
  'CREATE_LISTING',
  'REQUEST_EXCHANGE',
  'REQUEST_CONTACT',
];

/* ═══════════════════════════════════════════════════
   Input Guard
   ═══════════════════════════════════════════════════ */

function sanitizeCount(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

/* ═══════════════════════════════════════════════════
   Computation
   ═══════════════════════════════════════════════════ */

/**
 * Compute restriction status.
 *
 * Evaluation order (highest severity first):
 *   1. Admin override → always restricted
 *   2. Trust status RESTRICTED → restricted
 *   3. Active disputes >= threshold → restricted
 *   4. Otherwise → not restricted
 *
 * Deterministic: same input always yields same output.
 */
export function computeRestriction(rawInput: RestrictionInput): RestrictionResult {
  const input: RestrictionInput = {
    trustStatus: rawInput.trustStatus,
    activeDisputes: sanitizeCount(rawInput.activeDisputes),
    adminOverride: Boolean(rawInput.adminOverride),
  };
  const reasons: string[] = [];

  // ── 1. Admin override is absolute ────────────────
  if (input.adminOverride) {
    reasons.push('Administrative override in effect.');
    return { isRestricted: true, blockedActions: ALL_BLOCKED_ACTIONS, reasons };
  }

  // ── 2. Trust status already RESTRICTED ───────────
  if (input.trustStatus === 'RESTRICTED') {
    reasons.push('Account trust status is RESTRICTED.');
    return { isRestricted: true, blockedActions: ALL_BLOCKED_ACTIONS, reasons };
  }

  // ── 3. Active dispute threshold ──────────────────
  if (input.activeDisputes >= THRESHOLDS.disputeLimit) {
    reasons.push(
      `Active disputes (${input.activeDisputes}) meet or exceed threshold (${THRESHOLDS.disputeLimit}).`,
    );
    return { isRestricted: true, blockedActions: ALL_BLOCKED_ACTIONS, reasons };
  }

  // ── 4. Not restricted ────────────────────────────
  return { isRestricted: false, blockedActions: [], reasons: [] };
}

/* ═══════════════════════════════════════════════════
   Convenience Checks
   ═══════════════════════════════════════════════════ */

/** Check if a specific action is blocked */
export function isActionBlocked(
  result: RestrictionResult,
  action: RestrictableAction,
): boolean {
  return result.blockedActions.includes(action);
}
