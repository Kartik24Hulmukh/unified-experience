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

  // ── RGIT College Student Registry ─────────────────
  // Official student records — used to auto-verify RGIT students on signup
  const rgitStudents = [
    { name: 'Kartik Hulmukh', officialEmail: 'kartikhulmukh24@gmail.com', department: 'Computer Science', year: '3rd', phone: null },
    { name: 'Test Student', officialEmail: 'testuser@mctrgit.ac.in', department: 'Computer Science', year: '2nd', phone: null },
    { name: 'Buyer Student', officialEmail: 'buyer@mctrgit.ac.in', department: 'IT', year: '2nd', phone: null },
    { name: 'Rahul Sharma', officialEmail: 'rahul.sharma@mctrgit.ac.in', department: 'Computer Science', year: '3rd', phone: null },
    { name: 'Priya Patel', officialEmail: 'priya.patel@mctrgit.ac.in', department: 'IT', year: '2nd', phone: null },
    { name: 'Amit Kumar', officialEmail: 'amit.kumar@mctrgit.ac.in', department: 'Electronics', year: '4th', phone: null },
    { name: 'Neha Deshmukh', officialEmail: 'neha.deshmukh@mctrgit.ac.in', department: 'Mechanical', year: '3rd', phone: null },
    { name: 'Vikram Singh', officialEmail: 'vikram.singh@mctrgit.ac.in', department: 'Civil', year: '2nd', phone: null },
    { name: 'Sneha Reddy', officialEmail: 'sneha.reddy@mctrgit.ac.in', department: 'Computer Science', year: '4th', phone: null },
    { name: 'Rohan Joshi', officialEmail: 'rohan.joshi@mctrgit.ac.in', department: 'IT', year: '3rd', phone: null },
  ];

  console.log('  Seeding RGIT College Student Registry...');
  for (const student of rgitStudents) {
    await prisma.collegeStudent.upsert({
      where: { officialEmail: student.officialEmail },
      update: { name: student.name, department: student.department, year: student.year },
      create: student,
    });
    console.log(`  ✓ RGIT Student: ${student.name} (${student.officialEmail})`);
  }

  // ── Users ─────────────────────────────────────────

  const adminPw = await argon2.hash('Admin@1234');
  const adminCollegeRecord = await prisma.collegeStudent.findUnique({
    where: { officialEmail: 'kartikhulmukh24@gmail.com' },
  });
  const admin = await prisma.user.upsert({
    where: { email: 'kartikhulmukh24@gmail.com' },
    update: { role: 'ADMIN', verified: true, privilegeLevel: 'SUPER', collegeStudentId: adminCollegeRecord?.id ?? null },
    create: {
      email: 'kartikhulmukh24@gmail.com',
      fullName: 'Kartik Hulmukh',
      password: adminPw,
      role: 'ADMIN',
      verified: true,
      privilegeLevel: 'SUPER',
      collegeStudentId: adminCollegeRecord?.id ?? null,
    },
  });
  console.log(`  ✓ Admin:  ${admin.email} (${admin.id})`);

  const sellerCollegeRecord = await prisma.collegeStudent.findUnique({
    where: { officialEmail: 'testuser@mctrgit.ac.in' },
  });
  const sellerPw = await argon2.hash('Seller@1234');
  const seller = await prisma.user.upsert({
    where: { email: 'testuser@mctrgit.ac.in' },
    update: { verified: true, collegeStudentId: sellerCollegeRecord?.id ?? null },
    create: {
      email: 'testuser@mctrgit.ac.in',
      fullName: 'Test Seller',
      password: sellerPw,
      role: 'STUDENT_VERIFIED',
      verified: true,
      collegeStudentId: sellerCollegeRecord?.id ?? null,
    },
  });
  console.log(`  ✓ Seller: ${seller.email} (${seller.id})`);

  const buyerCollegeRecord = await prisma.collegeStudent.findUnique({
    where: { officialEmail: 'buyer@mctrgit.ac.in' },
  });
  const buyerPw = await argon2.hash('Buyer@1234');
  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@mctrgit.ac.in' },
    update: { verified: true, collegeStudentId: buyerCollegeRecord?.id ?? null },
    create: {
      email: 'buyer@mctrgit.ac.in',
      fullName: 'Buyer Student',
      password: buyerPw,
      role: 'STUDENT_VERIFIED',
      verified: true,
      collegeStudentId: buyerCollegeRecord?.id ?? null,
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
