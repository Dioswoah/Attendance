import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { broadcastUpdate } from "@/lib/eventBus"

// Validates/flags a day that currently has no Attendance record (e.g. an absence),
// by creating a minimal ABSENT record to attach the validation status to.
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
        const nextDay = new Date(targetDate)
        nextDay.setUTCDate(targetDate.getUTCDate() + 1)

        // A record may already exist (created by another action since the page last loaded) — reuse it instead of duplicating.
        const existing = await prisma.attendance.findFirst({
            where: { userId, date: { gte: targetDate, lt: nextDay }, deletedAt: null }
        })

        const attendance = existing
            ? await prisma.attendance.update({
                where: { id: existing.id },
                data: { validationStatus: status, validatedAt: status ? new Date() : null }
            })
            : await prisma.attendance.create({
                data: {
                    userId,
                    date: targetDate,
                    status: 'ABSENT',
                    mode: 'OFFICE',
                    validationStatus: status,
                    validatedAt: status ? new Date() : null
                }
            })

        broadcastUpdate('attendance', attendance)

        return NextResponse.json(attendance)
    } catch (error) {
        console.error("POST validate-day error:", error)
        return NextResponse.json({ error: "Failed to update validation status" }, { status: 500 })
    }
}
