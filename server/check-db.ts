
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing connection to:', process.env.DATABASE_URL);
        await prisma.$connect();
        console.log('Connected successfully!');
        const userCount = await prisma.user.count();
        console.log('User count:', userCount);
    } catch (error: unknown) {
        console.error('Connection failed!');
        const err = error as Error & { code?: string };
        console.error('Error Name:', err.name);
        console.error('Error Code:', err.code);
        console.error('Error Message:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
