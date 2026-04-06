import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'buyer@mctrgit.ac.in' },
    select: { id: true, email: true, isRestricted: true, role: true }
  });
  console.log('User status:', JSON.stringify(user, null, 2));
  
  const listings = await prisma.listing.findMany({
    where: { module: 'resale', status: 'APPROVED' },
    select: { id: true, title: true, ownerId: true }
  });
  console.log('Approved Resale Listings:', JSON.stringify(listings, null, 2));
}

main().finally(() => prisma.$disconnect());
