/**
 * BErozgar — E2E Test Helpers
 *
 * Uses Prisma raw SQL against the same SQLite file as the running server:
 *   - Read OTP codes (EMAIL_PROVIDER=log)
 *   - Seed users/admins through verify-otp flow
 *   - Clean up test data after runs
 */

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { PrismaClient } from '../server/node_modules/@prisma/client/default.js';

const DB_URL = "file:C:/Users/kadam/OneDrive/Desktop/Unified-Experience/unified-experience/server/prisma/dev.db";

const prisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
  log: ['warn', 'error'],
});

/* ═══════════════════════════════════════════════════
   Database — raw pg Pool export
   ═══════════════════════════════════════════════════ */

/** Export prisma for any ad-hoc queries in tests */
export const db = prisma;

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}

/* ─── OTP ─────────────────────────────────────────── */

/**
 * Get the most recent unused OTP for an email address.
 * This is how we "read the email" in E2E tests.
 */
export async function getLatestOtp(email: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ code: string }>>`
    SELECT code
    FROM otps
    WHERE email = ${email} AND used_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0]?.code ?? null;
}

/* ─── Admin Seeding ───────────────────────────────── */

const API_BASE = 'http://127.0.0.1:3001';

async function ensureStudentVerifiedFixture(
  userId: string,
  email: string,
  fullName: string,
): Promise<void> {
  const existingCollegeRecord = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM college_students WHERE official_email = ${email}
  `;

  const collegeStudentId = existingCollegeRecord[0]?.id ?? randomUUID();

  if (existingCollegeRecord.length === 0) {
    await prisma.$executeRaw`
      INSERT INTO college_students (id, name, official_email, created_at)
      VALUES (${collegeStudentId}, ${fullName}, ${email}, datetime('now'))
    `;
  }

  await prisma.$executeRaw`
    UPDATE users
    SET role = 'STUDENT_VERIFIED', college_student_id = ${collegeStudentId}, verified = true
    WHERE id = ${userId}
  `;
}

/**
 * Ensure an admin user exists in the DB.
 * Strategy: signup via API → verify OTP from DB → promote to ADMIN via raw SQL.
 * This avoids needing argon2 at the workspace root.
 */
export async function ensureAdminUser(
  email: string,
  password: string,
  fullName = 'E2E Admin',
): Promise<string> {
  // Check if this user already exists
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM users WHERE email = ${email}
  `;

  if (existing.length > 0) {
    // Already exists — ensure they are ADMIN + SUPER
    await prisma.$executeRaw`
      UPDATE users SET role = 'ADMIN', privilege_level = 'SUPER' WHERE id = ${existing[0].id}
    `;
    return existing[0].id;
  }

  // Seed an OTP directly to avoid depending on the rate-limited signup route.
  const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
  await prisma.$executeRaw`
    INSERT INTO otps (id, email, code, expires_at, attempts, created_at)
    VALUES (${randomUUID()}, ${email}, ${otp}, datetime('now', '+10 minutes'), ${0}, datetime('now'))
  `;

  // Verify OTP via API so user creation, password hashing, and token issuance
  // still follow the production code path.
  const verifyRes = await fetch(`${API_BASE}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, fullName, password, otp }),
  });

  if (!verifyRes.ok) {
    // Retry once with a fresh OTP in case another flow consumed/replaced the previous code.
    const retryOtp = `${Math.floor(100000 + Math.random() * 900000)}`;
    await prisma.$executeRaw`
      INSERT INTO otps (id, email, code, expires_at, attempts, created_at)
      VALUES (${randomUUID()}, ${email}, ${retryOtp}, datetime('now', '+10 minutes'), ${0}, datetime('now'))
    `;

    const retryRes = await fetch(`${API_BASE}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName, password, otp: retryOtp }),
    });

    if (!retryRes.ok) {
      const body = await retryRes.text();
      throw new Error(`Admin OTP verify failed (${retryRes.status}): ${body}`);
    }

    const retryBody = (await retryRes.json()) as { user?: { id?: string } };
    const retryUserId = retryBody.user?.id;
    if (!retryUserId) throw new Error('Admin user ID not returned from verify-otp retry');

    await prisma.$executeRaw`
      UPDATE users SET role = 'ADMIN', privilege_level = 'SUPER' WHERE id = ${retryUserId}
    `;
    return retryUserId;
  }

  const verifyBody = (await verifyRes.json()) as { user?: { id?: string } };
  const userId = verifyBody.user?.id;
  if (!userId) throw new Error('Admin user ID not returned from verify-otp');

  // Promote to ADMIN + SUPER via raw SQL.
  await prisma.$executeRaw`
    UPDATE users SET role = 'ADMIN', privilege_level = 'SUPER' WHERE id = ${userId}
  `;

  return userId;
}

/**
 * Programmatically create a verified user for E2E tests.
 * Useful for tests that need to starting from a logged-in state without manual UI steps.
 */
export async function createVerifiedUser(
  email: string,
  password: string,
  fullName = 'E2E User',
): Promise<string> {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM users WHERE email = ${email}
  `;
  if (existing.length > 0) {
    await ensureStudentVerifiedFixture(existing[0].id, email, fullName);
    return existing[0].id;
  }

  const verifyWithOtp = async (otpCode: string) => {
    const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName, password, otp: otpCode }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false as const, status: res.status, body };
    }
    const json = (await res.json()) as { user?: { id?: string } };
    return { ok: true as const, userId: json.user?.id ?? null };
  };

  const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
  await prisma.$executeRaw`
    INSERT INTO otps (id, email, code, expires_at, attempts, created_at)
    VALUES (${randomUUID()}, ${email}, ${otp}, datetime('now', '+10 minutes'), ${0}, datetime('now'))
  `;

  const firstTry = await verifyWithOtp(otp);
  if (firstTry.ok && firstTry.userId) {
    await ensureStudentVerifiedFixture(firstTry.userId, email, fullName);
    return firstTry.userId;
  }

  const retryOtp = `${Math.floor(100000 + Math.random() * 900000)}`;
  await prisma.$executeRaw`
    INSERT INTO otps (id, email, code, expires_at, attempts, created_at)
    VALUES (${randomUUID()}, ${email}, ${retryOtp}, datetime('now', '+10 minutes'), ${0}, datetime('now'))
  `;

  const secondTry = await verifyWithOtp(retryOtp);
  if (secondTry.ok && secondTry.userId) {
    await ensureStudentVerifiedFixture(secondTry.userId, email, fullName);
    return secondTry.userId;
  }

  const status = secondTry.ok ? 200 : secondTry.status;
  const body = secondTry.ok ? 'Missing user id in verify response' : secondTry.body;
  throw new Error(`User verify failed (${status}): ${body}`);
}


