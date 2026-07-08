import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { broadcastUpdate } from "@/lib/eventBus"
import { eachDayOfInterval, format } from "date-fns"

// Batched version of validate/validate-day: applies one validation status across many
// staff x dates in a single request instead of one HTTP round-trip per record. Firing
// dozens/hundreds of individual requests (the old approach) competes with regular
// clock-in/out traffic for the same Cloud Run instances and shared Cloud SQL connection
// pool, which can stall unrelated requests long enough to trip client-side timeouts.
export async function POST(req: Request) {
    try {
        const session = await auth()
        const roles = (session?.user as any)?.roles || []
        if (!session?.user?.id || (!roles.includes('MANAGER') && !roles.includes('ADMIN'))) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 })
        }

        const { staffIds, startDate, endDate, status } = await req.json()
        if (!Array.isArray(staffIds) || staffIds.length === 0 || !startDate || !endDate) {
            return NextResponse.json({ error: "staffIds, startDate and endDate are required" }, { status: 400 })
        }
        if (status !== 'VALIDATED' && status !== 'NEEDS_CORRECTION' && status !== null) {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 })
        }

        const rangeStart = new Date(`${startDate}T00:00:00Z`)
        const rangeEnd = new Date(`${endDate}T00:00:00Z`)
        rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1)

        const existingRecords = await prisma.attendance.findMany({
            where: { userId: { in: staffIds }, date: { gte: rangeStart, lt: rangeEnd }, deletedAt: null },
            select: { id: true, userId: true, date: true }
        })

        let updatedCount = 0
        if (existingRecords.length > 0) {
            const result = await prisma.attendance.updateMany({
                where: { id: { in: existingRecords.map(r => r.id) } },
                data: { validationStatus: status, validatedAt: status ? new Date() : null }
            })
            updatedCount = result.count
        }

        // Clearing a day with no record is a no-op — only fill in missing days when setting a status.
        let createdCount = 0
        if (status !== null) {
            const existingKeys = new Set(existingRecords.map(r => `${r.userId}_${r.date.toISOString().split('T')[0]}`))
            const days = eachDayOfInterval({ start: rangeStart, end: new Date(rangeEnd.getTime() - 1) })
                .map(d => format(d, 'yyyy-MM-dd'))

            const rowsToCreate: any[] = []
            for (const userId of staffIds) {
                for (const dateStr of days) {
                    if (existingKeys.has(`${userId}_${dateStr}`)) continue
                    rowsToCreate.push({
                        userId,
                        date: new Date(`${dateStr}T00:00:00Z`),
                        status: 'ABSENT',
                        mode: 'OFFICE',
                        validationStatus: status,
                        validatedAt: new Date()
                    })
                }
            }

            if (rowsToCreate.length > 0) {
                const result = await prisma.attendance.createMany({ data: rowsToCreate })
                createdCount = result.count
            }
        }

        broadcastUpdate('validation', { staffIds, startDate, endDate, status })

        return NextResponse.json({ updated: updatedCount, created: createdCount })
    } catch (error) {
        console.error("POST validate-bulk error:", error)
        return NextResponse.json({ error: "Failed to update validation status" }, { status: 500 })
    }
}
