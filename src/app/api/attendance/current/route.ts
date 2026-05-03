import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const active = await prisma.attendance.findFirst({
        where: { userId, clockOut: null, deletedAt: null },
        include: {
            breaks: {
                where: { deletedAt: null },
                orderBy: { startTime: 'desc' },
                take: 1
            }
        }
    })

    if (!active) {
        return NextResponse.json({ active: null })
    }

    const activeBreak = active.breaks[0] && !active.breaks[0].endTime ? active.breaks[0] : null

    return NextResponse.json({
        active: {
            id: active.id,
            userId: active.userId,
            date: active.date.toISOString().split('T')[0],
            clockIn: active.clockIn?.toISOString() || null,
            clockOut: null,
            mode: active.mode,
            locationDetails: active.locationDetails,
            status: activeBreak ? 'on-break' : 'clocked-in',
            breakStart: activeBreak ? activeBreak.startTime.toISOString() : (active.breakStart?.toISOString() || null),
            breakEnd: null,
            breaks: active.breaks.map(b => ({
                id: b.id,
                startTime: b.startTime.toISOString(),
                endTime: b.endTime?.toISOString() || null
            }))
        }
    })
}
