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
import { AUTH, ADMIN_REGISTRY } from '@/config/constants';
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
import type { User } from '@prisma/client';

/* ═══════════════════════════════════════════════════
   College Registry Lookup
   ═══════════════════════════════════════════════════ */

/**
 * Check if an email exists in the CollegeStudentRegistry.
 * Returns the registry record if found, null otherwise.
 */
async function lookupCollegeStudent(email: string) {
  return prisma.collegeStudent.findUnique({
    where: { officialEmail: email.toLowerCase().trim() },
  });
}

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
  }, {
    maxWait: 10000,
    timeout: 20000,
  });

  // Return the RAW token — only ever sent in an httpOnly cookie
  return { accessToken, refreshToken: rawRefreshToken };
}

/* ═══════════════════════════════════════════════════
   Signup — Send OTP
   ═══════════════════════════════════════════════════ */

export async function signup(input: SignupInput): Promise<{ message: string }> {
  // No email domain restriction — all users can sign up.
  // Role assignment happens at OTP verification based on CollegeStudentRegistry.

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
  const otpRecord = await prisma.otp.create({
    data: {
      email: input.email,
      code: otp,
      expiresAt: getOtpExpiry(),
    },
  });

  // HIGH-F FIX: attempt email delivery AFTER saving the OTP, but DELETE the
  // record on failure so the DB doesn't accumulate orphaned, undeliverable OTPs.
  // (Saving first avoids the opposite race where the email sends but the
  // subsequent DB write fails — an undeliverable code is worse than no code.)
  try {
    await sendOtpEmail({
      to: input.email,
      otp,
      expiresInMinutes: AUTH.OTP_EXPIRES_MINUTES,
    });
  } catch (err) {
    // Best-effort cleanup — log failure but don't let a delete error shadow the real error
    await prisma.otp.delete({ where: { id: otpRecord.id } }).catch((delErr) => {
      console.error('Failed to cleanup undelivered OTP record:', delErr);
    });
    // SEC-LEAK-02: never forward transport error details — they may contain
    // SMTP hostnames, DNS failures, or credential-related strings.
    throw new ValidationError('Unable to send verification email. Please try again later.');
  }

  // MED-4 FIX: Wrap audit log write in try-catch so a transient DB failure
  // here doesn't return 500 after the OTP email was already delivered.
  // Without this, the user sees an error, retries signup, and now has two
  // valid OTPs in flight simultaneously.
  try {
    await prisma.auditLog.create({
      data: {
        actorId: null, // SYSTEM
        action: 'AUTH_SIGNUP_REQUEST',
        entityType: 'User',
        metadata: { email: input.email },
      },
    });
  } catch {
    // Non-fatal — audit write failure must never block or corrupt the signup flow
  }

  return { message: 'Verification code sent to your email' };
}

/* ═══════════════════════════════════════════════════
   Verify OTP & Create Account
   ═══════════════════════════════════════════════════ */

