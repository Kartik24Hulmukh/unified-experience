import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Database URL configured in Prisma:', process.env.DATABASE_URL || 'Not set in env');
  const listings = await prisma.listing.findMany({ select: { id: true, title: true } });
  console.log('Total:', listings.length, 'Example ID:', listings[0]?.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
