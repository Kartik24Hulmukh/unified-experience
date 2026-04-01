/**
 * BErozgar — E2E Test Helpers
 *
 * Uses raw `pg` Pool against PostgreSQL (same DB as the running server):
 *   - Read OTP codes (EMAIL_PROVIDER=log)
 *   - Seed users/admins through verify-otp flow
 *   - Clean up test data after runs
 *
 * NOTE: We use `pg` directly instead of Prisma because the generated Prisma
 * client may be out-of-sync with the current datasource provider.
 */

import { randomUUID } from 'node:crypto';
import pg from 'pg';

// Try port 5432 first (standard default), then other ports
const DB_URL = process.env.E2E_DATABASE_URL
  ?? "postgresql://berozgar:berozgar123@127.0.0.1:5432/berozgar?schema=public";

let pool = new pg.Pool({ connectionString: DB_URL });
let poolEnded = false;

/** Get a live pool, recreating it if a prior suite called disconnectDb(). */
function getPool(): pg.Pool {
  if (poolEnded) {
    pool = new pg.Pool({ connectionString: DB_URL });
    poolEnded = false;
  }
  return pool;
}

/* ═══════════════════════════════════════════════════
   Database — raw pg Pool export
   ═══════════════════════════════════════════════════ */

export const db = pool;

export async function disconnectDb(): Promise<void> {
  if (!poolEnded) {
    await pool.end();
    poolEnded = true;
  }
}

/* ─── OTP ─────────────────────────────────────────── */

/**
 * Get the most recent unused OTP for an email address.
 * This is how we "read the email" in E2E tests.
 */
export async function getLatestOtp(email: string): Promise<string | null> {
  const result = await getPool().query(
    `SELECT code FROM otps WHERE email = $1 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    [email],
  );
  return result.rows[0]?.code ?? null;
}

/* ─── Admin Seeding ───────────────────────────────── */

const API_BASE = 'http://127.0.0.1:3001';

async function ensureStudentVerifiedFixture(
  userId: string,
  email: string,
  fullName: string,
): Promise<void> {
  const existing = await getPool().query(
    `SELECT id FROM college_students WHERE official_email = $1`,
    [email],
  );

  const collegeStudentId = existing.rows[0]?.id ?? randomUUID();

  if (existing.rows.length === 0) {
    await getPool().query(
      `INSERT INTO college_students (id, name, official_email, created_at) VALUES ($1, $2, $3, NOW())`,
      [collegeStudentId, fullName, email],
    );
  }

  await getPool().query(
    `UPDATE users SET role = 'STUDENT_VERIFIED', college_student_id = $1, verified = true WHERE id = $2`,
    [collegeStudentId, userId],
  );
}

/**
 * Ensure an admin user exists in the DB.
 * Strategy: signup via API → verify OTP from DB → promote to ADMIN via raw SQL.
 */
export async function ensureAdminUser(
  email: string,
  password: string,
  fullName = 'E2E Admin',
): Promise<string> {
  const existing = await getPool().query(`SELECT id FROM users WHERE email = $1`, [email]);

  if (existing.rows.length > 0) {
    await getPool().query(
      `UPDATE users SET role = 'ADMIN', privilege_level = 'SUPER' WHERE id = $1`,
      [existing.rows[0].id],
    );
    return existing.rows[0].id;
  }

  const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
  const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
  const createdAt = new Date().toISOString();

  await getPool().query(
    `INSERT INTO otps (id, email, code, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), email, otp, expiresAt, createdAt],
  );

  const verifyRes = await fetch(`${API_BASE}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, fullName, password, otp }),
  });

  if (!verifyRes.ok) {
    const retryOtp = `${Math.floor(100000 + Math.random() * 900000)}`;
    const retryExpires = new Date(Date.now() + 10 * 60000).toISOString();
    const retryCreated = new Date().toISOString();

    await getPool().query(
      `INSERT INTO otps (id, email, code, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), email, retryOtp, retryExpires, retryCreated],
    );

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

    await getPool().query(
      `UPDATE users SET role = 'ADMIN', privilege_level = 'SUPER' WHERE id = $1`,
      [retryUserId],
    );
    return retryUserId;
  }

  const verifyBody = (await verifyRes.json()) as { user?: { id?: string } };
  const userId = verifyBody.user?.id;
  if (!userId) throw new Error('Admin user ID not returned from verify-otp');

  await getPool().query(
    `UPDATE users SET role = 'ADMIN', privilege_level = 'SUPER' WHERE id = $1`,
    [userId],
  );
  return userId;
}

