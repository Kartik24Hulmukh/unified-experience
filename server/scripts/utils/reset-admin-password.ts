import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function resetPassword() {
  try {
    const email = 'kartikhulmukh24@gmail.com';
    const newPassword = 'Kartik24@';
    
    console.log(`Looking up user: ${email}`);
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.log(`User ${email} not found!`);
      // Optionally create the user if it doesn't exist
      console.log('Creating the user as an Admin...');
      const hashedPassword = await argon2.hash(newPassword);
      await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role: 'ADMIN',
          failedLoginAttempts: 0,
          lockedUntil: null,
          firstName: 'Admin',
          lastName: 'User'
        }
      });
      console.log('Admin user created successfully.');
      return;
    }

    console.log(`User found. Hashing new password...`);
    const hashedPassword = await argon2.hash(newPassword);

    console.log(`Updating password in database...`);
    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });

    console.log(`Password for ${email} successfully reset to ${newPassword}`);
  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
