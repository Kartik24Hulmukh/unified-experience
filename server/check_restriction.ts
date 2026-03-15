import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'testuser@mctrgit.ac.in' },
    select: { id: true, email: true, isRestricted: true, role: true }
  });
  console.log('User status:', JSON.stringify(user, null, 2));
}

main();
