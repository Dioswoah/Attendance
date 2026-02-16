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
        // Fetch everything in one big parallel jump
        const [
            user,
            myAttendance,
            allAttendanceToday,
            myLeaves,
            myAttendanceRequests,
            employees
        ] = await Promise.all([
            // 1. Profile
            prisma.user.findUnique({
                where: { id: userId },
                include: {
                    manager: { select: { id: true, name: true, email: true } },
                    department: true
                }
            }),
            // 2. My Recent Attendance (limit to 20 for history)
            prisma.attendance.findMany({
                where: { userId, deletedAt: null },
                include: { breaks: true },
                orderBy: { clockIn: 'desc' },
                take: 20
            }),
            // 3. All Attendance for today (Staff Table)
            prisma.attendance.findMany({
                where: {
                    date: { gte: safetyStart },
                    deletedAt: null
                },
                include: { breaks: true },
                orderBy: { clockIn: 'desc' }
            }),
            // 4. My Leave Requests 
            prisma.leave.findMany({
                where: { userId, isArchived: false, deletedAt: null },
                orderBy: { createdAt: 'desc' }
            }),
            // 5. My Attendance Requests
            prisma.attendanceRequest.findMany({
                where: { userId, status: 'PENDING', deletedAt: null },
                orderBy: { createdAt: 'desc' }
            }),
            // 6. Employees List (Staff Table)
            prisma.user.findMany({
                where: { isArchived: false, deletedAt: null },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    departmentId: true,
                    department: { select: { id: true, name: true } },
                    availabilityStatus: true,
                    customStatusMessage: true,
                    location: true
                },
                orderBy: { name: 'asc' }
            })
        ])

        // Transform records to include UI-friendly status strings (matching /api/attendance)
        const transformRecord = (a: any) => ({
            ...a,
            status: a.clockOut ? 'clocked-out' : (a.breakStart && !a.breakEnd ? 'on-break' : 'clocked-in'),
            // Ensure dates are stringified if they are Date objects (Prisma returns Dates)
            clockIn: a.clockIn?.toISOString(),
            clockOut: a.clockOut?.toISOString(),
            breakStart: a.breakStart?.toISOString(),
            breakEnd: a.breakEnd?.toISOString(),
            date: a.date instanceof Date ? a.date.toISOString().split('T')[0] : a.date
        })

        return NextResponse.json({
            user,
            attendance: {
                mine: myAttendance.map(transformRecord),
                allToday: allAttendanceToday.map(transformRecord)
            },
            leaves: myLeaves,
            attendanceRequests: myAttendanceRequests,
            staff: employees
        })

    } catch (error) {
        console.error("Dashboard Quick Load Error:", error)
        return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
    }
}
