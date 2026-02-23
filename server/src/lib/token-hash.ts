/**
 * BErozgar — Refresh Token Hashing
 *
 * Refresh tokens are stored as SHA-256 hashes in the database.
 * The raw token is only ever held in an httpOnly cookie —
 * never in JS-accessible storage, never in a response body.
 *
 * SHA-256 is appropriate here (vs Argon2) because refresh tokens
 * are high-entropy random values, not user-chosen passwords.
 */

import { createHash } from 'node:crypto';

/**
 * Hash a refresh token using SHA-256 (hex-encoded).
 * Deterministic — same input always produces same output.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
