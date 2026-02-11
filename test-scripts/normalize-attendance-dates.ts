/**
 * Database Cleanup Script
 * 
 * This script normalizes all existing attendance record dates to midnight UTC.
 * Run this once to fix any records created before the date normalization fix.
 * 
 * Usage: npx ts-node scripts/normalize-attendance-dates.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function normalizeAttendanceDates() {
    console.log('Starting attendance date normalization...')

    try {
        // Fetch all attendance records
        const records = await prisma.attendance.findMany({
            select: {
                id: true,
                date: true,
                clockIn: true
            }
        })

        console.log(`Found ${records.length} attendance records to process`)

        let updated = 0
        let skipped = 0

        for (const record of records) {
            // Normalize the date to midnight UTC
            const clockInDate = new Date(record.clockIn || record.date)
            const normalizedDate = new Date(Date.UTC(
                clockInDate.getFullYear(),
                clockInDate.getMonth(),
                clockInDate.getDate(),
                0, 0, 0, 0
            ))

            // Only update if the date is different
            if (record.date.getTime() !== normalizedDate.getTime()) {
                try {
                    await prisma.attendance.update({
                        where: { id: record.id },
                        data: { date: normalizedDate }
                    })
                    updated++
                    console.log(`✓ Updated record ${record.id}`)
                } catch (error: any) {
                    // Handle unique constraint violations
                    if (error.code === 'P2002') {
                        console.log(`⚠ Skipping record ${record.id} - duplicate would be created`)
                        skipped++
                    } else {
                        throw error
                    }
                }
            }
        }

        console.log('\n=== Summary ===')
        console.log(`Total records: ${records.length}`)
        console.log(`Updated: ${updated}`)
        console.log(`Skipped (duplicates): ${skipped}`)
        console.log(`Already normalized: ${records.length - updated - skipped}`)
        console.log('\nDate normalization complete!')

    } catch (error) {
        console.error('Error normalizing dates:', error)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

normalizeAttendanceDates()
    .catch((error) => {
        console.error('Fatal error:', error)
        process.exit(1)
    })
