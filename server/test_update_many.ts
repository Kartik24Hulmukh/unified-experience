import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const listingId = '412176fe-5c13-4057-a877-a720ffed6ee6'; 
  
  const listing = await prisma.listing.findUnique({
    where: { id: listingId }
  });
  console.log('Listing before update:', listing.id, listing.status);

  const [updatedCount] = await Promise.all([
    prisma.listing.updateMany({
      where: {
        id: listingId,
        status: 'APPROVED'
      },
      data: { status: 'INTEREST_RECEIVED' },
    }),
  ]);
  
  console.log('Update result:', updatedCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
