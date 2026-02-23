/**
 * BErozgar — Fraud Heuristics (Lightweight)
 *
 * Behavioral pattern detection. NOT machine learning.
 * Pure TypeScript. No React. No UI. Deterministic rules only.
 *
 * Purpose:
 *   Detect suspicious behavior patterns early.
 *   Output flags, NOT verdicts. Flag ≠ restrict.
 *   Flag → admin review.
 *
 * Principles:
 *   1. Deterministic: same input → same output
 *   2. No auto-bans, no auto-restrictions
 *   3. Conservative: flag only clear patterns
 *   4. Academic-safe: simple, explainable rules
 */

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface FraudHeuristicInput {
  /** Listings created in the last 24 hours */
  recentListings: number;
  /** Cancelled requests in the last 7 days */
  recentCancellations: number;
  /** Disputes filed against (as target) in the last 30 days */
  recentDisputes: number;
  /** Account age in days */
  accountAgeDays: number;
}

export interface FraudHeuristicResult {
  riskLevel: RiskLevel;
  flags: string[];
}

/* ═══════════════════════════════════════════════════
   Thresholds (tunable, centralised)
   ═══════════════════════════════════════════════════ */

const THRESHOLDS = {
  /** Listings in 24h above this → flag */
  listingSpike: 5,
  /** Cancellations in 7 days above this → flag */
  cancellationSpike: 4,
  /** Disputes in 30 days above this → flag */
  disputeSpike: 2,
  /** New account sensitivity window (days) */
  newAccountDays: 14,
  /** New account listing threshold (lower bar) */
  newAccountListingLimit: 3,
} as const;

/** Exposed for test assertions */
export { THRESHOLDS as FRAUD_THRESHOLDS };

/* ═══════════════════════════════════════════════════
   Input Guard
   ═══════════════════════════════════════════════════ */

function sanitizeCount(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function validateFraudInput(raw: FraudHeuristicInput): FraudHeuristicInput {
  return {
    recentListings: sanitizeCount(raw.recentListings),
    recentCancellations: sanitizeCount(raw.recentCancellations),
    recentDisputes: sanitizeCount(raw.recentDisputes),
    accountAgeDays: sanitizeCount(raw.accountAgeDays),
  };
}

/* ═══════════════════════════════════════════════════
   Computation
   ═══════════════════════════════════════════════════ */

/**
 * Evaluate fraud heuristics against a user's recent behavior.
 *
 * Each rule appends a human-readable flag.
 * Risk level derived from flag count:
 *   0 flags → LOW
 *   1 flag  → MEDIUM
 *   2+ flags → HIGH
 *
 * Deterministic: same input always yields same result.
 * Does NOT auto-restrict. Flags are for admin review only.
 */
export function evaluateFraudHeuristics(
  rawInput: FraudHeuristicInput,
): FraudHeuristicResult {
  const input = validateFraudInput(rawInput);
  const flags: string[] = [];

  // ── Rule 1: Listing spike ───────────────────────
  if (input.recentListings > THRESHOLDS.listingSpike) {
    flags.push(
      `High listing volume: ${input.recentListings} listings in last 24h (threshold: ${THRESHOLDS.listingSpike}).`,
    );
  }

  // ── Rule 2: Cancellation spike ──────────────────
  if (input.recentCancellations > THRESHOLDS.cancellationSpike) {
    flags.push(
      `Elevated cancellations: ${input.recentCancellations} in last 7 days (threshold: ${THRESHOLDS.cancellationSpike}).`,
    );
  }

  // ── Rule 3: Dispute frequency ───────────────────
  if (input.recentDisputes > THRESHOLDS.disputeSpike) {
    flags.push(
      `Repeated disputes: ${input.recentDisputes} in last 30 days (threshold: ${THRESHOLDS.disputeSpike}).`,
    );
  }

  // ── Rule 4: New account sensitivity ─────────────
  // New accounts get a lower listing threshold
  if (
    input.accountAgeDays < THRESHOLDS.newAccountDays &&
    input.recentListings > THRESHOLDS.newAccountListingLimit
  ) {
    flags.push(
      `New account (${input.accountAgeDays} days) with ${input.recentListings} listings (new account threshold: ${THRESHOLDS.newAccountListingLimit}).`,
    );
  }

  // ── Derive risk level from flag count ───────────
  let riskLevel: RiskLevel;

  if (flags.length === 0) {
    riskLevel = 'LOW';
  } else if (flags.length === 1) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'HIGH';
  }

  return { riskLevel, flags };
}

/* ═══════════════════════════════════════════════════
   Convenience
   ═══════════════════════════════════════════════════ */

/** Check if fraud review is required (HIGH risk only) */
export function isFraudReviewRequired(result: FraudHeuristicResult): boolean {
  return result.riskLevel === 'HIGH';
}
