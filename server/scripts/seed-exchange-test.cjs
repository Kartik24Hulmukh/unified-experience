const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding exchange test data...');

  // 1. Create/Update Users
  const passwordHash = await argon2.hash('Test@123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const seller = await prisma.user.upsert({
    where: { email: 'seller@mctrgit.ac.in' },
    update: { 
      password: passwordHash, 
      verified: true, 
      role: 'STUDENT_VERIFIED',
      fullName: 'Test Seller'
    },
    create: {
      email: 'seller@mctrgit.ac.in',
      fullName: 'Test Seller',
      password: passwordHash,
      role: 'STUDENT_VERIFIED',
      verified: true,
      trustStatus: 'GOOD_STANDING'
    }
  });

  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@mctrgit.ac.in' },
    update: { 
      password: passwordHash, 
      verified: true, 
      role: 'STUDENT_VERIFIED',
      fullName: 'Test Buyer'
    },
    create: {
      email: 'buyer@mctrgit.ac.in',
      fullName: 'Test Buyer',
      password: passwordHash,
      role: 'STUDENT_VERIFIED',
      verified: true,
      trustStatus: 'GOOD_STANDING'
    }
  });

  // 2. Ensure College Registry Linkage (Required for many actions)
  await prisma.collegeStudent.upsert({
    where: { officialEmail: 'seller@mctrgit.ac.in' },
    update: {},
    create: {
      officialEmail: 'seller@mctrgit.ac.in',
      name: 'Test Seller',
      department: 'Engineering'
    }
  });

  await prisma.collegeStudent.upsert({
    where: { officialEmail: 'buyer@mctrgit.ac.in' },
    update: {},
    create: {
      officialEmail: 'buyer@mctrgit.ac.in',
      name: 'Test Buyer',
      department: 'Science'
    }
  });

  // Update user linkage
  const sellerRegistry = await prisma.collegeStudent.findUnique({ where: { officialEmail: 'seller@mctrgit.ac.in' } });
  const buyerRegistry = await prisma.collegeStudent.findUnique({ where: { officialEmail: 'buyer@mctrgit.ac.in' } });

  await prisma.user.update({ where: { id: seller.id }, data: { collegeStudentId: sellerRegistry.id } });
  await prisma.user.update({ where: { id: buyer.id }, data: { collegeStudentId: buyerRegistry.id } });

  // 3. Create an APPROVED listing for Seller
  const listing = await prisma.listing.upsert({
    where: { id: 'cf253860-995f-462e-a7e8-bb97aa83ec48' },
    update: {
      status: 'APPROVED',
      ownerId: seller.id
    },
    create: {
      id: 'cf253860-995f-462e-a7e8-bb97aa83ec48',
      title: 'Exchange Test Item',
      description: 'Used for automated exchange flow testing.',
      price: 100,
      category: 'BOOKS',
      module: 'TEST',
      status: 'APPROVED',
      ownerId: seller.id
    }
  });

  console.log('Exchange test data seeded successfully.');
  console.log('Seller: seller@mctrgit.ac.in / Test@123');
  console.log('Buyer: buyer@mctrgit.ac.in / Test@123');
  console.log('Listing ID:', listing.id);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