/* ─── Cleanup ─────────────────────────────────────── */

/**
 * Delete all test data created during E2E runs.
 * Only deletes users with emails matching the e2e- pattern.
 * Deletes in FK-dependency order.
 */
export async function cleanupE2eData(): Promise<void> {
  const userIds = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM users WHERE email LIKE 'e2e-%'
  `;

  if (userIds.length === 0) return;

  for (const { id } of userIds) {
    await prisma.$executeRaw`DELETE FROM disputes WHERE raised_by = ${id} OR against_id = ${id}`;
    await prisma.$executeRaw`DELETE FROM requests WHERE buyer_id = ${id} OR seller_id = ${id}`;
    await prisma.$executeRaw`DELETE FROM audit_logs WHERE actor_id = ${id}`;
    await prisma.$executeRaw`DELETE FROM listings WHERE owner_id = ${id}`;
    await prisma.$executeRaw`DELETE FROM idempotency_keys WHERE user_id = ${id}`;
    await prisma.$executeRaw`DELETE FROM refresh_tokens WHERE user_id = ${id}`;
    await prisma.$executeRaw`DELETE FROM users WHERE id = ${id}`;
  }

  await prisma.$executeRaw`DELETE FROM otps WHERE email LIKE 'e2e-%'`;
}

/* ─── User Lookup ─────────────────────────────────── */

export async function getUserByEmail(
  email: string,
): Promise<{ id: string; email: string; role: string } | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; email: string; role: string }>>`
    SELECT id, email, role FROM users WHERE email = ${email}
  `;
  return rows[0] ?? null;
}

export async function getUserTrustData(
  userId: string,
): Promise<{
  completedExchanges: number;
  cancelledRequests: number;
  adminFlags: number;
} | null> {
  const rows = await prisma.$queryRaw<Array<{
    completedExchanges: number;
    cancelledRequests: number;
    adminFlags: number;
  }>>`
    SELECT completed_exchanges AS "completedExchanges",
           cancelled_requests  AS "cancelledRequests",
           admin_flags         AS "adminFlags"
    FROM users WHERE id = ${userId}
  `;
  return rows[0] ?? null;
}

/* ─── Listing/Request Lookup ──────────────────────── */

export async function getListingByTitle(
  title: string,
): Promise<{ id: string; status: string } | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status FROM listings WHERE title LIKE ${`%${title}%`} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getRequestForListing(
  listingId: string,
): Promise<{ id: string; status: string } | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status FROM requests WHERE listing_id = ${listingId} ORDER BY created_at DESC LIMIT 1
  `;
  return rows[0] ?? null;
}
