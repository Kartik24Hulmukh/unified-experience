import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Drop old partial unique index
  await prisma.$executeRaw(
    Prisma.sql`DROP INDEX IF EXISTS "uq_requests_active_per_buyer"`
  );
  console.log('Dropped old index');

  // Create new partial unique index including CANCELLED and WITHDRAWN
  await prisma.$executeRaw(
    Prisma.sql`
      CREATE UNIQUE INDEX "uq_requests_active_per_buyer"
        ON "requests" ("listing_id", "buyer_id")
        WHERE "status" NOT IN ('COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'WITHDRAWN')
    `
  );
  console.log('Created new partial unique index with CANCELLED + WITHDRAWN excluded');

  // Verify
  const result = await prisma.$queryRaw<Array<{ indexdef: string }>>(
    Prisma.sql`SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_requests_active_per_buyer'`
  );
  console.log('Verified:', result[0]?.indexdef);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
