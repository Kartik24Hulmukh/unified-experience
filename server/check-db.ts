
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing connection to:', process.env.DATABASE_URL);
        await prisma.$connect();
        console.log('Connected successfully!');
        const userCount = await prisma.user.count();
        console.log('User count:', userCount);
    } catch (error: any) {
        console.error('Connection failed!');
        console.error('Error Name:', error.name);
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
