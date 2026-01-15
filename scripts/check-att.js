const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const attendance = await prisma.attendance.findMany({
        select: {
            id: true,
            userId: true,
            date: true,
            status: true,
            clockIn: true
        }
    })
    console.log('--- ATTENDANCE ---')
    attendance.forEach(a => {
        console.log(`ID: ${a.id}, User: ${a.userId}, Date: ${a.date.toISOString()}, ClockIn: ${a.clockIn?.toISOString()}, Status: ${a.status}`)
    })
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
