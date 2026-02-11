
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Adding useCurrentTimezone...');
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "useCurrentTimezone" BOOLEAN NOT NULL DEFAULT true;`);

        console.log('Adding selectedTimezone...');
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "selectedTimezone" TEXT DEFAULT 'UTC';`);

        console.log('Adding customStatusMessage...');
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "customStatusMessage" TEXT;`);

        console.log('Schema update complete.');
    } catch (e) {
        console.error('Error updating schema:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
