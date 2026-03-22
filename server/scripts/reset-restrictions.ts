import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function clean() {
  await prisma.user.updateMany({
    where: { email: { in: ['testuser@mctrgit.ac.in', 'buyer@mctrgit.ac.in'] } },
    data: { isRestricted: false, adminFlags: 0, cancelledRequests: 0 }
  });
  await prisma.request.deleteMany({});
  await prisma.listing.deleteMany({
    where: { owner: { email: { in: ['testuser@mctrgit.ac.in', 'buyer@mctrgit.ac.in'] } } }
  });
  console.log('Cleaned db state for browser test');
}
clean().finally(() => prisma.$disconnect());
