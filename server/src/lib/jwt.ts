/**
 * BErozgar — JWT Utility
 *
 * Sign and verify access tokens (short-lived, stateless).
 * Refresh tokens are stored server-side (database) — see auth service.
 */

import jwt from 'jsonwebtoken';
import { env } from '@/config/env';

export interface AccessTokenPayload {
  sub: string;       // user id
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Sign an access token.
 * Default expiry: 15 minutes (configurable via JWT_ACCESS_EXPIRES_IN).
 */
export function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as string & jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

/**
 * Verify and decode an access token.
 * Throws on expired, malformed, or tampered tokens.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
  }) as AccessTokenPayload;
}
