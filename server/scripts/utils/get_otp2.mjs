import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, password: true, verified: true, otps: true }
  });
  console.log(JSON.stringify(users, null, 2));
}
main().then(() => process.exit(0)).catch(console.error);