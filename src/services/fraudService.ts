/**
 * BErozgar — Fraud Service
 *
 * Client-side fraud heuristic evaluation (scoring only).
 * Risk scoring runs locally for immediate UI feedback.
 * All persistence (audit log, adminFlags increment) happens server-side
 * inside createListing / updateRequestEvent — never via a client API call
 * because POST /admin/audit requires ADMIN role and would always 403 for
 * student users.
 */

import {
  evaluateFraudHeuristics,
  isFraudReviewRequired,
  type FraudHeuristicInput,
  type FraudHeuristicResult,
} from '@/domain/fraudHeuristics';
import logger from '@/lib/logger';

/* ═══════════════════════════════════════════════════
   Evaluation (client-side scoring only)
   ═══════════════════════════════════════════════════ */

/**
 * Evaluate fraud heuristics for a user action.
 * Returns the score so the caller can decide how to surface it in the UI.
 * Persistence is handled server-side — do NOT call the audit API from here.
 *
 * Called from listing creation and request cancellation flows.
 * Does NOT auto-restrict. Flag → admin review (server-side).
 */
export function evaluateAndFlag(
  userId: string,
  input: FraudHeuristicInput,
  trigger: 'LISTING_CREATED' | 'REQUEST_CANCELLED',
): FraudHeuristicResult {
  const result = evaluateFraudHeuristics(input);

  // LOW risk → no action needed
  if (result.riskLevel === 'LOW') return result;

  // HIGH risk → emit local log for dev/monitoring; server handles persistence
  if (isFraudReviewRequired(result)) {
    logger.info(
      'Fraud',
      `HIGH risk detected for user="${userId}" trigger="${trigger}". Flags: ${result.flags.join(' | ')}`,
    );
  }

  return result;
}
