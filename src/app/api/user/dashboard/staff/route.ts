import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const startOfToday = new Date()
    startOfToday.setUTCHours(0, 0, 0, 0)
    const safetyStart = new Date(startOfToday)
    safetyStart.setUTCDate(safetyStart.getUTCDate() - 1)

    try {
        const [
            allAttendanceToday,
            employees,
            teamLeavesApproved,
            latestAttendanceRaw
        ] = await Promise.all([
            // 1. All Attendance for today (Staff Table)
            prisma.attendanceSummary.findMany({
                where: { date: { gte: safetyStart } },
                include: {
                    rawRecords: {
                        where: { deletedAt: null },
                        include: { breaks: true },
                        orderBy: { clockIn: 'asc' }
                    }
                },
                orderBy: { date: 'desc' }
            }),
            // 2. Employees List (Staff Table) - FLAT (No nested attendance)
            prisma.user.findMany({
                where: { isArchived: false, deletedAt: null },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    managerId: true,
                    image: true,
                    departmentId: true,
                    department: { select: { id: true, name: true } },
                    secondaryDepartments: { select: { id: true, name: true } },
                    availabilityStatus: true,
                    customStatusMessage: true,
                    employmentLocation: true,
                    selectedTimezone: true,
                },
                orderBy: { name: 'asc' }
            }),
            // 3. Today's Team Leaves (for status indicator)
            prisma.leave.findMany({
                where: {
                    status: 'APPROVED',
                    endDate: { gte: safetyStart },
                    deletedAt: null
                }
            }),
            // 4. RAW SQL for Latest Attendance (Near Instant)
            prisma.$queryRaw`
                SELECT DISTINCT ON ("userId") "userId", "clockIn", "mode", "locationDetails" 
                FROM "Attendance" 
                WHERE "deletedAt" IS NULL 
                ORDER BY "userId", "clockIn" DESC
            `
        ])

        // Safely transform from Summary back to granular records so frontend feeds/timers don't break
        const transformStaff = (summaryList: any[]) => {
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

        // Map raw SQL to User IDs for instantaneous merging
        const latestAttMap = new Map((latestAttendanceRaw as any[]).map(r => [r.userId, r]))

        const detailedEmployees = employees.map((emp: any) => {
            const raw = latestAttMap.get(emp.id);
            let lastAttendance = null;
            if (raw) {
                lastAttendance = {
                    clockIn: raw.clockIn ? raw.clockIn.toISOString() : null,
                    mode: raw.mode,
                    locationDetails: raw.locationDetails
                }
            }
            return {
                ...emp,
                lastAttendance
            }
        })

        return NextResponse.json({
            allToday: transformStaff(allAttendanceToday),
            staff: detailedEmployees,
            teamLeaves: teamLeavesApproved
        })

    } catch (error) {
        console.error("Dashboard Staff Fetch Error:", error)
        return NextResponse.json({ error: 'Failed to load staff data' }, { status: 500 })
    }
}
