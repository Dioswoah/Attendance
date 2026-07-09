import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"

// Read path for day-level validation marks (stored on AttendanceSummary, keyed user+day).
// Returns only marked days in the range; the matrices merge these by `${userId}_${date}`.
export async function GET(req: Request) {
    try {
        const session = await auth()
        const roles = (session?.user as any)?.roles || []
        if (!session?.user?.id || (!roles.includes('MANAGER') && !roles.includes('ADMIN') && !roles.includes('VIEWER'))) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')
        if (!startDate || !endDate) {
            return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 })
        }

        const rangeStart = new Date(`${startDate.split('T')[0]}T00:00:00Z`)
        const rangeEnd = new Date(`${endDate.split('T')[0]}T00:00:00Z`)
        rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1)

        const marks = await prisma.attendanceSummary.findMany({
            where: {
                date: { gte: rangeStart, lt: rangeEnd },
                validationStatus: { not: null }
            },
            select: { userId: true, date: true, validationStatus: true, validatedAt: true }
        })

        return NextResponse.json(marks.map(m => ({
            userId: m.userId,
            date: m.date.toISOString().split('T')[0],
            validationStatus: m.validationStatus,
            validatedAt: m.validatedAt?.toISOString() || null
        })))
    } catch (error) {
        console.error("GET validations error:", error)
        return NextResponse.json({ error: "Failed to fetch validations" }, { status: 500 })
    }
}
