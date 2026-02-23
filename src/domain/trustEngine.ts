/**
 * BErozgar — Trust Level Computation Engine
 *
 * Pure TypeScript. No React, no UI, no styling, no external dependencies.
 *
 * Trust is a deterministic status derived from behavior — not a score.
 * It applies ONLY to students. Admin users are exempt.
 *
 * Allowed states:
 *   GOOD_STANDING    — default, no issues
 *   REVIEW_REQUIRED  — behavioral signals warrant review
 *   RESTRICTED       — admin has flagged the account
 */

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

export type TrustStatus = 'GOOD_STANDING' | 'REVIEW_REQUIRED' | 'RESTRICTED';

export interface TrustInput {
  completedExchanges: number;
  cancelledRequests: number;
  disputes: number;
  adminFlags: number;
  accountAgeDays: number;
}

export interface TrustResult {
  status: TrustStatus;
  reasons: string[];
}

/* ═══════════════════════════════════════════════════
   Thresholds (tunable, centralised)
   ═══════════════════════════════════════════════════ */

const THRESHOLDS = {
  /** Any admin flag → immediate restriction */
  adminFlagMinimum: 1,
  /** Disputes above this → REVIEW_REQUIRED */
  disputeLimit: 2,
  /** Cancelled requests above this → REVIEW_REQUIRED */
  cancelledLimit: 3,
  /** Account age (days) below which trust is less stabilised */
  newAccountDays: 30,
  /** Cancel-to-complete ratio above this → REVIEW_REQUIRED */
  cancelRatioLimit: 0.5,
} as const;

/** Exposed for test assertions */
export { THRESHOLDS as TRUST_THRESHOLDS };

/* ═══════════════════════════════════════════════════
   Input Guard
   ═══════════════════════════════════════════════════ */

function sanitizeCount(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function validateTrustInput(raw: TrustInput): TrustInput {
  return {
    completedExchanges: sanitizeCount(raw.completedExchanges),
    cancelledRequests: sanitizeCount(raw.cancelledRequests),
    disputes: sanitizeCount(raw.disputes),
    adminFlags: sanitizeCount(raw.adminFlags),
    accountAgeDays: sanitizeCount(raw.accountAgeDays),
  };
}

/* ═══════════════════════════════════════════════════
   Computation
   ═══════════════════════════════════════════════════ */

/**
 * Compute trust status for a student.
 *
 * Evaluation order (highest severity first):
 *   1. Admin flags → RESTRICTED (overrides everything)
 *   2. Dispute count → REVIEW_REQUIRED
 *   3. Cancellation count → REVIEW_REQUIRED
 *   4. Cancel/complete ratio for new accounts → REVIEW_REQUIRED
 *   5. Otherwise → GOOD_STANDING
 *
 * Deterministic: same input always yields same output.
 */
export function computeTrust(rawInput: TrustInput): TrustResult {
  const input = validateTrustInput(rawInput);
  const reasons: string[] = [];

  // ── 1. Admin flags override everything ───────────
  if (input.adminFlags >= THRESHOLDS.adminFlagMinimum) {
    reasons.push(
      `Account has ${input.adminFlags} admin flag(s). Automatically restricted.`,
    );
    return { status: 'RESTRICTED', reasons };
  }

  // ── 2. Dispute threshold ─────────────────────────
  if (input.disputes > THRESHOLDS.disputeLimit) {
    reasons.push(
      `Dispute count (${input.disputes}) exceeds threshold (${THRESHOLDS.disputeLimit}).`,
    );
  }

  // ── 3. Cancellation threshold ────────────────────
  if (input.cancelledRequests > THRESHOLDS.cancelledLimit) {
    reasons.push(
      `Cancelled requests (${input.cancelledRequests}) exceed threshold (${THRESHOLDS.cancelledLimit}).`,
    );
  }

  // ── 4. Cancel-to-complete ratio for newer accounts ─
  if (
    input.accountAgeDays < THRESHOLDS.newAccountDays &&
    input.completedExchanges > 0 &&
    input.cancelledRequests / input.completedExchanges > THRESHOLDS.cancelRatioLimit
  ) {
    reasons.push(
      `New account (${input.accountAgeDays} days) with high cancel/complete ratio.`,
    );
  }

  // ── 5. Derive final status ───────────────────────
  if (reasons.length > 0) {
    return { status: 'REVIEW_REQUIRED', reasons };
  }

  // ── Account age stabilisation note (informational, does not change status) ──
  if (input.accountAgeDays >= THRESHOLDS.newAccountDays) {
    reasons.push('Account age provides additional trust stability.');
  }

  return { status: 'GOOD_STANDING', reasons };
}
