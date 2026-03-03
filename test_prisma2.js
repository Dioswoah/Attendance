const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.time('Fast Users Fetch');
    const [users, latestRecords] = await Promise.all([
        prisma.user.findMany({
            where: { isArchived: false, deletedAt: null },
            select: {
                id: true, name: true, email: true, image: true, departmentId: true,
                availabilityStatus: true, employmentLocation: true, selectedTimezone: true,
            }
        }),
        prisma.$queryRaw`SELECT DISTINCT ON ("userId") "userId", "clockIn", "mode", "locationDetails" FROM "Attendance" WHERE "deletedAt" IS NULL ORDER BY "userId", "clockIn" DESC`
    ]);
    console.timeEnd('Fast Users Fetch');

    console.time('Map');
    const lookup = new Map(latestRecords.map(r => [r.userId, r]));
    const detailed = users.map(u => ({
        ...u,
        lastAttendance: lookup.get(u.id) || null
    }));
    console.timeEnd('Map');
}
main().catch(console.error).finally(() => prisma.$disconnect());
