const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const users = await prisma.user.findMany()
    console.log('--- USERS ---')
    console.log(JSON.stringify(users, null, 2))

    const attendance = await prisma.attendance.findMany({
        include: { user: true }
    })
    console.log('--- ATTENDANCE ---')
    console.log(JSON.stringify(attendance, null, 2))
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
