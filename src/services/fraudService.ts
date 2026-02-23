/**
 * BErozgar — Fraud Service
 *
 * Client-side fraud heuristic evaluation.
 * Bridges the domain heuristic engine to the audit system.
 *
 * When riskLevel = HIGH:
 *   - Logs event via auditService (real API call)
 *   - Does NOT modify UI. Does NOT auto-ban.
 *
 * Flag storage and admin query operations are handled server-side
 * via GET /api/admin/fraud.
 */

import {
  evaluateFraudHeuristics,
  isFraudReviewRequired,
  type FraudHeuristicInput,
  type FraudHeuristicResult,
} from '@/domain/fraudHeuristics';
import { logAdminAction } from '@/services/auditService';
import logger from '@/lib/logger';

/* ═══════════════════════════════════════════════════
   Evaluation + Logging
   ═══════════════════════════════════════════════════ */

/**
 * Evaluate fraud heuristics for a user action.
 * If HIGH risk → logs audit event via POST /api/admin/audit.
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

  // HIGH risk → log event for admin queue
  if (isFraudReviewRequired(result)) {
    logger.info(
      'Fraud',
      `HIGH risk detected for user="${userId}" trigger="${trigger}". Flags: ${result.flags.join(' | ')}`,
    );

    // Fire-and-forget audit log — system as admin actor
    logAdminAction('SYSTEM', userId, 'FRAUD_FLAG_RAISED');
  }

  return result;
}
