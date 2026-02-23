/**
 * BErozgar — Audit Service
 *
 * Records admin actions for accountability via POST /api/admin/audit.
 * Fire-and-forget — failures are swallowed to avoid
 * disrupting the admin workflow.
 */

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

export type AuditAction =
  | 'VIEW_PROFILE'
  | 'FRAUD_FLAG_RAISED'
  | 'FRAUD_REVIEW_PENDING'
  | 'LISTING_APPROVED'
  | 'LISTING_REJECTED'
  | 'LISTING_RESUBMITTED'
  | 'DISPUTE_RESOLVED'
  | 'DISPUTE_REJECTED'
  | 'DISPUTE_ESCALATED'
  | 'USER_RESTRICTED'
  | 'TRUST_OVERRIDE'
  | 'REQUEST_CREATED'
  | 'EXCHANGE_COMPLETED';

import api from '@/lib/api-client';
import logger from '@/lib/logger';

/* ═══════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════ */

/**
 * Log an admin action. Fails silently — never throws.
 * Posts to POST /api/admin/audit which persists to the database.
 */
export async function logAdminAction(
  adminId: string,
  targetUserId: string,
  action: AuditAction,
): Promise<void> {
  try {
    await api.post('/admin/audit', {
      action,
      targetUserId,
      entityType: 'USER',
      metadata: { adminId },
    });

    logger.info(
      'Audit',
      `${action} | admin=${adminId} → target=${targetUserId}`,
    );
  } catch {
    // Fail silently — audit must never break the workflow
    logger.warn('Audit', 'Failed to record audit entry.');
  }
}
