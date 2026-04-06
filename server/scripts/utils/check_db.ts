import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const listings = await prisma.listing.findMany({
    include: { owner: { select: { role: true, email: true } } }
  });
  console.log('Listings with Owner Info:', JSON.stringify(listings, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
