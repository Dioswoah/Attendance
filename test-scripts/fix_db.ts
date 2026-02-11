
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Attempting to drop unique constraint...")
    try {
        await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "Attendance_userId_date_key";`)
        console.log("Successfully dropped 'Attendance_userId_date_key'")
    } catch (e) {
        console.error("Error dropping key:", e)
    }

    try {
        await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "Attendance_userId_date_idx";`) // Drop index too to be clean
        console.log("Dropped idx")
    } catch (e) { }

    // Re-create non-unique index
    try {
        await prisma.$executeRawUnsafe(`CREATE INDEX "Attendance_userId_date_idx" ON "Attendance"("userId", "date");`)
        console.log("Created non-unique index")
    } catch (e) {
        console.error("Error creating index:", e)
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
