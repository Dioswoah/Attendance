
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Connecting to database...');
        // Query raw directly to see what the database actually returns
        const result = await prisma.$queryRaw`SELECT * FROM "User" LIMIT 1`;

        if (result.length > 0) {
            console.log('--- User Record Columns ---');
            console.log(Object.keys(result[0]));

            const hasZone = Object.keys(result[0]).includes('useCurrentTimezone');
            console.log(`Has useCurrentTimezone: ${hasZone}`);
        } else {
            console.log('No users found, checking schema directly.');
            const schema = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'useCurrentTimezone';
      `;
            console.log('Schema check:', schema);
        }
    } catch (e) {
        console.error('Error querying database:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
