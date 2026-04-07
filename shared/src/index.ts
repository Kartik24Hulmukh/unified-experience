/**
 * BErozgar — Shared Validation Schemas
 *
 * Zod schemas used BOTH by client forms AND server-side (mock API) validation.
 * Single source of truth. When a real backend arrives, export these schemas
 * and use them server-side as well.
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

const validModules = ['resale', 'accommodation', 'academics', 'mess', 'hospital'] as const;

export const createListingSchema = z.object({
  title: safeString(200),
  price: z.string().max(20).optional().default('0'),
  category: safeString(100),
  module: z.enum(validModules, { errorMap: () => ({ message: 'Invalid module' }) }),
  description: z.string().max(2000).optional(),
});

export const updateListingStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'pending_review'], {
    errorMap: () => ({ message: 'Invalid status. Must be approved, rejected, or pending_review' }),
  }),
});

/* ═══════════════════════════════════════════════════
   Dispute Schemas
   ═══════════════════════════════════════════════════ */

const disputeTypes = ['SCAM', 'MISREPRESENTATION', 'NO_SHOW', 'HARASSMENT'] as const;
const disputeStatuses = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'ESCALATED'] as const;

export const createDisputeSchema = z.object({
  type: z.enum(disputeTypes, {
    errorMap: () => ({ message: 'Invalid dispute type' }),
  }),
  against: safeString(100),
  listingId: z.string().max(100).optional(),
  description: safeString(2000),
});

export const updateDisputeStatusSchema = z.object({
  status: z.enum(disputeStatuses, {
    errorMap: () => ({ message: 'Invalid dispute status' }),
  }),
});

/* ═══════════════════════════════════════════════════
   Request / Exchange Schemas
   ═══════════════════════════════════════════════════ */

/** Buyer sends interest on a listing */
export const createRequestSchema = z.object({
  listingId: safeString(100),
  message: z.string().max(500).optional(),
});

/** Request lifecycle transition events (mapped to RequestMachine events) */
const requestEvents = [
  'ACCEPT', 'DECLINE', 'SCHEDULE', 'CONFIRM', 'CANCEL', 'WITHDRAW',
] as const;

export const updateRequestEventSchema = z.object({
  event: z.enum(requestEvents, {
    errorMap: () => ({ message: 'Invalid request event. Must be: ACCEPT, DECLINE, SCHEDULE, CONFIRM, CANCEL, or WITHDRAW' }),
  }),
  /** Optional idempotency key to prevent double transitions */
  idempotencyKey: z.string().max(100).optional(),
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
