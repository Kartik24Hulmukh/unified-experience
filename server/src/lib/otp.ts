/**
 * BErozgar — OTP Generation & Verification
 *
 * Generates cryptographically random 6-digit OTP codes.
 * Verification handled via database lookup (see auth service).
 */

import { randomInt } from 'node:crypto';
import { AUTH } from '@/config/constants';

/**
 * Generate a cryptographically random 6-digit OTP.
 * Range: 100000–999999 (always 6 digits, no leading zeros).
 */
export function generateOtp(): string {
  return randomInt(100_000, 1_000_000).toString();
}

/**
 * Get OTP expiry date from now.
 */
export function getOtpExpiry(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + AUTH.OTP_EXPIRES_MINUTES);
  return expiry;
}

/**
 * Check if an OTP has expired.
 */
export function isOtpExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}
