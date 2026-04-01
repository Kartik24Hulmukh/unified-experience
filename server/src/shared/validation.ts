/**
 * BErozgar — Shared Validation Schemas
 *
 * Zod schemas used BOTH by client forms AND server-side validation.
 * Single source of truth. Copied verbatim from client.
 *
 * SECURITY: Always validate on the server. Client validation is UX only.
 */

import { z } from 'zod';

/* ═══════════════════════════════════════════════════
   Primitives (reusable building blocks)
   ═══════════════════════════════════════════════════ */

/** Trimmed non-empty string, max 500 chars by default, disallows HTML tags */
export const safeString = (max = 500) =>
  z.string()
    .trim()
    .min(1, 'Required')
    .max(max, `Max ${max} characters`)
    // Refinement to disallow HTML tags
    .refine((val) => !/<[^>]*>?/g.test(val), {
      message: 'HTML tags are not allowed',
    });

/** Email — trimmed, lowercased, validated format */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address')
  .max(254, 'Email too long');

/** Password — min 8 chars (matches client) */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long');

/** OTP — exactly 6 digits */
export const otpSchema = z
  .string()
  .regex(/^\d{6}$/, 'OTP must be exactly 6 digits');

/* ═══════════════════════════════════════════════════
   Auth Schemas
   ═══════════════════════════════════════════════════ */

export const signupSchema = z.object({
  fullName: safeString(100),
  email: emailSchema,
  password: passwordSchema,
});

export const resendOtpSchema = z.object({
  email: emailSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  fullName: safeString(100),
  password: passwordSchema,
  otp: otpSchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token required'),
});

/** Google Sign-In — token from Google OAuth */
export const googleSignInSchema = z.object({
  credential: z.string().min(1, 'Google credential required'),
});

/* ═══════════════════════════════════════════════════
   Listing Schemas
   ═══════════════════════════════════════════════════ */

export const createListingSchema = z.object({
  title: safeString(200),
  description: safeString(2000).optional(),
  category: safeString(100).optional(),
  module: safeString(100).optional(),
  price: z.number({ coerce: true }).nonnegative('Price must be non-negative').default(0),
});

export const updateListingStatusSchema = z.object({
  // GAP-03: extended to include admin-only transitions (service enforces RBAC on these)
  status: z.enum(
    ['approved', 'rejected', 'pending_review', 'flagged', 'removed', 'archived', 'expired'],
    {
      errorMap: () => ({
        message:
          'Invalid status. Must be: approved, rejected, pending_review, flagged, removed, archived, or expired',
      }),
    },
  ),
  reason: z.string().trim().max(500).optional(),
});

/* ═══════════════════════════════════════════════════
   Dispute Schemas
   ═══════════════════════════════════════════════════ */

const disputeStatuses = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'ESCALATED'] as const;
const disputeTypes = ['FRAUD', 'ITEM_NOT_AS_DESCRIBED', 'NO_SHOW', 'OTHER'] as const;

export const createDisputeSchema = z.object({
  // GAP-06: UUID validation for entity IDs — prevents non-UUID strings reaching Prisma
  requestId: z.string().uuid('requestId must be a valid UUID').optional(),
  listingId: z.string().uuid('listingId must be a valid UUID').optional(),
  againstId: z.string().uuid('againstId must be a valid UUID'),
  type: z.enum(disputeTypes, {
    errorMap: () => ({ message: 'Invalid dispute type. Must be: FRAUD, ITEM_NOT_AS_DESCRIBED, NO_SHOW, or OTHER' }),
  }),
  description: safeString(2000),
}).refine(
  (data) => data.requestId || data.listingId,
  { message: 'Either requestId or listingId must be provided' },
);

export const updateDisputeStatusSchema = z.object({
  status: z.enum(disputeStatuses, {
    errorMap: () => ({ message: 'Invalid dispute status' }),
  }),
});

/* ═══════════════════════════════════════════════════
   Request / Exchange Schemas
   ═══════════════════════════════════════════════════ */

export const createRequestSchema = z.object({
  // GAP-06: UUID validation — clean 400 instead of Prisma P2023
  listingId: z.string().uuid('listingId must be a valid UUID'),
});

const requestEvents = [
  'ACCEPT', 'DECLINE', 'SCHEDULE', 'CONFIRM', 'CANCEL', 'WITHDRAW', 'DISPUTE', 'RESOLVE', 'EXPIRE',
] as const;

export const updateRequestEventSchema = z.object({
  event: z.enum(requestEvents, {
    errorMap: () => ({ message: 'Invalid request event. Must be: ACCEPT, DECLINE, SCHEDULE, CONFIRM, CANCEL, WITHDRAW, DISPUTE, RESOLVE, or EXPIRE' }),
  }),
  version: z.number({ coerce: true }).int().nonnegative().optional(),
  idempotencyKey: z.string().max(100).optional(),
});

/* ═══════════════════════════════════════════════════
   Admin Schemas
   ═══════════════════════════════════════════════════ */

// MED-E FIX: allowlist all valid audit-log action strings.
// Accepting a free-form z.string() allowed arbitrary values to be injected
// into the AuditLog table via POST /admin/audit, making the audit trail
// unreliable as an integrity record. Any new event type must be added here.
export const AUDIT_ACTIONS = [
  'AUTH_SIGNUP_REQUEST',
  'AUTH_VERIFY_OTP',
  'AUTH_LOGIN',
  'AUTH_GOOGLE_LOGIN',
  'AUTH_LOGOUT',
  'LISTING_STATUS_UPDATE',
  'REQUESTS_FORCE_CANCELLED',
  'REQUEST_CREATE',
  'REQUEST_EVENT',
  'DISPUTE_CREATE',
  'DISPUTE_ESCALATED',
  'DISPUTE_STATUS_UPDATE',
  'SYSTEM_STARTUP',
  'SYSTEM_RECOVERY',
  'ADMIN_FLAG_USER',
  'ADMIN_RESTRICT_USER',
  'ADMIN_APPROVE_LISTING',
  'ADMIN_REJECT_LISTING',
  'ADMIN_VIEW_STUDENT',
] as const;

export type AuditAction = typeof AUDIT_ACTIONS[number];

export const createAuditLogSchema = z.object({
  action: z.enum(AUDIT_ACTIONS),
  targetUserId: z.string().uuid().optional(),
  entityType: z.string().trim().max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const flagUserSchema = z.object({
  reason: safeString(500),
});

/* ═══════════════════════════════════════════════════
   Type Exports (inferred from schemas)
   ═══════════════════════════════════════════════════ */

export type SignupInput = z.infer<typeof signupSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;
export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingStatusInput = z.infer<typeof updateListingStatusSchema>;
export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;
export type UpdateDisputeStatusInput = z.infer<typeof updateDisputeStatusSchema>;
export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestEventInput = z.infer<typeof updateRequestEventSchema>;
export type CreateAuditLogInput = z.infer<typeof createAuditLogSchema>;
export type FlagUserInput = z.infer<typeof flagUserSchema>;
