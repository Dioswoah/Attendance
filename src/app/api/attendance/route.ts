import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
        const attendance = await prisma.attendance.findMany({
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
        })

        const transformed = attendance.map(a => ({
            id: a.id,
            userId: a.userId,
            userName: a.user?.name || 'Unknown',
            department: a.user?.department?.name || 'Unassigned',
            date: a.date.toISOString().split('T')[0],
            clockIn: a.clockIn?.toISOString(),
            clockOut: a.clockOut?.toISOString(),
            mode: a.mode,
            status: a.clockOut ? 'clocked-out' : (a.breakStart && !a.breakEnd ? 'on-break' : 'clocked-in'),
            breakStart: a.breakStart?.toISOString(),
            breakEnd: a.breakEnd?.toISOString()
        }))

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

        console.log(`[Attendance] Record attempt for user ${userId} on ${targetDate.toISOString()}`)

        const attendance = await prisma.attendance.upsert({
            where: {
                userId_date: {
                    userId,
                    date: targetDate
                }
            },
            update: {
                clockIn: clockIn ? new Date(clockIn) : new Date(),
                clockOut: clockOut ? new Date(clockOut) : null,
                mode: mode || 'OFFICE',
                status: 'PRESENT'
            },
            create: {
                userId,
                date: targetDate,
                clockIn: clockIn ? new Date(clockIn) : new Date(),
                clockOut: clockOut ? new Date(clockOut) : null,
                mode: mode || 'OFFICE',
                status: 'PRESENT'
            }
        })

        console.log(`[Attendance] Successfully clocked in ${userId}`)
        return NextResponse.json(attendance)
    } catch (error) {
        console.error("Attendance POST error:", error)
        return NextResponse.json({ error: 'Failed to record clock-in. Internal error.' }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json()
        const { userId, action } = body

        if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 400 })

        const today = getUTCToday()

        const existing = await prisma.attendance.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: today
                }
            }
        })

        if (!existing) {
            return NextResponse.json({ error: 'No active record for today. Please clock in first.' }, { status: 404 })
        }

        let updateData: any = {}
        if (action === 'clock-out') {
            updateData = { clockOut: new Date(), status: 'PRESENT' } // status can be adjusted later
        } else if (action === 'start-break') {
            updateData = { breakStart: new Date(), breakEnd: null }
        } else if (action === 'end-break') {
            updateData = { breakEnd: new Date() }
        }

        const updated = await prisma.attendance.update({
            where: { id: existing.id },
            data: updateData
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error("Attendance PATCH error:", error)
        return NextResponse.json({ error: 'Action failed' }, { status: 500 })
    }
}
