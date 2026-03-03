import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

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
            myAttendance,
            myLeaves,
            myAttendanceRequests
        ] = await Promise.all([
            // 1. Profile
            prisma.user.findUnique({
                where: { id: userId },
                include: {
                    manager: { select: { id: true, name: true, email: true } },
                    department: true,
                    managedDepartments: true
                }
            }),
            // 2. My Recent Attendance (limit to 20 for history)
            prisma.attendanceSummary.findMany({
                where: { userId },
                include: {
                    rawRecords: {
                        where: { deletedAt: null },
                        include: { breaks: true },
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

        return NextResponse.json({
            user,
            attendance: {
                mine: transformMine(myAttendance),
                allToday: [] // Staff endpoint handles this now
            },
            leaves: myLeaves,
            attendanceRequests: myAttendanceRequests,
            staff: [], // Staff endpoint handles this now
            teamLeaves: [] // Staff endpoint handles this now
        })

    } catch (error) {
        console.error("Dashboard Quick Load Error:", error)
        return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
    }
}
