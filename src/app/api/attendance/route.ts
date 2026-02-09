import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from "@/auth"
import { sendAdminActionEmail } from "@/lib/email"
import { broadcastUpdate } from "@/lib/eventBus"
import { syncStatusToCalendar } from "@/lib/calendar"

// NSW Public Holidays 2026
const HOLIDAYS_2026 = [
    '2026-01-01', // New Year's Day
    '2026-01-26', // Australia Day
    '2026-04-03', // Good Friday
    '2026-04-04', // Easter Saturday
    '2026-04-05', // Easter Sunday
    '2026-04-06', // Easter Monday
    '2026-04-25', // Anzac Day
    '2026-06-08', // King's Birthday
    '2026-10-05', // Labour Day
    '2026-12-25', // Christmas Day
    '2026-12-26', // Boxing Day
    '2026-12-28', // Boxing Day Holiday
]

function isWorkingDay(date: Date): boolean {
    const day = date.getDay()
    if (day === 0 || day === 6) return false // Weekend

    const dateStr = date.toISOString().split('T')[0]
    if (HOLIDAYS_2026.includes(dateStr)) return false

    return true
}

function getNextWorkingDay(date: Date): Date {
    const next = new Date(date)
    next.setUTCDate(next.getUTCDate() + 1)

    while (!isWorkingDay(next)) {
        next.setUTCDate(next.getUTCDate() + 1)
    }
    return next
}

/**
 * Helper to get current Date at midnight in Philippine Time (Asia/Manila)
 * but returned as a UTC Date object (00:00:00 UTC) for consistency with DB storage.
 */
function getPHTToday() {
    const now = new Date()
    // valid specific time in Manila
    const phtString = now.toLocaleDateString("en-US", {
        timeZone: "Asia/Manila",
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    // phtString format mm/dd/yyyy due to en-US
    const [month, day, year] = phtString.split('/')
    return new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)))
}


/**
 * Helper to automatically "seal" open sessions from previous days.
 * If someone forgot to clock out or end a break, we close them at 11:59:59 PM of that day.
 */
async function cleanupOldSessions() {
    const cutoff = new Date()
    cutoff.setHours(cutoff.getHours() - 24)

    // Find sessions started more than 24 hours ago that are still open
    const unclosed = await prisma.attendance.findMany({
        where: {
            clockIn: { lt: cutoff },
            clockOut: null
        }
    })

    if (unclosed.length === 0) return

    for (const session of unclosed) {
        // We set the clockOut to the end of that day (23:59:59 UTC relative to that day's start)
        const endDay = new Date(session.date)
        endDay.setUTCHours(23, 59, 59, 999)

        await prisma.attendance.update({
            where: { id: session.id },
            data: {
                clockOut: endDay,
                status: 'PRESENT'
            }
        })

        // Also close any open breaks for this session
        await prisma.break.updateMany({
            where: {
                attendanceId: session.id,
                endTime: null
            },
            data: {
                endTime: endDay
            }
        })
    }
}

/**
 * Data integrity helper: ensure no session has multiple open breaks.
 * This fixes "ghost breaks" that cause inflated break time.
 */
async function cleanupDuplicateBreaks() {
    const today = getPHTToday()
    const sessionsWithOpenBreaks = await prisma.attendance.findMany({
        where: { date: today },
        include: {
            breaks: {
                where: { endTime: null },
                orderBy: { startTime: 'desc' }
            }
        }
    })

    for (const session of sessionsWithOpenBreaks) {
        if (session.breaks.length > 1) {
            // Keep the latest open break (index 0 due to orderby), close the others
            const orphans = session.breaks.slice(1)
            const latest = session.breaks[0]

            await prisma.break.updateMany({
                where: { id: { in: orphans.map(o => o.id) } },
                data: { endTime: latest.startTime }
            })
            console.log(`Cleaned up ${orphans.length} ghost breaks for session ${session.id}`)
        }
    }
}

/**
 * Reset all users' availability status to APPEAR_OFFLINE at the start of each day.
 * This ensures everyone appears offline until they clock in.
 */
async function resetDailyAvailability() {
    try {
        await prisma.user.updateMany({
            where: {
                deletedAt: null,
                isArchived: false
            },
            data: {
                availabilityStatus: 'APPEAR_OFFLINE'
            }
        })
        console.log('Daily availability status reset completed')
    } catch (error) {
        console.error('Failed to reset daily availability:', error)
    }
}

