import { PrismaClient } from '@prisma/client';
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.update({
    where: { email: 'testuser@mctrgit.ac.in' },
    data: {
      isRestricted: false,
      adminFlags: 0,
      trustStatus: 'GOOD_STANDING',
      role: 'STUDENT_VERIFIED'
    }
  });

  const disputes = await prisma.dispute.deleteMany({
    where: { againstId: user.id }
  });

  console.log('User un-restricted successfully');
  console.log(JSON.stringify(user, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
