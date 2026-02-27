/**
 * BErozgar — Auth Service
 *
 * All authentication business logic.
 * Routes call this service — services call Prisma.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { hashPassword, verifyPassword } from '@/lib/password';
import { hashToken } from '@/lib/token-hash';
import { verifyGoogleToken } from '@/lib/google-oauth';
import { generateOtp, getOtpExpiry, isOtpExpired } from '@/lib/otp';
import { sendOtpEmail } from '@/lib/email';
import { AUTH, ALLOWED_EMAIL_DOMAINS } from '@/config/constants';
import { env } from '@/config/env';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/errors/index';
import { computeTrust } from '@/domain/trustEngine';
import { computeRestriction } from '@/domain/restrictionEngine';
import type {
  SignupInput,
  LoginInput,
  VerifyOtpInput,
  GoogleSignInInput,
} from '@/shared/validation';

/* ═══════════════════════════════════════════════════
   Token Helpers
   ═══════════════════════════════════════════════════ */

function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

function getRefreshExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + env.JWT_REFRESH_EXPIRES_DAYS);
  return d;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

async function issueTokens(
  userId: string,
  email: string,
  role: string,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<AuthTokens> {
  const accessToken = signAccessToken({ sub: userId, email, role });
  const rawRefreshToken = generateRefreshToken();
  const hashedToken = hashToken(rawRefreshToken);

  // Atomic: store hashed token + revoke stale tokens
  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.create({
      data: {
        token: hashedToken,
        userId,
        expiresAt: getRefreshExpiry(),
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
      },
    });

    // Enforce max refresh tokens per user (revoke oldest)
    const tokens = await tx.refreshToken.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (tokens.length > AUTH.MAX_REFRESH_TOKENS_PER_USER) {
      const staleIds = tokens
        .slice(AUTH.MAX_REFRESH_TOKENS_PER_USER)
        .map((t) => t.id);
      await tx.refreshToken.updateMany({
        where: { id: { in: staleIds } },
        data: { revokedAt: new Date() },
      });
    }
  });

  // Return the RAW token — only ever sent in an httpOnly cookie
  return { accessToken, refreshToken: rawRefreshToken };
}

/* ═══════════════════════════════════════════════════
   Signup — Send OTP
   ═══════════════════════════════════════════════════ */

export async function signup(input: SignupInput): Promise<{ message: string }> {
  // Enforce allowed email domains
  const emailDomain = input.email.split('@')[1];
  if (ALLOWED_EMAIL_DOMAINS.length > 0 && !ALLOWED_EMAIL_DOMAINS.includes(emailDomain)) {
    throw new ValidationError('Only institutional email addresses are allowed', {
      email: [`Email domain '${emailDomain}' is not permitted. Allowed: ${ALLOWED_EMAIL_DOMAINS.join(', ')}`],
    });
  }

  // Check for existing verified user
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing?.verified) {
    // SEC-ENUM-01: Opaque response to prevent account enumeration. 
    // Return same message as success to keep attacker guessing.
    return { message: 'Verification code sent to your email' };
  }

  // Generate and store OTP
  const otp = generateOtp();
  await prisma.otp.create({
    data: {
      email: input.email,
      code: otp,
      expiresAt: getOtpExpiry(),
    },
  });

  // Provider-scaffolded delivery (log provider in dev; SMTP hookable via env)
  try {
    await sendOtpEmail({
      to: input.email,
      otp,
      expiresInMinutes: AUTH.OTP_EXPIRES_MINUTES,
    });
  } catch (err) {
    // Keep observable and fail explicitly so signup doesn't claim delivery success.
    const msg = err instanceof Error ? err.message : 'Unknown email delivery failure';
    throw new ValidationError(`Unable to send OTP email: ${msg}`);
  }

  // Audit: record signup attempt
  await prisma.auditLog.create({
    data: {
      actorId: '00000000-0000-0000-0000-000000000000', // Nil UUID for System
      action: 'AUTH_SIGNUP_REQUEST',
      entityType: 'User',
      metadata: { email: input.email },
    },
  });

  return { message: 'Verification code sent to your email' };
}

