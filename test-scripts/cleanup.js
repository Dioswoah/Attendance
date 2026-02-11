const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const deleted = await prisma.attendance.deleteMany({
        where: {
            id: 'cmkemjbvz00026p9fw3qc8o6f'
        }
    })
    console.log(`Deleted ${deleted.count} records.`)
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
