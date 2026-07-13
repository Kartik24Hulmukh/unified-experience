import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.FORCE_PURGE !== 'true') {
    console.error('❌ PURGE ABORTED: Refusing to run in production mode.');
    process.exit(1);
  }

  console.log('🧹 Initializing Test Data Purge...');

  // 1. Identify listings to be deleted
  const testListings = await prisma.listing.findMany({
    where: {
      OR: [
        { title: { startsWith: 'TEST ' } },
        { title: { contains: '177' } },
        { description: { startsWith: 'TEST ' } },
        { description: { contains: '177' } },
      ],
    },
    select: { id: true },
  });
  const listingIds = testListings.map((l) => l.id);

  // 2. Identify users to be deleted (TEST % and %177% in name or email)
  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { fullName: { startsWith: 'TEST ' } },
        { fullName: { contains: '177' } },
        { email: { startsWith: 'TEST ' } },
        { email: { contains: '177' } },
        { email: { startsWith: 'testuser' } },
        { email: { startsWith: 'buyer' } },
      ],
    },
    select: { id: true, email: true },
  });
  const userIds = testUsers.map((u) => u.id);

  console.log(`📊 Found ${listingIds.length} listings and ${userIds.length} users to purge.`);

  // 3. Delete dependent Disputes (references listings or requests or test users)
  const deletedDisputes = await prisma.dispute.deleteMany({
    where: {
      OR: [
        { listingId: { in: listingIds } },
        { raisedById: { in: userIds } },
        { againstId: { in: userIds } },
      ],
    },
  });
  console.log(`✓ Deleted ${deletedDisputes.count} disputes.`);

  // 4. Delete dependent Requests (references listings or test users)
  const deletedRequests = await prisma.request.deleteMany({
    where: {
      OR: [
        { listingId: { in: listingIds } },
        { buyerId: { in: userIds } },
        { sellerId: { in: userIds } },
      ],
    },
  });
  console.log(`✓ Deleted ${deletedRequests.count} requests.`);

  // 5. Delete Listings (cascades to ListingImages)
  const deletedListings = await prisma.listing.deleteMany({
    where: { id: { in: listingIds } },
  });
  console.log(`✓ Deleted ${deletedListings.count} listings.`);

  // 6. Delete test users (cascades to refresh tokens and OTPs)
  const deletedUsers = await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });
  console.log(`✓ Deleted ${deletedUsers.count} users.`);

  // 7. Clean up matching CollegeStudent records
  const deletedStudents = await prisma.collegeStudent.deleteMany({
    where: {
      OR: [
        { name: { startsWith: 'TEST ' } },
        { name: { contains: '177' } },
        { officialEmail: { startsWith: 'TEST ' } },
        { officialEmail: { contains: '177' } },
        { officialEmail: { startsWith: 'testuser' } },
        { officialEmail: { startsWith: 'buyer' } },
      ],
    },
  });
  console.log(`✓ Deleted ${deletedStudents.count} student registry records.`);

  console.log('✅ Purge complete.');
}

main()
  .catch((e) => {
    console.error('❌ Purge failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
