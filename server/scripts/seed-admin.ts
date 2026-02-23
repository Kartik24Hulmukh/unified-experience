import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  // 1. Create admin user
  const adminPw = await argon2.hash('Admin@1234');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mctrgit.ac.in' },
    update: { role: 'ADMIN' },
    create: {
      email: 'admin@mctrgit.ac.in',
      fullName: 'Admin BErozgar',
      password: adminPw,
      role: 'ADMIN',
      verified: true,
    },
  });
  console.log('ADMIN:', JSON.stringify({ id: admin.id, email: admin.email, role: admin.role }));

  // 2. Create buyer user
  const buyerPw = await argon2.hash('Buyer@1234');
  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@mctrgit.ac.in' },
    update: {},
    create: {
      email: 'buyer@mctrgit.ac.in',
      fullName: 'Buyer Student',
      password: buyerPw,
      role: 'STUDENT',
      verified: true,
    },
  });
  console.log('BUYER:', JSON.stringify({ id: buyer.id, email: buyer.email, role: buyer.role }));

  // 3. Verify existing seller
  const seller = await prisma.user.findUnique({
    where: { email: 'testuser@mctrgit.ac.in' },
    select: { id: true, email: true, role: true, completedExchanges: true },
  });
  console.log('SELLER:', JSON.stringify(seller));

  // 4. Verify listing
  const listing = await prisma.listing.findFirst({
    where: { ownerId: seller?.id },
    select: { id: true, title: true, status: true },
  });
  console.log('LISTING:', JSON.stringify(listing));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
