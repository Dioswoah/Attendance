import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { broadcastUpdate } from "@/lib/eventBus"
import { updateAttendanceSummary } from "@/lib/db-utils"

// Sets the manager-review validation status for one user+day.
//
// Validation is day-level review metadata, so it lives on AttendanceSummary (unique per
// user+day) — NEVER on raw Attendance rows. An Attendance row's open/closed shape doubles
// as live clocked-in state across the whole app (`clockOut IS NULL` = "on the clock"), so
// the previous implementation, which created placeholder Attendance rows to hang the status
// on, made validated absent-days read as permanently-active sessions and blocked real
// clock-ins. Writing to the summary table cannot touch live attendance behavior.
export async function POST(req: Request) {
    try {
        const session = await auth()
        const roles = (session?.user as any)?.roles || []
        if (!session?.user?.id || (!roles.includes('MANAGER') && !roles.includes('ADMIN'))) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 })
        }

        const { userId, date, status } = await req.json()
        if (!userId || !date) {
            return NextResponse.json({ error: "userId and date are required" }, { status: 400 })
        }
        if (status !== 'VALIDATED' && status !== 'NEEDS_CORRECTION' && status !== null) {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 })
        }

        const targetDate = new Date(`${date}T00:00:00Z`)

        const summary = await prisma.attendanceSummary.upsert({
            where: { userId_date: { userId, date: targetDate } },
            create: {
                userId,
                date: targetDate,
                status: 'ABSENT',
                validationStatus: status,
                validatedAt: status ? new Date() : null
            },
            update: {
                validationStatus: status,
                validatedAt: status ? new Date() : null
            }
        })

        // If we just created the summary shell, let the normal aggregation fill in the real
        // day status (LEAVE vs ABSENT, durations). It never touches validationStatus.
        updateAttendanceSummary(userId, targetDate).catch(e => console.error('[validate-day] Summary refresh failed:', e))

        broadcastUpdate('validation', { userId, date, status })

        return NextResponse.json({ userId, date, validationStatus: summary.validationStatus, validatedAt: summary.validatedAt })
    } catch (error) {
        console.error("POST validate-day error:", error)
        return NextResponse.json({ error: "Failed to update validation status" }, { status: 500 })
    }
}