/* ═══════════════════════════════════════════════════
   Verify OTP & Create Account
   ═══════════════════════════════════════════════════ */

export async function verifyOtp(
  input: VerifyOtpInput,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<{ user: any; tokens: AuthTokens }> {
  // Find the most recent unused OTP for this email
  const otpRecord = await prisma.otp.findFirst({
    where: {
      email: input.email,
      usedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) {
    throw new ValidationError('No pending OTP found for this email');
  }

  if (isOtpExpired(otpRecord.expiresAt)) {
    throw new ValidationError('OTP has expired. Please request a new one.');
  }

  // PROD-10: use timing-safe comparison to prevent side-channel leakage.
  // Standard `!==` short-circuits on the first mismatched byte, letting an
  // attacker determine correct digits incrementally via response timing.
  const a = Buffer.from(otpRecord.code, 'utf8');
  const b = Buffer.from(input.otp, 'utf8');
  const isMatch = a.length === b.length && timingSafeEqual(a, b);

  if (!isMatch) {
    // PROD-10b: invalidate OTP after too many wrong guesses (defence-in-depth
    // on top of the rate-limit at PROD-07).
    const attempts = (otpRecord as any).attempts ?? 0;
    if (attempts >= 4) {
      // 5th wrong attempt — permanently burn this OTP
      await prisma.otp.update({
        where: { id: otpRecord.id },
        data: { usedAt: new Date() },
      });
      throw new ValidationError('OTP has been invalidated after too many attempts. Please request a new one.');
    }
    // Increment attempt counter (best-effort — field may not exist in older schemas)
    try {
      await prisma.otp.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } } as any,
      });
    } catch {
      // Schema doesn't have an attempts column yet — rate limit is still enforced
    }
    throw new ValidationError('Invalid OTP code');
  }

  // Atomic: mark OTP used + upsert user (prevents double-use race)
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    // Mark OTP as used
    await tx.otp.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });

    const createdUser = await tx.user.upsert({
      where: { email: input.email },
      create: {
        email: input.email,
        fullName: input.fullName,
        password: passwordHash,
        verified: true,
      },
      update: {
        fullName: input.fullName,
        password: passwordHash,
        verified: true,
      },
    });

    // Audit: account verified/created (FIXED: use createdUser.id)
    await tx.auditLog.create({
      data: {
        actorId: createdUser.id,
        action: 'AUTH_VERIFY_OTP',
        entityType: 'User',
        entityId: createdUser.id,
        metadata: { method: 'EMAIL' },
      },
    });

    return createdUser;
  });

  const tokens = await issueTokens(user.id, user.email, user.role, meta);

  return {
    user: sanitizeUser(user),
    tokens,
  };
}