export async function GET(req: Request) {
    try {
        await cleanupOldSessions()
        await cleanupDuplicateBreaks()
        await resetDailyAvailability()
    } catch (e) {
        console.error("Cleanup failed:", e)
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    // Date range support
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const departmentId = searchParams.get('departmentId')
    const managerId = searchParams.get('managerId')

    let whereClause: any = { deletedAt: null }

    if (startDateStr && endDateStr) {
        const start = new Date(startDateStr)
        start.setUTCHours(0, 0, 0, 0)
        const end = new Date(endDateStr)
        end.setUTCHours(23, 59, 59, 999)
        whereClause.date = { gte: start, lte: end }
    } else {
        // Default to today UTC if no range provided
        const dateStr = searchParams.get('date')
        let targetDate: Date

        if (dateStr) {
            targetDate = new Date(dateStr)
            targetDate.setUTCHours(0, 0, 0, 0)
        } else {
            targetDate = getPHTToday()
        }

        const nextDay = new Date(targetDate)
        nextDay.setUTCDate(targetDate.getUTCDate() + 1)
        whereClause.date = { gte: targetDate, lt: nextDay }
    }

    if (userId) whereClause.userId = userId
    if (departmentId && departmentId !== 'all') {
        const dept = await prisma.department.findUnique({ where: { id: departmentId } })
        if (dept) {
            whereClause.user = {
                OR: [
                    { departmentId: departmentId },
                    { department: { name: { equals: dept.name, mode: 'insensitive' } } },
                    { department: { name: dept.name } }
                ]
            }
        } else {
            whereClause.user = { departmentId }
        }
    }
    if (managerId) {
        whereClause.user = { ...whereClause.user, managerId }
    }

    try {
        // Prepare Leave Query
        let leaveWhere: any = { status: 'APPROVED', deletedAt: null }
        if (userId) leaveWhere.userId = userId
        if (departmentId && departmentId !== 'all') {
            const dept = await prisma.department.findUnique({ where: { id: departmentId } })
            if (dept) {
                leaveWhere.user = {
                    OR: [
                        { departmentId: departmentId },
                        { department: { name: { equals: dept.name, mode: 'insensitive' } } },
                        { department: { name: dept.name } }
                    ]
                }
            } else {
                leaveWhere.user = { departmentId }
            }
        }
        if (managerId) leaveWhere.user = { ...leaveWhere.user, managerId }

        // Date logic for Leaves
        if (startDateStr && endDateStr) {
            const start = new Date(startDateStr)
            start.setUTCHours(0, 0, 0, 0)
            const end = new Date(endDateStr)
            end.setUTCHours(23, 59, 59, 999)

            leaveWhere.AND = [
                { startDate: { lte: end } },
                { endDate: { gte: start } }
            ]
        } else {
            // Single date (or default today)
            // Use the same targetDate as attendance query
            const targetDayStart = new Date(whereClause.date.gte)
            const targetDayEnd = new Date(whereClause.date.lt)
            // Adjust to end of day? actually 'lt nextDay' is fine for attendance, 
            // but for leave overlap we want: LeaveStart < NextDay AND LeaveEnd >= TargetDay
            leaveWhere.AND = [
                { startDate: { lt: targetDayEnd } },
                { endDate: { gte: targetDayStart } }
            ]
        }

        const [attendance, leaves, allFutureLeaves] = await Promise.all([
            prisma.attendance.findMany({
                where: whereClause,
                include: {
                    user: {
                        include: {
                            department: true
                        }
                    },
                    breaks: true
                },
                orderBy: { clockIn: 'desc' }
            }),
            prisma.leave.findMany({
                where: leaveWhere,
                include: {
                    user: {
                        include: {
                            department: true
                        }
                    }
                }
            }),
            // Fetch potential future leaves for chaining return dates
            // only if we are in "dashboard" mode (no specific filters that would prevent looking ahead)
            !userId ? prisma.leave.findMany({
                where: {
                    status: 'APPROVED',
                    startDate: { gte: new Date(whereClause.date.gte) } // Start from today onwards
                },
                select: {
                    userId: true,
                    startDate: true,
                    endDate: true
                }
            }) : Promise.resolve([])
        ])

        // Transform Helpers
        const transformRecord = (a: any) => ({
            id: a.id,
            userId: a.userId,
            userName: a.user?.name || 'Unknown',
            userImage: a.user?.image,
            department: a.user?.department?.name || 'Unassigned',
            date: a.date.toISOString().split('T')[0],
            clockIn: a.clockIn?.toISOString(),
            clockOut: a.clockOut?.toISOString(),
            mode: a.mode,
            status: a.clockOut ? 'clocked-out' : (a.breakStart && !a.breakEnd ? 'on-break' : 'clocked-in'),
            breakStart: a.breakStart?.toISOString(),
            breakEnd: a.breakEnd?.toISOString(),
            breaks: a.breaks?.map((b: any) => ({
                id: b.id,
                startTime: b.startTime.toISOString(),
                endTime: b.endTime?.toISOString()
            })) || []
        })

        const transformLeave = (l: any) => {
            // Calculate Return Date if it's a leave record
            // Logic: Start from this leave's end date. Check if there is another leave starting next working day.
            let returnDate = null

            if (!userId && allFutureLeaves.length > 0) {
                let currentEnd = new Date(l.endDate)

                // Chain leaves
                let finding = true
                while (finding) {
                    const nextWorkDay = getNextWorkingDay(currentEnd)
                    const nextWorkDayStr = nextWorkDay.toISOString().split('T')[0]

                    // Find a leave that starts on this next work day
                    const nextLeave = allFutureLeaves.find((fl: any) =>
                        fl.userId === l.userId &&
                        fl.startDate.toISOString().split('T')[0] === nextWorkDayStr
                    )

                    if (nextLeave) {
                        currentEnd = new Date(nextLeave.endDate)
                    } else {
                        returnDate = nextWorkDay
                        finding = false
                    }
                }
            }

            return {
                id: l.id,
                userId: l.userId,
                userName: l.user?.name || 'Unknown',
                userImage: l.user?.image,
                department: l.user?.department?.name || 'Unassigned',
                date: l.startDate.toISOString().split('T')[0],
                clockIn: null, clockOut: null,
                mode: 'LEAVE',
                status: 'on-leave',
                breakStart: null, breakEnd: null,
                returnDate: returnDate ? returnDate.toISOString() : null
            }
        }

        let transformed: any[] = []

        if (userId) {
            // User Portal: Return ALL records to support history and cumulative calc
            const att = attendance.map(transformRecord)
            const lvs = leaves.map(transformLeave)
            transformed = [...att, ...lvs]

            // Sort by latest activity (clockIn or leave start)
            transformed.sort((a, b) => {
                const dateA = a.clockIn ? new Date(a.clockIn).getTime() : new Date(a.date).getTime()
                const dateB = b.clockIn ? new Date(b.clockIn).getTime() : new Date(b.date).getTime()
                return dateB - dateA
            })
        } else {
            // Admin Dashboard: Return one record per user (Latest Status)
            const map = new Map()

            // Attendance is sorted desc by clockIn, so first encounter is latest
            attendance.forEach(a => {
                if (!map.has(a.userId)) {
                    map.set(a.userId, transformRecord(a))
                }
            })

            leaves.forEach(l => {
                if (!map.has(l.userId)) {
                    map.set(l.userId, transformLeave(l))
                }
            })

            transformed = Array.from(map.values())
        }

        return NextResponse.json(transformed)
    } catch (error) {
        console.error("Attendance GET error:", error)
        return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { userId, mode, date, clockIn, clockOut } = body

        if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 400 })

        // Fetch User to determine timezone
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

        const timeZone = user.selectedTimezone || 'Asia/Manila'
        const sessionStart = clockIn ? new Date(clockIn) : new Date()

        // Determine the "Session Date" based on User's Local Time
        // This ensures Oct 27 9AM Sydney is recorded as Oct 27, not Oct 26 (UTC)
        const localDateStr = sessionStart.toLocaleDateString('en-CA', { timeZone }) // YYYY-MM-DD
        const targetDate = new Date(`${localDateStr}T00:00:00Z`)

        // Check for an ACTIVE session (not clocked out)
        // Check for an ACTIVE session (not clocked out) - ignore date, just check if user has open session
        const activeSession = await prisma.attendance.findFirst({
            where: {
                userId,
                clockOut: null
            }
        })

        if (activeSession) {
            return NextResponse.json({ error: 'You are already clocked in. Please clock out first.' }, { status: 400 })
        }

        const attendance = await prisma.attendance.create({
            data: {
                userId,
                date: targetDate,
                clockIn: clockIn ? new Date(clockIn) : new Date(),
                clockOut: clockOut ? new Date(clockOut) : null,
                mode: mode || 'OFFICE',
                status: 'PRESENT'
            }
        })

        // Update user availability status to AVAILABLE when clocking in
        await prisma.user.update({
            where: { id: userId },
            data: { availabilityStatus: 'AVAILABLE' }
        })

        // Sync to Google Calendar (non-blocking)
        const session = await auth() as any
        if (session?.accessToken) {
            // User already fetched
            const timezone = user.selectedTimezone || 'UTC'
            syncStatusToCalendar(session.accessToken, 'AVAILABLE', mode || 'OFFICE', timezone)
                .catch(err => console.error('[Calendar Sync] Failed on clock-in:', err))
        }

        // Notify User if Admin created it
        if (session && session.user.id !== userId) {
            // User already fetched above as 'user'
            if (user.email && session.accessToken) {
                const emailTz = user.selectedTimezone || 'Asia/Manila'
                const details = `Clock In: ${attendance.clockIn ? new Date(attendance.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: emailTz }) : 'N/A'}` +
                    (attendance.clockOut ? `, Clock Out: ${new Date(attendance.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: emailTz })}` : '') +
                    ` (${attendance.mode})`

                await sendAdminActionEmail({
                    userName: user.name || "Employee",
                    userEmail: user.email,
                    adminName: session.user.name || "Administrator",
                    adminEmail: session.user.email,
                    adminAccessToken: session.accessToken,
                    actionType: 'ATTENDANCE',
                    details: details,
                    date: new Date(attendance.date).toLocaleDateString()
                })
            }
        }


        broadcastUpdate('attendance', attendance)
        return NextResponse.json(attendance)
    } catch (error) {
        console.error("Attendance POST error:", error)
        return NextResponse.json({ error: `Failed to record clock-in: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json()
        const { userId, action } = body

        if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 400 })

        // Find ACTIVE session
        const existing = await prisma.attendance.findFirst({
            where: {
                userId,
                clockOut: null
            }
        })

        if (!existing) {
            return NextResponse.json({ error: 'No active session found. Please clock in first.' }, { status: 404 })
        }

        let updateData: any = {}
        const now = new Date()

        if (action === 'clock-out') {
            updateData = {
                clockOut: now,
                status: 'PRESENT'
            }
            // Auto-close open breaks in the Break table
            await prisma.break.updateMany({
                where: {
                    attendanceId: existing.id,
                    endTime: null
                },
                data: {
                    endTime: now
                }
            })

            // Legacy/Convenience fields
            if (existing.breakStart && !existing.breakEnd) {
                updateData.breakEnd = now
            }

            // Update user availability to APPEAR_OFFLINE when clocking out
            await prisma.user.update({
                where: { id: userId },
                data: { availabilityStatus: 'APPEAR_OFFLINE' }
            })

            // Sync to Google Calendar - remove working location (non-blocking)
            const sessionClockOut = await auth() as any
            if (sessionClockOut?.accessToken) {
                const userForTimezone = await prisma.user.findUnique({ where: { id: userId } }) as any
                const timezone = userForTimezone?.selectedTimezone || 'UTC'
                syncStatusToCalendar(sessionClockOut.accessToken, 'APPEAR_OFFLINE', existing.mode, timezone)
                    .catch(err => console.error('[Calendar Sync] Failed on clock-out:', err))
            }
        } else if (action === 'start-break') {
            // Auto-close any existing open breaks first (safety)
            await prisma.break.updateMany({
                where: {
                    attendanceId: existing.id,
                    endTime: null
                },
                data: {
                    endTime: now
                }
            })

            // Create a record in the Break table
            await prisma.break.create({
                data: {
                    attendanceId: existing.id,
                    startTime: now
                }
            })
            // Convenience field (current break)
            updateData = { breakStart: now, breakEnd: null }

            // Update user availability to BE_RIGHT_BACK when starting a break
            await prisma.user.update({
                where: { id: userId },
                data: { availabilityStatus: 'BE_RIGHT_BACK' }
            })

            // Sync to Google Calendar (non-blocking)
            const sessionBreakStart = await auth() as any
            if (sessionBreakStart?.accessToken) {
                const userForTimezone = await prisma.user.findUnique({ where: { id: userId } }) as any
                const timezone = userForTimezone?.selectedTimezone || 'UTC'
                syncStatusToCalendar(sessionBreakStart.accessToken, 'BE_RIGHT_BACK', existing.mode, timezone)
                    .catch(err => console.error('[Calendar Sync] Failed on break start:', err))
            }
        } else if (action === 'end-break') {
            // Close the latest break in the Break table
            const latestBreak = await prisma.break.findFirst({
                where: {
                    attendanceId: existing.id,
                    endTime: null
                },
                orderBy: { startTime: 'desc' }
            })

            if (latestBreak) {
                await prisma.break.update({
                    where: { id: latestBreak.id },
                    data: { endTime: now }
                })
            }
            // Convenience field
            updateData = { breakEnd: now }

            // Update user availability to AVAILABLE when ending a break
            await prisma.user.update({
                where: { id: userId },
                data: { availabilityStatus: 'AVAILABLE' }
            })

            // Sync to Google Calendar (non-blocking)
            const sessionBreakEnd = await auth() as any
            if (sessionBreakEnd?.accessToken) {
                const userForTimezone = await prisma.user.findUnique({ where: { id: userId } }) as any
                const timezone = userForTimezone?.selectedTimezone || 'UTC'
                syncStatusToCalendar(sessionBreakEnd.accessToken, 'AVAILABLE', existing.mode, timezone)
                    .catch(err => console.error('[Calendar Sync] Failed on break end:', err))
            }
        }

        const updated = await prisma.attendance.update({
            where: { id: existing.id },
            data: updateData
        })

        broadcastUpdate('attendance', updated)
        return NextResponse.json(updated)
    } catch (error) {
        console.error("Attendance PATCH error:", error)
        return NextResponse.json({ error: 'Action failed' }, { status: 500 })
    }
}
