import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { broadcastUpdate } from "@/lib/eventBus"
import { eachDayOfInterval, format } from "date-fns"

// Batched validation: applies one status across many staff x dates in a single request.
//
// Validation lives on AttendanceSummary (day-level, unique per user+day) — NEVER on raw
// Attendance rows, whose open/closed shape doubles as live clocked-in state. The previous
// version created placeholder Attendance rows for empty days, which the rest of the app
// read as permanently-open sessions: it blocked staff clock-ins ("You are already clocked
// in") and misdirected their End Break/Clock Out actions onto the wrong day. Summary rows
// carry no live state, and the unique(userId, date) constraint + skipDuplicates also
// removes the duplicate-row race the Attendance table allowed.
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

        const existingSummaries = await prisma.attendanceSummary.findMany({
            where: { userId: { in: staffIds }, date: { gte: rangeStart, lt: rangeEnd } },
            select: { id: true, userId: true, date: true }
        })

        let updatedCount = 0
        if (existingSummaries.length > 0) {
            const result = await prisma.attendanceSummary.updateMany({
                where: { id: { in: existingSummaries.map(s => s.id) } },
                data: { validationStatus: status, validatedAt: status ? new Date() : null }
            })
            updatedCount = result.count
        }

        // Clearing a day with no summary is a no-op — only fill in missing days when setting a status.
        let createdCount = 0
        if (status !== null) {
            const existingKeys = new Set(existingSummaries.map(s => `${s.userId}_${s.date.toISOString().split('T')[0]}`))
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
                        validationStatus: status,
                        validatedAt: new Date()
                    })
                }
            }

            if (rowsToCreate.length > 0) {
                const result = await prisma.attendanceSummary.createMany({ data: rowsToCreate, skipDuplicates: true })
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
