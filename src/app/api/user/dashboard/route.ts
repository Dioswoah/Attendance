import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { updateAttendanceSummary } from '@/lib/db-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const now = new Date()

    // NSW Timezone handling logic (approximate for today start)
    // We use Manila as default for "today" calculation if not specified, 
    // but the component will refine it.
    const startOfToday = new Date()
    startOfToday.setUTCHours(0, 0, 0, 0)

    // Adjust start of today to be safe for multiple timezones (e.g. go back 24h)
    const safetyStart = new Date(startOfToday)
    safetyStart.setUTCDate(safetyStart.getUTCDate() - 1)

    try {
        // Fetch only core/personal data for immediate dashboard load
        const [
            user,
            rawMyAttendance,
            myLeaves,
            myAttendanceRequests
        ] = await Promise.all([
            // 1. Profile
            prisma.user.findUnique({
                where: { id: userId },
                include: {
                    manager: { select: { id: true, name: true, email: true } },
                    department: true,
                    managedDepartments: true,
                    secondaryDepartments: { select: { id: true, name: true } }
                }
            }),
            // 2. My Recent Attendance (limit to 20 for history)
            prisma.attendanceSummary.findMany({
                where: { userId },
                include: {
                    rawRecords: {
                        where: { deletedAt: null },
                        include: { breaks: { where: { deletedAt: null } } },
                        orderBy: { clockIn: 'asc' }
                    }
                },
                orderBy: { date: 'desc' },
                take: 20
            }),
            // 3. My Leave Requests 
            prisma.leave.findMany({
                where: { userId, isArchived: false, deletedAt: null },
                orderBy: { createdAt: 'desc' }
            }),
            // 4. My Attendance Requests
            prisma.attendanceRequest.findMany({
                where: { userId, status: 'PENDING', deletedAt: null },
                orderBy: { createdAt: 'desc' }
            })
        ])

        // Self-heal: if any recent attendance records have no summaryId, the fire-and-forget
        // updateAttendanceSummary call on clock-in/out failed silently. Repair them now so the
        // dashboard can find them via the summary → rawRecords path. We check the last 7 days
        // and cover both active sessions (clockOut: null) and completed ones (clockOut set) so
        // that auto-clocked-out records are not silently lost from the user portal.
        let myAttendance = rawMyAttendance
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const orphanedRecords = await prisma.attendance.findMany({
            where: { userId, deletedAt: null, summaryId: null, clockIn: { gte: sevenDaysAgo } },
            select: { id: true, date: true, clockIn: true, clockOut: true }
        })
        if (orphanedRecords.length > 0) {
            // Auto-close any orphaned sessions that are still "open" (clockOut: null) but are from
            // a previous day — cleanupOldSessions handles these normally via /api/attendance GET,
            // but the user portal doesn't hit that route. Without closing them they'd appear as
            // today's active session and show wrong buttons.
            const staleCutoff = new Date(now.getTime() - 36 * 60 * 60 * 1000)
            const staleOpen = orphanedRecords.filter((r: any) => !r.clockOut && r.clockIn && new Date(r.clockIn) < staleCutoff)
            if (staleOpen.length > 0) {
                await Promise.all(staleOpen.map(async (r: any) => {
                    const closeAt = new Date(Math.min(
                        new Date(r.clockIn).getTime() + 9 * 60 * 60 * 1000,
                        now.getTime()
                    ))
                    await prisma.attendance.update({ where: { id: r.id }, data: { clockOut: closeAt } })
                    await prisma.break.updateMany({ where: { attendanceId: r.id, endTime: null, deletedAt: null }, data: { endTime: closeAt } })
                }))
            }

            const uniqueDates = [...new Set(orphanedRecords.map((r: any) => r.date.toISOString().split('T')[0]))]
            await Promise.all(uniqueDates.map((dateStr: string) => updateAttendanceSummary(userId, new Date(dateStr))))
            myAttendance = await prisma.attendanceSummary.findMany({
                where: { userId },
                include: {
                    rawRecords: {
                        where: { deletedAt: null },
                        include: { breaks: { where: { deletedAt: null } } },
                        orderBy: { clockIn: 'asc' }
                    }
                },
                orderBy: { date: 'desc' },
                take: 20
            })
        }

        // Transform summary records to include UI-friendly status strings
        const transformMine = (summaryList: any[]) => {
            return summaryList.flatMap((s: any) => {
                if (!s.rawRecords || s.rawRecords.length === 0) return []

                return s.rawRecords.map((raw: any) => {
                    const activeBreak = raw.breaks?.find((b: any) => !b.endTime)
                    return {
                        ...raw,
                        status: raw.clockOut ? 'clocked-out' : (activeBreak ? 'on-break' : 'clocked-in'),
                        clockIn: raw.clockIn?.toISOString(),
                        clockOut: raw.clockOut?.toISOString(),
                        breakStart: activeBreak ? activeBreak.startTime.toISOString() : null,
                        date: raw.date instanceof Date ? raw.date.toISOString().split('T')[0] : raw.date,
                        breaks: raw.breaks?.map((b: any) => ({
                            id: b.id,
                            startTime: b.startTime.toISOString(),
                            endTime: b.endTime?.toISOString(),
                            expectedReturnTime: b.expectedReturnTime?.toISOString(),
                        })) || [],
                        summaryWorkMs: s.totalWorkDuration * 1000,
                        summaryBreakMs: s.totalBreakDuration * 1000,
                        isManualOverride: s.isManualOverride,
                        summaryStatus: s.status
                    }
                })
            }).sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime())
        }

        // Combined pending leave count: Leave (PENDING) + LeaveRequest (PENDING)
        let pendingLeaveCount = myLeaves.filter((l: any) => l.status === 'PENDING' && !l.isArchived).length
        try {
            const lr = (prisma as any).leaveRequest
            if (lr) {
                pendingLeaveCount += await lr.count({ where: { userId, status: 'PENDING', isArchived: false, deletedAt: null } })
            }
        } catch { /* LeaveRequest model may not exist in older migrations */ }

        return NextResponse.json({
            user,
            attendance: {
                mine: transformMine(myAttendance),
                allToday: [] // Staff endpoint handles this now
            },
            leaves: myLeaves,
            attendanceRequests: myAttendanceRequests,
            pendingLeaveCount,
            staff: [], // Staff endpoint handles this now
            teamLeaves: [] // Staff endpoint handles this now
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0'
            }
        })

    } catch (error) {
        console.error("Dashboard Quick Load Error:", error)
        return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
    }
}
