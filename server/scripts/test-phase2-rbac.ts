import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const BASE = 'http://127.0.0.1:3001';

async function api(method: string, path: string, token: string, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function login(email: string, password: string) {
  const res = await api('POST', '/api/auth/login', '', { email, password });
  return res.data?.accessToken;
}

async function run() {
  console.log('--- PHASE 2 E2E TEST ---');

  // 0. RESET DB RESTRICTIONS
  await prisma.user.updateMany({
    where: { email: 'testuser@mctrgit.ac.in' },
    data: { isRestricted: false, adminFlags: 0, cancelledRequests: 0 }
  });
  console.log('✅ Prepared DB context (cleared previous heuristics/bans)');

  // 1. Roles Login
  const seller = await login('testuser@mctrgit.ac.in', 'Seller@1234');
  const admin = await login('kartikhulmukh24@gmail.com', 'Admin@1234');
  const buyer = await login('buyer@mctrgit.ac.in', 'Buyer@1234');

  if (!seller || !admin || !buyer) {
    console.log('❌ Auth Failed');
    return;
  }
  console.log('✅ Auth successful for all 3 roles');

  // 2. CREATE LISTING (SELLER)
  const cRes = await api('POST', '/api/listings', seller, {
    title: 'Phase2 E2E Listing',
    category: 'books',
    module: 'academics',
    price: 500,
    description: 'Auto test listing'
  });
  if (cRes.status !== 201) return console.log('❌ Listing Creation Failed', cRes.status, cRes.data);
  const listingId = cRes.data.data.id;
  console.log('✅ Seller created listing with PENDING_REVIEW status');

  // 3. SECURE APPROVAL (SELLER TRYING TO APPROVE OWN LISTING)
  const secRes = await api('PATCH', `/api/listings/${listingId}/status`, seller, { status: 'approved' });
  if (secRes.status !== 403) return console.log('❌ Security Error: Seller could approve own listing!', secRes.status, secRes.data);
  console.log('✅ Security: Seller blocked from self-approving listing');

  // 4. ADMIN APPROVE
  const aRes = await api('PATCH', `/api/listings/${listingId}/status`, admin, { status: 'approved' });
  if (aRes.status !== 200) return console.log('❌ Admin Approval Failed', aRes.data);
  console.log('✅ Admin successfully approved listing to APPROVED status');

  // 5. BUYER REQUEST
  const bRes = await api('POST', '/api/requests', buyer, { listingId, message: 'I want this item!' });
  if (bRes.status !== 201) return console.log('❌ Buyer Request Failed', bRes.status, bRes.data);
  const requestId = bRes.data.data.id;
  console.log('✅ Buyer successfully requested the approved listing');

  // 6. SELLER ACCEPT
  const sRes = await api('PATCH', `/api/requests/${requestId}/event`, seller, { event: 'ACCEPT' });
  if (sRes.status !== 200) return console.log('❌ Seller Accept Failed', sRes.data);
  console.log('✅ Seller successfully accepted the exchange request');

  console.log('\n--- ALL E2E PHASE 2 TESTS PASSED ---');
}
run();
