import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const attendanceCount = await prisma.attendance.count()
    const requestCount = await prisma.attendanceRequest.count()
    const leaveCount = await prisma.leave.count()
    const userCount = await prisma.user.count()

    console.log({
        attendanceCount,
        requestCount,
        leaveCount,
        userCount
    })

    if (attendanceCount > 0) {
        const latestAttendance = await prisma.attendance.findMany({
            take: 5,
            orderBy: { date: 'desc' },
            include: { breaks: true }
        })
        console.log('Latest Attendance:', JSON.stringify(latestAttendance, null, 2))
    }
}

main().finally(() => prisma.$disconnect())
