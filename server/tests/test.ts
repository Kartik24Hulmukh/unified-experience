import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();
async function run() {
  try {
    const res = await prisma.listing.findMany({
      where: { module: 'mess', owner: { role: { not: 'PUBLIC_USER' } } }
    });
    fs.writeFileSync('prisma_err.txt', JSON.stringify(res, null, 2));
  } catch(e) {
    fs.writeFileSync('prisma_err.txt', String(e.stack || e));
  } finally {
    await prisma.$disconnect();
  }
}
run();