/**
 * Programmatically create a verified user for E2E tests.
 */
export async function createVerifiedUser(
  email: string,
  password: string,
  fullName = 'E2E User',
): Promise<string> {
  const existing = await getPool().query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing.rows.length > 0) {
    await ensureStudentVerifiedFixture(existing.rows[0].id, email, fullName);
    return existing.rows[0].id;
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
  const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
  const createdAt = new Date().toISOString();

  await getPool().query(
    `INSERT INTO otps (id, email, code, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), email, otp, expiresAt, createdAt],
  );

  const firstTry = await verifyWithOtp(otp);
  if (firstTry.ok && firstTry.userId) {
    await ensureStudentVerifiedFixture(firstTry.userId, email, fullName);
    return firstTry.userId;
  }

  const retryOtp = `${Math.floor(100000 + Math.random() * 900000)}`;
  const retryExpires = new Date(Date.now() + 10 * 60000).toISOString();
  const retryCreated = new Date().toISOString();

  await getPool().query(
    `INSERT INTO otps (id, email, code, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), email, retryOtp, retryExpires, retryCreated],
  );

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

export async function cleanupE2eData(): Promise<void> {
  const result = await getPool().query(`SELECT id FROM users WHERE email LIKE 'e2e-%'`);

  if (result.rows.length === 0) return;

  for (const { id } of result.rows) {
    await getPool().query(`DELETE FROM disputes WHERE raised_by = $1 OR against_id = $1`, [id]);
    await getPool().query(`DELETE FROM requests WHERE buyer_id = $1 OR seller_id = $1`, [id]);
    await getPool().query(`DELETE FROM audit_logs WHERE actor_id = $1`, [id]);
    await getPool().query(`DELETE FROM listings WHERE owner_id = $1`, [id]);
    await getPool().query(`DELETE FROM idempotency_keys WHERE user_id = $1`, [id]);
    await getPool().query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [id]);
    await getPool().query(`DELETE FROM users WHERE id = $1`, [id]);
  }

  await getPool().query(`DELETE FROM otps WHERE email LIKE 'e2e-%'`);
}

/* ─── User Lookup ─────────────────────────────────── */

export async function getUserByEmail(
  email: string,
): Promise<{ id: string; email: string; role: string } | null> {
  const result = await getPool().query(`SELECT id, email, role FROM users WHERE email = $1`, [email]);
  return result.rows[0] ?? null;
}

export async function getUserTrustData(
  userId: string,
): Promise<{
  completedExchanges: number;
  cancelledRequests: number;
  adminFlags: number;
} | null> {
  const result = await getPool().query(
    `SELECT completed_exchanges AS "completedExchanges",
            cancelled_requests  AS "cancelledRequests",
            admin_flags         AS "adminFlags"
     FROM users WHERE id = $1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

/* ─── Listing/Request Lookup ──────────────────────── */

export async function getListingByTitle(
  title: string,
): Promise<{ id: string; status: string } | null> {
  const result = await getPool().query(
    `SELECT id, status FROM listings WHERE title LIKE $1 LIMIT 1`,
    [`%${title}%`],
  );
  return result.rows[0] ?? null;
}

export async function getRequestForListing(
  listingId: string,
): Promise<{ id: string; status: string } | null> {
  const result = await getPool().query(
    `SELECT id, status FROM requests WHERE listing_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [listingId],
  );
  return result.rows[0] ?? null;
}
