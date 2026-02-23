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

const { Pool } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://berozgar:berozgar123@localhost:5433/berozgar';

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

const API_BASE = 'http://localhost:3001';

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

  // 1. Signup via API
  const signupRes = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, email, password }),
  });

  if (!signupRes.ok) {
    const body = await signupRes.text();
    throw new Error(`Admin signup failed (${signupRes.status}): ${body}`);
  }

  // 2. Read OTP from DB (EMAIL_PROVIDER=log, so it's stored but not sent)
  await new Promise((r) => setTimeout(r, 500));
  const otp = await getLatestOtp(email);
  if (!otp) throw new Error(`No OTP found for admin email: ${email}`);

  // 3. Verify OTP via API (this creates the user with hashed password)
  const verifyRes = await fetch(`${API_BASE}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, fullName, password, otp }),
  });

  if (!verifyRes.ok) {
    const body = await verifyRes.text();
    throw new Error(`Admin OTP verify failed (${verifyRes.status}): ${body}`);
  }

  const verifyBody = (await verifyRes.json()) as any;
  const userId = verifyBody.user?.id;
  if (!userId) throw new Error('Admin user ID not returned from verify-otp');

  // 4. Promote to ADMIN + SUPER via raw SQL
  await pool.query(
    `UPDATE users SET role = 'ADMIN', privilege_level = 'SUPER' WHERE id = $1`,
    [userId],
  );

  return userId;
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

  const ids = userIds.rows.map((r: any) => r.id);

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
