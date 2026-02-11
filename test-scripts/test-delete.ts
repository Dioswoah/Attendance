
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testDelete() {
    console.log('Starting delete test...')

    try {
        // 1. Create a dummy user if needed (or find one)
        let user = await prisma.user.findFirst()
        if (!user) {
            console.log('No user found, creating dummy user...')
            user = await prisma.user.create({
                data: {
                    email: 'test-delete@example.com',
                    name: 'Delete Test User'
                }
            })
        }
        console.log('Using user:', user.id)

        // 2. Create a dummy attendance record
        const attendance = await prisma.attendance.create({
            data: {
                userId: user.id,
                date: new Date(),
                clockIn: new Date(),
                status: 'PRESENT',
                mode: 'OFFICE'
            }
        })
        console.log('Created dummy attendance record:', attendance.id)

        // 2b. Create a dummy break record to test cascade
        await prisma.break.create({
            data: {
                attendanceId: attendance.id,
                startTime: new Date()
            }
        })
        console.log('Created dummy break record')

        // 3. Try to delete it
        console.log('Attempting to delete record with break...')
        await prisma.attendance.delete({
            where: { id: attendance.id }
        })
        console.log('Successfully deleted record with break!')

    } catch (error: any) {
        console.error('Delete failed!')
        console.error('Error code:', error.code)
        console.error('Error message:', error.message)
        console.error('Full error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

testDelete()