/* ═══════════════════════════════════════════════════
   Login
   ═══════════════════════════════════════════════════ */

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function login(
  input: LoginInput,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<{ user: any; tokens: AuthTokens }> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user || !user.password) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.verified) {
    throw new UnauthorizedError('Account not verified. Please complete signup.');
  }

  // ── Lockout check ────────────────────────────────
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 60_000,
    );
    throw new UnauthorizedError(
      `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
    );
  }

  const valid = await verifyPassword(user.password, input.password);

  if (!valid) {
    // Increment failed attempts; lockout if threshold reached
    const attempts = user.failedLoginAttempts + 1;
    const lockData: Record<string, unknown> = {
      failedLoginAttempts: attempts,
    };
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      lockData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: lockData,
    });

    throw new UnauthorizedError('Invalid email or password');
  }

  // ── Reset lockout counters on successful login ──
  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  // Audit: Successful login
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'AUTH_LOGIN',
      entityType: 'User',
      entityId: user.id,
      metadata: { ip: meta?.ipAddress },
    },
  });

  const tokens = await issueTokens(user.id, user.email, user.role, meta);

  return {
    user: sanitizeUser(user),
    tokens,
  };
}

/* ═══════════════════════════════════════════════════
   Google Sign-In
   ═══════════════════════════════════════════════════ */

export async function googleSignIn(
  input: GoogleSignInInput,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<{ user: any; tokens: AuthTokens }> {
  const profile = await verifyGoogleToken(input.credential);

  // Upsert user — create if new, link Google ID if existing
  const user = await prisma.user.upsert({
    where: { email: profile.email },
    create: {
      email: profile.email,
      fullName: profile.name,
      googleId: profile.sub,
      verified: true,
    },
    update: {
      googleId: profile.sub,
      // Don't overwrite fullName if already set
    },
  });

  const tokens = await issueTokens(user.id, user.email, user.role, meta);

  // Audit: Google Login
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'AUTH_GOOGLE_LOGIN',
      entityType: 'User',
      entityId: user.id,
    },
  });

  return {
    user: sanitizeUser(user),
    tokens,
  };
}

/* ═══════════════════════════════════════════════════
   Refresh Token Rotation
   ═══════════════════════════════════════════════════ */

export async function refreshAccessToken(
  rawOldToken: string,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<AuthTokens> {
  const hashedOldToken = hashToken(rawOldToken);

  const record = await prisma.refreshToken.findUnique({
    where: { token: hashedOldToken },
    include: { user: true },
  });

  if (!record) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Revoked? Possible breach — revoke ALL tokens for this user
  if (record.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: record.userId },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError('Refresh token reuse detected. All sessions revoked.');
  }

  // Expired?
  if (record.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token expired. Please log in again.');
  }

  // Rotate: revoke old, issue new — atomic
  const rawNewToken = generateRefreshToken();
  const hashedNewToken = hashToken(rawNewToken);

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: record.id },
      data: {
        revokedAt: new Date(),
        replacedByToken: hashedNewToken,
      },
    });
    await tx.refreshToken.create({
      data: {
        token: hashedNewToken,
        userId: record.userId,
        expiresAt: getRefreshExpiry(),
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
      },
    });
  });

  const accessToken = signAccessToken({
    sub: record.user.id,
    email: record.user.email,
    role: record.user.role,
  });

  // Return raw token — only ever set in httpOnly cookie
  return { accessToken, refreshToken: rawNewToken };
}

/* ═══════════════════════════════════════════════════
   Logout
   ═══════════════════════════════════════════════════ */

export async function logout(rawRefreshToken: string, actorId?: string): Promise<void> {
  const hashed = hashToken(rawRefreshToken);
  await prisma.refreshToken.updateMany({
    where: { token: hashed, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (actorId) {
    await prisma.auditLog.create({
      data: {
        actorId,
        action: 'AUTH_LOGOUT',
        entityType: 'User',
        entityId: actorId,
      },
    });
  }
}

/* ═══════════════════════════════════════════════════
   Get Current User
   ═══════════════════════════════════════════════════ */

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError('User', userId);
  }

  const accountAgeDays = Math.floor(
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  const disputesAgainstCount = await prisma.dispute.count({
    where: { againstId: userId },
  });

  const activeDisputesAgainst = await prisma.dispute.count({
    where: {
      againstId: userId,
      status: { in: ['OPEN', 'UNDER_REVIEW'] },
    },
  });

  const trust = computeTrust({
    completedExchanges: user.completedExchanges,
    cancelledRequests: user.cancelledRequests,
    disputes: disputesAgainstCount,
    adminFlags: user.adminFlags,
    accountAgeDays,
  });

  const restriction = computeRestriction({
    trustStatus: trust.status,
    activeDisputes: activeDisputesAgainst,
    adminOverride: false,
  });

  return {
    user: sanitizeUser(user),
    trust,
    restriction,
  };
}

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */

function sanitizeUser(user: any) {
  const { password, failedLoginAttempts, lockedUntil, ...safe } = user;
  return {
    ...safe,
    provider: safe.googleId ? 'GOOGLE' : 'EMAIL',
  };
}
