
import { PrismaClient } from '@prisma/client'


// Limit connection pool to 1 to avoid "Too many connections" error
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL + (process.env.DATABASE_URL?.includes('?') ? '&' : '?') + 'connection_limit=1'
        }
    }
})


async function main() {
    try {
        console.log('Connecting to database...');

        // Check Users
        const userCount = await prisma.user.count();
        console.log(`\nUsers: ${userCount}`);
        if (userCount > 0) {
            const users = await prisma.user.findMany({ take: 3 });
            console.log('Sample Users:');
            users.forEach(u => console.log(` - ${u.name} (${u.email})`));
        }

        // Check Attendance
        const attendanceCount = await prisma.attendance.count();
        console.log(`\nAttendance Records: ${attendanceCount}`);

        // Check Leaves
        const leaveCount = await prisma.leaveRequest.count();
        console.log(`\nLeave Requests: ${leaveCount}`);

        // Check Departments
        const deptCount = await prisma.department.count();
        console.log(`\nDepartments: ${deptCount}`);

    } catch (e: any) {
        console.error('\nERROR connecting to database:', e.message);
        console.error('Ensure that the Cloud SQL Proxy is running and accessible on port 5434 (see .env).');
    } finally {
        await prisma.$disconnect();
    }
}

main();
