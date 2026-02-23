/**
 * BErozgar — Database Seed Script
 *
 * Creates test data for development and staging environments.
 * Idempotent — safe to run multiple times (uses upsert).
 *
 * Usage: npm run db:seed
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── Users ─────────────────────────────────────────

  const adminPw = await argon2.hash('Admin@1234');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mctrgit.ac.in' },
    update: { role: 'ADMIN', verified: true, privilegeLevel: 'SUPER' },
    create: {
      email: 'admin@mctrgit.ac.in',
      fullName: 'Admin BErozgar',
      password: adminPw,
      role: 'ADMIN',
      verified: true,
      privilegeLevel: 'SUPER',
    },
  });
  console.log(`  ✓ Admin:  ${admin.email} (${admin.id})`);

  const sellerPw = await argon2.hash('Seller@1234');
  const seller = await prisma.user.upsert({
    where: { email: 'testuser@mctrgit.ac.in' },
    update: { verified: true },
    create: {
      email: 'testuser@mctrgit.ac.in',
      fullName: 'Test Seller',
      password: sellerPw,
      role: 'STUDENT',
      verified: true,
    },
  });
  console.log(`  ✓ Seller: ${seller.email} (${seller.id})`);

  const buyerPw = await argon2.hash('Buyer@1234');
  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@mctrgit.ac.in' },
    update: { verified: true },
    create: {
      email: 'buyer@mctrgit.ac.in',
      fullName: 'Buyer Student',
      password: buyerPw,
      role: 'STUDENT',
      verified: true,
    },
  });
  console.log(`  ✓ Buyer:  ${buyer.email} (${buyer.id})`);

  // ── Sample Listings ──────────────────────────────

  const listings = [
    {
      title: 'Engineering Mathematics Textbook',
      description: 'Kreyszig 10th edition, good condition, some highlights',
      category: 'Books',
      module: 'academics',
      price: 350,
      status: 'APPROVED' as const,
    },
    {
      title: 'Scientific Calculator (Casio fx-991EX)',
      description: 'Barely used, with original case and manual',
      category: 'Electronics',
      module: 'essentials',
      price: 800,
      status: 'APPROVED' as const,
    },
    {
      title: 'Room Cooler (Table Fan)',
      description: 'Portable table fan, works perfectly',
      category: 'Appliances',
      module: 'accommodation',
      price: 500,
      status: 'PENDING_REVIEW' as const,
    },
  ];

  for (const listing of listings) {
    const existing = await prisma.listing.findFirst({
      where: { title: listing.title, ownerId: seller.id },
    });

    if (!existing) {
      await prisma.listing.create({
        data: {
          ...listing,
          ownerId: seller.id,
        },
      });
      console.log(`  ✓ Listing: "${listing.title}" [${listing.status}]`);
    } else {
      console.log(`  ○ Listing: "${listing.title}" (already exists)`);
    }
  }

  // ── Audit Log Entry ──────────────────────────────

  const auditExists = await prisma.auditLog.findFirst({
    where: { actorId: admin.id, action: 'SEED_DATABASE' },
  });

  if (!auditExists) {
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: 'SEED_DATABASE',
        entityType: 'SYSTEM',
        actorRole: 'ADMIN',
        ipAddress: '127.0.0.1',
        metadata: { seedVersion: '2.0.0', timestamp: new Date().toISOString() },
      },
    });
    console.log('  ✓ Audit log: seed entry created');
  }

  // ── Summary ──────────────────────────────────────

  const counts = {
    users: await prisma.user.count(),
    listings: await prisma.listing.count(),
    requests: await prisma.request.count(),
    disputes: await prisma.dispute.count(),
  };

  console.log('\n📊 Database state:');
  console.log(`  Users:    ${counts.users}`);
  console.log(`  Listings: ${counts.listings}`);
  console.log(`  Requests: ${counts.requests}`);
  console.log(`  Disputes: ${counts.disputes}`);
  console.log('\n✅ Seed complete.\n');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
