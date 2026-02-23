import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>(
    Prisma.sql`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'requests'`
  );
  for (const row of result) {
    console.log(`${row.indexname}: ${row.indexdef}`);
  }

  // Also check constraints
  const constraints = await prisma.$queryRaw<Array<{ conname: string; contype: string; condef: string }>>(
    Prisma.sql`SELECT conname, contype, pg_get_constraintdef(oid) as condef FROM pg_constraint WHERE conrelid = 'requests'::regclass`
  );
  console.log('\nConstraints:');
  for (const c of constraints) {
    console.log(`  ${c.conname} (${c.contype}): ${c.condef}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
