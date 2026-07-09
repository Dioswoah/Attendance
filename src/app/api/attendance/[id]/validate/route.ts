import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { broadcastUpdate } from "@/lib/eventBus"

// Compatibility shim: older clients validate by Attendance record id. Validation now lives
// on AttendanceSummary (day-level, unique per user+day) — see validate-day/route.ts for why
// it must never write to the Attendance table. This resolves the record to its user+day and
// stores the status there.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const session = await auth()
        const roles = (session?.user as any)?.roles || []
        if (!session?.user?.id || (!roles.includes('MANAGER') && !roles.includes('ADMIN'))) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 })
        }

        const { status } = await req.json()
        if (status !== 'VALIDATED' && status !== 'NEEDS_CORRECTION' && status !== null) {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 })
        }

        const record = await prisma.attendance.findUnique({
            where: { id },
            select: { userId: true, date: true }
        })
        if (!record) {
            return NextResponse.json({ error: "Record not found" }, { status: 404 })
        }

        const day = new Date(record.date)
        day.setUTCHours(0, 0, 0, 0)

        const summary = await prisma.attendanceSummary.upsert({
            where: { userId_date: { userId: record.userId, date: day } },
            create: {
                userId: record.userId,
                date: day,
                status: 'ABSENT',
                validationStatus: status,
                validatedAt: status ? new Date() : null
            },
            update: {
                validationStatus: status,
                validatedAt: status ? new Date() : null
            }
        })

        broadcastUpdate('validation', { userId: record.userId, date: day.toISOString().split('T')[0], status })

        return NextResponse.json({ id, userId: record.userId, validationStatus: summary.validationStatus, validatedAt: summary.validatedAt })
    } catch (error) {
        console.error("PATCH attendance validate error:", error)
        return NextResponse.json({ error: "Failed to update validation status" }, { status: 500 })
    }
}
