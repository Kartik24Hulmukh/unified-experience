/**
 * BErozgar — Production Test Data Cleanup Script
 *
 * Safely removes test-generated listings from the production database.
 * Run ONLY after reviewing which records will be deleted.
 *
 * Usage (on production server):
 *   cd /opt/berozgar
 *   docker compose -f docker-compose.prod.yml --env-file .env.production run --rm --no-deps api \
 *     sh -c "npx ts-node --project tsconfig.json scripts/cleanup-test-data.ts"
 *
 * Or for a dry run (preview only, no deletion):
 *   DRY_RUN=true <command above>
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Patterns that match test-generated records
const TEST_TITLE_PATTERNS = [
  /^TEST\s+/i,              // "TEST ACADEMIC RESOURCE 177..."
  /^TEST_/i,                // "TEST_..."
  /\bTEST\s+\w+\s+\d{3,}/i, // "TEST SOMETHING 177..."
  /^FIXTURE_/i,             // fixture data
  /^E2E_/i,                 // end-to-end test data
  /^PLAYWRIGHT_/i,          // playwright test data
  /^SEED_TEST_/i,           // seed test data
];

function isTestRecord(title: string): boolean {
  return TEST_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

async function main() {
  const dryRun = process.env.DRY_RUN === 'true';

  console.log('🔍 BErozgar — Test Data Cleanup');
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will delete)'}`);
  console.log('');

  // Find all listings
  const allListings = await prisma.listing.findMany({
    select: { id: true, title: true, status: true, createdAt: true, ownerId: true },
    orderBy: { createdAt: 'desc' },
  });

  const testListings = allListings.filter((l) => isTestRecord(l.title));
  const realListings = allListings.filter((l) => !isTestRecord(l.title));

  console.log(`📊 Found ${allListings.length} total listings`);
  console.log(`   ✅ Real listings: ${realListings.length}`);
  console.log(`   ❌ Test listings to remove: ${testListings.length}`);
  console.log('');

  if (testListings.length === 0) {
    console.log('✅ No test data found. Production database is clean!');
    return;
  }

  console.log('Test listings to be deleted:');
  for (const listing of testListings) {
    console.log(
      `  [${listing.id}] "${listing.title}" (${listing.status}) — created ${listing.createdAt.toISOString()}`,
    );
  }
  console.log('');

  if (dryRun) {
    console.log('DRY RUN: No changes made. Remove DRY_RUN=true to execute deletion.');
    return;
  }

  // Delete test listings (cascade handles related requests/images)
  const ids = testListings.map((l) => l.id);
  const result = await prisma.listing.deleteMany({ where: { id: { in: ids } } });
  console.log(`✅ Deleted ${result.count} test listings from production.`);

  // Log the cleanup action
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (admin) {
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: 'CLEANUP_TEST_DATA',
        entityType: 'SYSTEM',
        actorRole: 'ADMIN',
        ipAddress: '127.0.0.1',
        metadata: {
          deletedCount: result.count,
          deletedIds: ids,
          timestamp: new Date().toISOString(),
        },
      },
    });
    console.log('✅ Audit log entry created.');
  }

  console.log('');
  const remaining = await prisma.listing.count();
  console.log(`Remaining real listings in production: ${remaining}`);
}

main()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
