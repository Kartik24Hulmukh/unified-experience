
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const listings = await prisma.listing.findMany({
        where: { module: 'accommodation' }
    });
    console.log(JSON.stringify(listings, null, 2));
    await prisma.$disconnect();
}

main();
