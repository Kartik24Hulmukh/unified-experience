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

/** Trimmed non-empty string, max 500 chars by default */
export const safeString = (max = 500) =>
  z.string().trim().min(1, 'Required').max(max, `Max ${max} characters`);

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
  fullName: safeString(100).regex(
    /^[\p{L}\p{M}\s'.,-]+$/u,
    'Name contains invalid characters',
  ),
  email: emailSchema,
  password: passwordSchema,
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
  description: z.string().trim().max(2000, 'Max 2000 characters').optional(),
  category: z.string().trim().max(100, 'Max 100 characters').optional(),
  module: z.string().trim().max(100, 'Max 100 characters').optional(),
  price: z.number({ coerce: true }).nonnegative('Price must be non-negative').default(0),
});

export const updateListingStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'pending_review'], {
    errorMap: () => ({ message: 'Invalid status. Must be approved, rejected, or pending_review' }),
  }),
});

/* ═══════════════════════════════════════════════════
   Dispute Schemas
   ═══════════════════════════════════════════════════ */

const disputeStatuses = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'ESCALATED'] as const;
const disputeTypes = ['FRAUD', 'ITEM_NOT_AS_DESCRIBED', 'NO_SHOW', 'OTHER'] as const;

export const createDisputeSchema = z.object({
  requestId: safeString(100).optional(),
  listingId: safeString(100).optional(),
  againstId: safeString(100),
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
  listingId: safeString(100),
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

export const createAuditLogSchema = z.object({
  action: safeString(100),
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
