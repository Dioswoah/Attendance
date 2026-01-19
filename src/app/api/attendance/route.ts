import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// NSW Public Holidays 2026
const NSW_HOLIDAYS_2026 = [
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

    // Format YYYY-MM-DD to check against holidays
    // Use localized string parts to avoid UTC shift issues if strictly comparing calendar dates
    // But since we are using UTC dates in the app generally, let's stick to ISO string split
    const dateStr = date.toISOString().split('T')[0]
    if (NSW_HOLIDAYS_2026.includes(dateStr)) return false

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
 * Helper to get current UTC date at midnight
 */
function getUTCToday() {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    // Date range support
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const departmentId = searchParams.get('departmentId')

    let whereClause: any = {}

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
            targetDate = getUTCToday()
        }

        const nextDay = new Date(targetDate)
        nextDay.setUTCDate(targetDate.getUTCDate() + 1)
        whereClause.date = { gte: targetDate, lt: nextDay }
    }

    if (userId) whereClause.userId = userId
    if (departmentId && departmentId !== 'all') {
        whereClause.user = { departmentId }
    }

    try {
        // Prepare Leave Query
        let leaveWhere: any = { status: 'APPROVED' }
        if (userId) leaveWhere.userId = userId
        if (departmentId && departmentId !== 'all') leaveWhere.user = { departmentId }

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
            breakEnd: a.breakEnd?.toISOString()
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

        const targetDate = date ? new Date(date) : getUTCToday()
        targetDate.setUTCHours(0, 0, 0, 0)

        // Check for an ACTIVE session (not clocked out)
        const activeSession = await prisma.attendance.findFirst({
            where: {
                userId,
                date: targetDate,
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

        console.log(`[Attendance] Successfully clocked in ${userId}`)
        // @ts-ignore
        if (global.io) global.io.emit('update-data')
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

        const today = getUTCToday()

        // Find ACTIVE session
        const existing = await prisma.attendance.findFirst({
            where: {
                userId,
                date: today,
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
            // Auto-close break if open
            if (existing.breakStart && !existing.breakEnd) {
                updateData.breakEnd = now
            }
        } else if (action === 'start-break') {
            updateData = { breakStart: now, breakEnd: null }
        } else if (action === 'end-break') {
            updateData = { breakEnd: now }
        }

        const updated = await prisma.attendance.update({
            where: { id: existing.id },
            data: updateData
        })

        // @ts-ignore
        if (global.io) global.io.emit('update-data')
        return NextResponse.json(updated)
    } catch (error) {
        console.error("Attendance PATCH error:", error)
        return NextResponse.json({ error: 'Action failed' }, { status: 500 })
    }
}
