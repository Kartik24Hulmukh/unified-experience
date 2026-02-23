/**
 * BErozgar — Google OAuth (Server-Side Verification)
 *
 * Verifies Google ID tokens server-side using google-auth-library.
 * Never trust client-sent profile data — always verify the JWT.
 */

import { OAuth2Client } from 'google-auth-library';
import { env } from '@/config/env';
import { UnauthorizedError } from '@/errors/index';

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export interface GoogleProfile {
  sub: string;          // Google's unique user ID
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
}

/**
 * Verify a Google ID token and extract the profile.
 * Throws UnauthorizedError if the token is invalid.
 */
export async function verifyGoogleToken(idToken: string): Promise<GoogleProfile> {
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new UnauthorizedError('Invalid Google token: missing email');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email.split('@')[0],
      picture: payload.picture,
      emailVerified: payload.email_verified ?? false,
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Google token verification failed');
  }
}
