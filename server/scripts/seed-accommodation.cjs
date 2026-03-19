
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find a user to own the listing
    const user = await prisma.user.findFirst();
    if (!user) {
        console.error("No user found. Please sign up first.");
        return;
    }

    const listing = await prisma.listing.create({
        data: {
            title: "Premium PG near Campus",
            description: "High-end PG accommodation with all modern amenities. Includes high-speed WiFi, 24/7 security, and home-cooked meals. Located just 5 minutes from the main gate.",
            category: "pg",
            module: "accommodation",
            price: 8500,
            status: "APPROVED",
            ownerId: user.id
        }
    });

    console.log("Created listing:", listing.id);
    await prisma.$disconnect();
}

main();
