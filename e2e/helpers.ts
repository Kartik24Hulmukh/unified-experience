/**
 * BErozgar — E2E Test Helpers
 *
 * Uses raw SQL via `pg` for direct database access:
 *   - Read OTP codes (since EMAIL_PROVIDER=log doesn't send real emails)
 *   - Seed admin users (signup via API → promote via SQL)
 *   - Clean up test data after runs
 *
 * Why pg instead of Prisma? Prisma generate has file-lock issues
 * when the server is running, and argon2 (native dep) fails to
 * install at the workspace root on Windows without build tools.
 */

import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../server/src/lib/password';

const { Pool } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://neondb_owner:npg_e0JrPxgA2tWX@ep-polished-pine-ai7lvkol-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=disable';

const pool = new Pool({ connectionString: DATABASE_URL });

/* ═══════════════════════════════════════════════════
   Database — raw pg Pool export
   ═══════════════════════════════════════════════════ */

/** Export pool for any ad-hoc queries in tests */
export const db = pool;

export async function disconnectDb(): Promise<void> {
  await pool.end();
}

/* ─── OTP ─────────────────────────────────────────── */

/**
 * Get the most recent unused OTP for an email address.
 * This is how we "read the email" in E2E tests.
 */
export async function getLatestOtp(email: string): Promise<string | null> {
  const res = await pool.query(
    `SELECT code FROM otps
     WHERE email = $1 AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [email],
  );
  return res.rows[0]?.code ?? null;
}

/* ─── Admin Seeding ───────────────────────────────── */

const API_BASE = 'http://127.0.0.1:3001';

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
  const existing = await pool.query(
    `SELECT id FROM users WHERE email = $1`,
    [email],
  );

  if (existing.rows.length > 0) {
    // Already exists — ensure they are ADMIN + SUPER
    await pool.query(
      `UPDATE users SET role = 'ADMIN', privilege_level = 'SUPER' WHERE id = $1`,
      [existing.rows[0].id],
    );
    return existing.rows[0].id;
  }

  // Seed an OTP directly to avoid depending on the rate-limited signup route.
  const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
  await pool.query(
    `INSERT INTO otps (id, email, code, expires_at, attempts, created_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', $4, NOW())`,
    [randomUUID(), email, otp, 0],
  );

  // Verify OTP via API so user creation, password hashing, and token issuance
  // still follow the production code path.
  const verifyRes = await fetch(`${API_BASE}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, fullName, password, otp }),
  });

  if (!verifyRes.ok) {
    if (verifyRes.status === 429) {
      const passwordHash = await hashPassword(password);
      const userId = randomUUID();

      await pool.query(
        `INSERT INTO users (
           id, email, full_name, password, role, privilege_level, trust_status,
           verified, is_restricted, completed_exchanges, cancelled_requests,
           admin_flags, failed_login_attempts, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, 'ADMIN', 'SUPER', 'GOOD_STANDING',
           TRUE, FALSE, 0, 0, 0, 0, NOW(), NOW()
         )`,
        [userId, email, fullName, passwordHash],
      );

      return userId;
    }

    const body = await verifyRes.text();
    throw new Error(`Admin OTP verify failed (${verifyRes.status}): ${body}`);
  }

  const verifyBody = (await verifyRes.json()) as { user?: { id?: string } };
  const userId = verifyBody.user?.id;
  if (!userId) throw new Error('Admin user ID not returned from verify-otp');

  // Promote to ADMIN + SUPER via raw SQL.
  await pool.query(
    `UPDATE users SET role = 'ADMIN', privilege_level = 'SUPER' WHERE id = $1`,
    [userId],
  );

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
  // 1. Signup via API
  const signupRes = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, email, password }),
  });

  if (!signupRes.ok && signupRes.status !== 429) {
    const body = await signupRes.text();
    throw new Error(`User signup failed (${signupRes.status}): ${body}`);
  }

  let otp: string | null;
  if (signupRes.ok) {
    await new Promise((r) => setTimeout(r, 500));
    otp = await getLatestOtp(email);
    if (!otp) throw new Error(`No OTP found for email: ${email}`);
  } else {
    otp = `${Math.floor(100000 + Math.random() * 900000)}`;
    await pool.query(
      `INSERT INTO otps (id, email, code, expires_at, attempts, created_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', $4, NOW())`,
      [randomUUID(), email, otp, 0],
    );
  }

  // 3. Verify OTP
  const verifyRes = await fetch(`${API_BASE}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, fullName, password, otp }),
  });

  if (!verifyRes.ok) {
    if (verifyRes.status === 429) {
      const passwordHash = await hashPassword(password);
      const userId = randomUUID();
      await pool.query(
        `INSERT INTO users (
           id, email, full_name, password, role, privilege_level, trust_status,
           verified, is_restricted, completed_exchanges, cancelled_requests,
           admin_flags, failed_login_attempts, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, 'STUDENT', 'STANDARD', 'GOOD_STANDING',
           TRUE, FALSE, 0, 0, 0, 0, NOW(), NOW()
         )`,
        [userId, email, fullName, passwordHash],
      );
      return userId;
    }

    const body = await verifyRes.text();
    throw new Error(`User verify failed (${verifyRes.status}): ${body}`);
  }

  const verifyBody = (await verifyRes.json()) as { user?: { id?: string } };
  return verifyBody.user?.id;
}


/* ─── Cleanup ─────────────────────────────────────── */

/**
 * Delete all test data created during E2E runs.
 * Only deletes users with emails matching the e2e- pattern.
 * Deletes in FK-dependency order.
 */
export async function cleanupE2eData(): Promise<void> {
  const userIds = await pool.query(
    `SELECT id FROM users WHERE email LIKE 'e2e-%'`,
  );

  if (userIds.rows.length === 0) return;

  const ids = userIds.rows.map((r: { id: string }) => r.id);

  // Delete in FK-dependency order using ANY(array) for multi-id matching
  await pool.query(
    `DELETE FROM disputes WHERE raised_by = ANY($1) OR against_id = ANY($1)`,
    [ids],
  );
  await pool.query(
    `DELETE FROM requests WHERE buyer_id = ANY($1) OR seller_id = ANY($1)`,
    [ids],
  );
  await pool.query(
    `DELETE FROM audit_logs WHERE actor_id = ANY($1)`,
    [ids],
  );
  await pool.query(
    `DELETE FROM listings WHERE owner_id = ANY($1)`,
    [ids],
  );
  await pool.query(
    `DELETE FROM idempotency_keys WHERE user_id = ANY($1)`,
    [ids],
  );
  await pool.query(
    `DELETE FROM refresh_tokens WHERE user_id = ANY($1)`,
    [ids],
  );
  await pool.query(
    `DELETE FROM otps WHERE email LIKE 'e2e-%'`,
  );
  await pool.query(
    `DELETE FROM users WHERE id = ANY($1)`,
    [ids],
  );
}

/* ─── User Lookup ─────────────────────────────────── */

export async function getUserByEmail(
  email: string,
): Promise<{ id: string; email: string; role: string } | null> {
  const res = await pool.query(
    `SELECT id, email, role FROM users WHERE email = $1`,
    [email],
  );
  return res.rows[0] ?? null;
}

export async function getUserTrustData(
  userId: string,
): Promise<{
  completedExchanges: number;
  cancelledRequests: number;
  adminFlags: number;
} | null> {
  const res = await pool.query(
    `SELECT completed_exchanges AS "completedExchanges",
            cancelled_requests  AS "cancelledRequests",
            admin_flags         AS "adminFlags"
     FROM users WHERE id = $1`,
    [userId],
  );
  return res.rows[0] ?? null;
}

/* ─── Listing/Request Lookup ──────────────────────── */

export async function getListingByTitle(
  title: string,
): Promise<{ id: string; status: string } | null> {
  const res = await pool.query(
    `SELECT id, status FROM listings WHERE title ILIKE $1 LIMIT 1`,
    [`%${title}%`],
  );
  return res.rows[0] ?? null;
}

export async function getRequestForListing(
  listingId: string,
): Promise<{ id: string; status: string } | null> {
  const res = await pool.query(
    `SELECT id, status FROM requests WHERE listing_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [listingId],
  );
  return res.rows[0] ?? null;
}
