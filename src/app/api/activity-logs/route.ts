import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"

export async function GET(req: Request) {
    const session = await auth() as any
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const isAdmin = session.user.roles?.includes('ADMIN') || false
    const userIdInQuery = searchParams.get('userId')

    // If not admin, you can only see YOUR logs
    const userId = isAdmin ? userIdInQuery : session.user.id
    const action = searchParams.get('action')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    try {
        const [logs, total] = await Promise.all([
            prisma.activityLog.findMany({
                where: {
                    ...(userId && { userId }),
                    ...(action && { action })
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            image: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset
            }),
            prisma.activityLog.count({
                where: {
                    ...(userId && { userId }),
                    ...(action && { action })
                }
            })
        ])

        // For AUTO_CLOCK_OUT entries, attach the attendance record's clockOut time.
        // This is the authoritative shift-end time and correctly handles old log entries
        // that were created before details.time was stored.
        const autoClockOutIds = logs
            .filter(l => l.action === 'AUTO_CLOCK_OUT' && l.entityId)
            .map(l => l.entityId as string)

        const clockOutMap = new Map<string, string | null>()
        if (autoClockOutIds.length > 0) {
            const attendanceRecords = await prisma.attendance.findMany({
                where: { id: { in: autoClockOutIds } },
                select: { id: true, clockOut: true }
            })
            attendanceRecords.forEach(a => {
                clockOutMap.set(a.id, a.clockOut?.toISOString() ?? null)
            })
        }

        const augmentedLogs = logs.map(log => ({
            ...log,
            ...(log.action === 'AUTO_CLOCK_OUT' && log.entityId
                ? { attendanceClockOut: clockOutMap.get(log.entityId) ?? null }
                : {})
        }))

        return NextResponse.json({ logs: augmentedLogs, total, limit, offset })
    } catch (error) {
        console.error("Fetch logs error:", error)
        return NextResponse.json({ error: "Failed to fetch activity logs" }, { status: 500 })
    }
}
