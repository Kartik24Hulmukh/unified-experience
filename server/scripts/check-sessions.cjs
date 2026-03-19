const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSessions() {
    try {
        const count = await prisma.refreshToken.count();
        console.log('Total refresh tokens:', count);
        const alive = await prisma.refreshToken.count({ where: { revokedAt: null } });
        console.log('Alive refresh tokens:', alive);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkSessions();