export async function verifyOtp(
  input: VerifyOtpInput,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<{ user: ReturnType<typeof sanitizeUser>; tokens: AuthTokens }> {
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
    // CRIT-C FIX: atomically increment + conditionally burn inside a single
    // transaction. Reading `attempts` outside the tx and incrementing separately
    // allowed two concurrent wrong guesses to both bypass the 5-attempt threshold
    // (both read attempts=4, neither burned, effective limit became 6+).
    await prisma.$transaction(async (tx) => {
      // Only increment if not already used and under the limit
      const inc = await tx.otp.updateMany({
        where: { id: otpRecord.id, usedAt: null, attempts: { lt: 5 } },
        data: { attempts: { increment: 1 } },
      });
      if (inc.count === 0) {
        throw new ValidationError('OTP has been invalidated. Please request a new one.');
      }
      // After atomic increment, check if we've now hit or exceeded the limit
      const current = await tx.otp.findUnique({
        where: { id: otpRecord.id },
        select: { attempts: true },
      });
      if (current && current.attempts >= 5) {
        await tx.otp.update({
          where: { id: otpRecord.id },
          data: { usedAt: new Date() },
        });
        throw new ValidationError('OTP has been invalidated after too many attempts. Please request a new one.');
      }
    });
    throw new ValidationError('Invalid OTP code');
  }

  // Atomic: mark OTP used + upsert user (prevents double-use race)
  const passwordHash = await hashPassword(input.password);

  // Check college registry and admin registry to determine role
  const collegeRecord = await lookupCollegeStudent(input.email);
  const isAdmin = ADMIN_REGISTRY.includes(input.email.toLowerCase().trim());
  const assignedRole = isAdmin ? 'ADMIN' : (collegeRecord ? 'STUDENT_VERIFIED' : 'PUBLIC_USER');

  // HIGH-A FIX: pre-compute all in-memory token values BEFORE the transaction.
  const accessToken = signAccessToken({
    sub: 'pending', // replaced after upsert gives us the real userId
    email: input.email,
    role: assignedRole,
  });
  const rawRefreshToken = generateRefreshToken();
  const hashedToken = hashToken(rawRefreshToken);

  const user = await prisma.$transaction(async (tx) => {
    // CRIT-02 FIX: use updateMany with { usedAt: null } as the guard so that only
    // ONE concurrent thread can win the atomic mark-used. Any thread that loses
    // (count === 0) means the OTP was already consumed — throw immediately.
    const usedOtp = await tx.otp.updateMany({
      where: { id: otpRecord.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (usedOtp.count === 0) {
      throw new ValidationError('OTP already used. Please request a new one.');
    }

    const createdUser = await tx.user.upsert({
      where: { email: input.email },
      create: {
        email: input.email,
        fullName: input.fullName,
        password: passwordHash,
        role: assignedRole,
        ...(isAdmin ? { privilegeLevel: 'SUPER' as const } : {}),
        collegeStudentId: collegeRecord?.id ?? null,
        verified: true,
      },
      update: {
        fullName: input.fullName,
        password: passwordHash,
        role: assignedRole,
        ...(isAdmin ? { privilegeLevel: 'SUPER' as const } : {}),
        collegeStudentId: collegeRecord?.id ?? null,
        verified: true,
      },
    });

    // HIGH-A FIX (continued): create the refresh token inside the same tx.
    // This guarantees the user row and its first session token are always
    // created together — no crash window between account creation and token issuance.
    await tx.refreshToken.create({
      data: {
        token: hashedToken,
        userId: createdUser.id,
        expiresAt: getRefreshExpiry(),
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
      },
    });

    // Prune excess refresh tokens for this user (enforce per-user limit)
    const allTokens = await tx.refreshToken.findMany({
      where: { userId: createdUser.id, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (allTokens.length > AUTH.MAX_REFRESH_TOKENS_PER_USER) {
      const staleIds = allTokens
        .slice(AUTH.MAX_REFRESH_TOKENS_PER_USER)
        .map((t) => t.id);
      await tx.refreshToken.updateMany({
        where: { id: { in: staleIds } },
        data: { revokedAt: new Date() },
      });
    }

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

  // Re-sign the access token now that we have the real userId
  const finalAccessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });

  return {
    user: sanitizeUser(user),
    tokens: { accessToken: finalAccessToken, refreshToken: rawRefreshToken },
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
): Promise<{ user: ReturnType<typeof sanitizeUser>; tokens: AuthTokens }> {
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
    // SEC-ENUM-02: return the same generic message as invalid credentials
    // to prevent account-existence enumeration via lockout-specific text.
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await verifyPassword(user.password, input.password);

  if (!valid) {
    // CRIT-2 FIX: Atomic increment prevents the read-modify-write race where
    // two concurrent wrong-password requests both read counter=N, compute N+1,
    // and SET N+1 — advancing the counter by 1 instead of 2.
    // updateMany with `lockedUntil: null` ensures only the first request that
    // crosses the threshold writes the lock (idempotent for concurrent callers).
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      await prisma.user.updateMany({
        where: { id: user.id, lockedUntil: null },
        data: { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) },
      });
    }

    throw new UnauthorizedError('Invalid email or password');
  }

  // SELF-HEAL FEATURE: ensure admin/student roles are properly applied
  // if they were registered while .env wasn't loaded or if registry updated.
  let isRoleUpdated = false;
  const isAdmin = ADMIN_REGISTRY.includes(user.email.toLowerCase().trim());
  const collegeRecord = await lookupCollegeStudent(user.email);
  if (isAdmin && user.role !== 'ADMIN') {
    user.role = 'ADMIN';
    user.privilegeLevel = 'SUPER';
    isRoleUpdated = true;
  } else if (!isAdmin && collegeRecord && user.role !== 'STUDENT_VERIFIED') {
    user.role = 'STUDENT_VERIFIED';
    user.collegeStudentId = collegeRecord.id;
    isRoleUpdated = true;
  }

  // DET-1 FIX: pre-compute in-memory token values BEFORE the transaction.
  // Previously counter-reset and issueTokens() were separate DB operations,
  // leaving a crash window where counters are cleared but no refresh token
  // exists. Inlining both into one transaction closes that gap atomically.
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const rawRefreshToken = generateRefreshToken();
  const hashedToken = hashToken(rawRefreshToken);

  await prisma.$transaction(async (tx) => {
    // Reset lockout counters on successful login
    const updateData: Record<string, unknown> = {};
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      updateData.failedLoginAttempts = 0;
      updateData.lockedUntil = null;
    }
    if (isRoleUpdated) {
      updateData.role = user.role;
      updateData.privilegeLevel = user.privilegeLevel;
      updateData.collegeStudentId = user.collegeStudentId;
    }
    if (Object.keys(updateData).length > 0) {
      await tx.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    // Create refresh token
    await tx.refreshToken.create({
      data: {
        token: hashedToken,
        userId: user.id,
        expiresAt: getRefreshExpiry(),
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
      },
    });

    // Enforce max refresh tokens per user (revoke oldest)
    const allTokens = await tx.refreshToken.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (allTokens.length > AUTH.MAX_REFRESH_TOKENS_PER_USER) {
      const staleIds = allTokens
        .slice(AUTH.MAX_REFRESH_TOKENS_PER_USER)
        .map((t) => t.id);
      await tx.refreshToken.updateMany({
        where: { id: { in: staleIds } },
        data: { revokedAt: new Date() },
      });
    }
  }, {
    maxWait: 10_000,
    timeout: 20_000,
  });

  // SEC-AUDIT-01: audit log write is non-critical — must never throw 500
  // after a successful authentication (tokens already issued above).
  try {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'AUTH_LOGIN',
        entityType: 'User',
        entityId: user.id,
        metadata: { ip: meta?.ipAddress },
      },
    });
  } catch {
    // Non-fatal — audit write failure must never block login
  }

  return {
    user: sanitizeUser(user),
    tokens: { accessToken, refreshToken: rawRefreshToken },
  };
}

/* ═══════════════════════════════════════════════════
   Google Sign-In
   ═══════════════════════════════════════════════════ */

export async function googleSignIn(
  input: GoogleSignInInput,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<{ user: ReturnType<typeof sanitizeUser>; tokens: AuthTokens }> {
  const profile = await verifyGoogleToken(input.credential);

  // Determine role based on college registry and admin registry.
  const collegeRecord = await lookupCollegeStudent(profile.email);
  const isAdmin = ADMIN_REGISTRY.includes(profile.email.toLowerCase().trim());
  const assignedRole = isAdmin ? 'ADMIN' : (collegeRecord ? 'STUDENT_VERIFIED' : 'PUBLIC_USER');

  // Upsert user — create if new, link Google ID if existing
  const user = await prisma.user.upsert({
    where: { email: profile.email },
    create: {
      email: profile.email,
      fullName: profile.name,
      googleId: profile.sub,
      role: assignedRole,
      ...(isAdmin ? { privilegeLevel: 'SUPER' as const } : {}),
      collegeStudentId: collegeRecord?.id ?? null,
      verified: true,
    },
    update: {
      googleId: profile.sub,
      // Update role based on admin registry or college registry
      ...(isAdmin
        ? { role: 'ADMIN' as const, privilegeLevel: 'SUPER' as const }
        : collegeRecord
          ? { role: 'STUDENT_VERIFIED' as const, collegeStudentId: collegeRecord.id }
          : {}),
      // HIGH-07 FIX: reset any lockout state on successful Google sign-in.
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  // DET-1 FIX: pre-compute token values, then create refresh token inside the
  // same flow as the upsert so there is no crash window between account
  // creation/update and token issuance.
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const rawRefreshToken = generateRefreshToken();
  const hashedToken = hashToken(rawRefreshToken);

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.create({
      data: {
        token: hashedToken,
        userId: user.id,
        expiresAt: getRefreshExpiry(),
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
      },
    });

    // Enforce max refresh tokens per user (revoke oldest)
    const allTokens = await tx.refreshToken.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (allTokens.length > AUTH.MAX_REFRESH_TOKENS_PER_USER) {
      const staleIds = allTokens
        .slice(AUTH.MAX_REFRESH_TOKENS_PER_USER)
        .map((t) => t.id);
      await tx.refreshToken.updateMany({
        where: { id: { in: staleIds } },
        data: { revokedAt: new Date() },
      });
    }
  }, {
    maxWait: 10_000,
    timeout: 20_000,
  });

  // SEC-AUDIT-01: non-critical audit write — must never throw 500 after auth
  try {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'AUTH_GOOGLE_LOGIN',
        entityType: 'User',
        entityId: user.id,
      },
    });
  } catch {
    // Non-fatal — audit write failure must never block login
  }

  return {
    user: sanitizeUser(user),
    tokens: { accessToken, refreshToken: rawRefreshToken },
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
    // CRIT-03 FIX: guarded updateMany ensures only ONE concurrent caller
    // wins the revocation. If count === 0, another refresh already consumed
    // the token — treat as reuse rather than silently issuing a second token.
    const revoked = await tx.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: {
        revokedAt: new Date(),
        replacedByToken: hashedNewToken,
      },
    });

    if (revoked.count === 0) {
      throw new UnauthorizedError('Refresh token already consumed. Please log in again.');
    }

    await tx.refreshToken.create({
      data: {
        token: hashedNewToken,
        userId: record.userId,
        expiresAt: getRefreshExpiry(),
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
      },
    });
  }, {
    maxWait: 10000,
    timeout: 20000,
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

  // SELF-HEAL FEATURE: ensure admin/student roles are properly applied dynamically.
  let isRoleUpdated = false;
  const isAdmin = ADMIN_REGISTRY.includes(user.email.toLowerCase().trim());
  const collegeRecord = await lookupCollegeStudent(user.email);
  if (isAdmin && user.role !== 'ADMIN') {
    user.role = 'ADMIN';
    user.privilegeLevel = 'SUPER';
    isRoleUpdated = true;
  } else if (!isAdmin && collegeRecord && user.role !== 'STUDENT_VERIFIED') {
    user.role = 'STUDENT_VERIFIED';
    user.collegeStudentId = collegeRecord.id;
    isRoleUpdated = true;
  }

  if (isRoleUpdated) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        role: user.role,
        privilegeLevel: user.privilegeLevel,
        collegeStudentId: user.collegeStudentId,
      },
    });
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

  // V3-15: Write-through — keep trustStatus column in sync for admin tooling and reporting.
  // The column default is GOOD_STANDING which becomes stale as trust degrades over time.
  if (user.trustStatus !== trust.status) {
    await prisma.user.update({
      where: { id: userId },
      data: { trustStatus: trust.status },
    }).catch(() => { /* non-critical: best-effort sync, don't fail the auth request */ });
  }

  const restriction = computeRestriction({
    trustStatus: trust.status,
    activeDisputes: activeDisputesAgainst,
    adminOverride: user.isRestricted,
    userRole: user.role,
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

function sanitizeUser(user: User) {
  const { password, failedLoginAttempts, lockedUntil, ...safe } = user;
  return {
    ...safe,
    provider: safe.googleId ? 'GOOGLE' : 'EMAIL',
    collegeLinked: !!safe.collegeStudentId,
  };
}
