import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function createBuyer() {
  try {
    const email = 'verified_buyer_test@mctrgit.ac.in';
    const newPassword = 'Password123@';

    console.log(`Creating user: ${email}`);
    const hashedPassword = await argon2.hash(newPassword);
    
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'STUDENT_VERIFIED',
        fullName: 'Verified Test Buyer',
        verified: true,
        trustStatus: 'GOOD_STANDING',
        privilegeLevel: 'STANDARD'
      }
    });

    console.log(`Buyer user created successfully with password ${newPassword}`);
  } catch (error) {
    console.error('Error creating buyer:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createBuyer();
