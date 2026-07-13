const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Production environment guard
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ SEED ABORTED: Refusing to seed a production database.');
    process.exit(1);
  }

  console.log('Seeding Resale and Skills data...');

  // 1. Get or create a seed user
  let user = await prisma.user.findFirst({
    where: { email: 'seed.user@mctrgit.edu.in' }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'seed.user@mctrgit.edu.in',
        fullName: 'Seed User',
        role: 'STUDENT_VERIFIED',
        verified: true,
      }
    });
    console.log('Created seed user:', user.id);
  } else {
    console.log('Using existing seed user:', user.id);
  }

  // 2. Create a Resale listing
  const resale = await prisma.listing.create({
    data: {
      ownerId: user.id,
      title: 'Engineering Mathematics Textbook',
      description: 'Condition: Like New. Barely used textbook for Semester 1 and 2. Includes all solved examples and previous year papers.',
      price: '450',
      category: 'Books',
      module: 'resale',
      status: 'APPROVED',
    },
  });
  console.log('Created resale listing:', resale.id);

  // 3. Create a Skills listing
  const skill = await prisma.listing.create({
    data: {
      ownerId: user.id,
      title: 'Python Web Development Tutoring',
      description: 'I can help you build Django/Flask apps or help with your assignments. Experienced in building real-world projects.',
      price: '500',
      category: 'Programming',
      module: 'skills',
      status: 'APPROVED',
    },
  });
  console.log('Created skills listing:', skill.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
