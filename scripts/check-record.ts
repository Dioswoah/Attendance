
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkRecord() {
    const id = 'cmimldg2f000d8myx6f1ke4ou'
    console.log(`Checking if record ${id} exists...`)

    const record = await prisma.attendance.findUnique({
        where: { id }
    })

    if (record) {
        console.log('Record EXISTS!')
        console.log(record)
    } else {
        console.log('Record NOT FOUND (Deleted successfully)')
    }

    await prisma.$disconnect()
}

checkRecord()
