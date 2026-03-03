const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.time('findUsersWithAttendanceTake1');
    const users = await prisma.user.findMany({
        where: { isArchived: false, deletedAt: null },
        select: {
            id: true,
            attendance: { take: 1, orderBy: { clockIn: 'desc' }, select: { clockIn: true, mode: true, locationDetails: true } }
        }
    });
    console.timeEnd('findUsersWithAttendanceTake1');

    console.time('RawQuery');
    const raw = await prisma.$queryRaw`SELECT DISTINCT ON ("userId") "userId", "clockIn", "mode", "locationDetails" FROM "Attendance" WHERE "deletedAt" IS NULL ORDER BY "userId", "clockIn" DESC`;
    console.timeEnd('RawQuery');

}
main().catch(console.error).finally(() => prisma.$disconnect());
