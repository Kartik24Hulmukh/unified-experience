import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const hash = await argon2.hash('password123');
  const user = await prisma.user.upsert({
    where: { email: 'testseller@mctrgit.ac.in' },
    update: { password: hash, verified: true, role: 'STUDENT_VERIFIED' },
    create: {
      email: 'testseller@mctrgit.ac.in',
      fullName: 'Test Seller',
      password: hash,
      verified: true,
      role: 'STUDENT_VERIFIED'
    }
  });
  console.log('User created:', user.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
