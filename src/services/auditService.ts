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

// MED-3 FIX: AuditAction must mirror the backend's AUDIT_ACTIONS const (validation.ts).
// Previous values like VIEW_PROFILE, FRAUD_FLAG_RAISED, LISTING_APPROVED etc. were
// never in the allowlist → every logAdminAction() call returned 400 and was silently
// dropped, leaving the admin audit trail blind. Only use values accepted by the server.
export type AuditAction =
  | 'ADMIN_FLAG_USER'
  | 'ADMIN_RESTRICT_USER'
  | 'ADMIN_APPROVE_LISTING'
  | 'ADMIN_REJECT_LISTING'
  | 'ADMIN_VIEW_STUDENT'
  | 'LISTING_STATUS_UPDATE'
  | 'DISPUTE_STATUS_UPDATE'
  | 'DISPUTE_ESCALATED';

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
