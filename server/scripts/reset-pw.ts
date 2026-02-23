import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const pw = await argon2.hash('Seller@1234');
  await prisma.user.update({
    where: { email: 'testuser@mctrgit.ac.in' },
    data: { password: pw },
  });
  console.log('Seller password reset to Seller@1234');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
