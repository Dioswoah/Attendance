import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const roles = (session.user as any)?.roles || []
    if (!roles.includes('ADMIN') && !roles.includes('DEVELOPER')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const departmentId = searchParams.get('departmentId') || 'all'

    if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

    const dayStart = new Date(`${date}T00:00:00Z`)
    const dayEnd   = new Date(`${date}T23:59:59.999Z`)

    const userWhere: any = { isArchived: false, deletedAt: null }
    if (departmentId !== 'all') userWhere.departmentId = departmentId

    const records = await prisma.attendance.findMany({
        where: {
            date: { gte: dayStart, lte: dayEnd },
            deletedAt: null,
            user: userWhere,
        },
        select: {
            id: true,
            clockIn: true,
            clockOut: true,
            clockInLat: true,
            clockInLng: true,
            clockInAccuracy: true,
            clockOutLat: true,
            clockOutLng: true,
            clockOutAccuracy: true,
            mode: true,
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    department: { select: { id: true, name: true } },
                }
            }
        },
        orderBy: { clockIn: 'asc' }
    })

    return NextResponse.json(records)
}
