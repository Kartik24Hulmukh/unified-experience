import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, password: true, verified: true, verificationToken: true }
  });
  console.log(users.map(u => `${u.email} -> ${u.verified} [${u.verificationToken}]`).join('\n'));
}
main().then(() => process.exit(0)).catch(console.error);