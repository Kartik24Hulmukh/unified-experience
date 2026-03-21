import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'testuser@mctrgit.ac.in' }
  });
  console.log(JSON.stringify(user, null, 2));

  const authMe = await prisma.user.findUnique({
    where: { email: 'testuser@mctrgit.ac.in' },
    include: {
        disputesAgainst: true,
    }
  });

  console.log('authMe', JSON.stringify(authMe, null, 2));

}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
