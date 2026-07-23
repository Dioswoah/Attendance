import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const MAX_RANGE_DAYS = 366

function toDate(value: string | null, fallback: Date): Date {
    if (!value) return fallback
    const parsed = new Date(value + 'T00:00:00.000Z')
    return isNaN(parsed.getTime()) ? fallback : parsed
}

// Usage stats for one key — calls/day for the chart over a caller-chosen
// date range (defaults to month-to-date), plus lifetime totals and the
// most-hit endpoints. Viewable by the key's own owner, or any ADMIN.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const key = await prisma.apiKey.findUnique({ where: { id }, select: { userId: true } })
    if (!key) return NextResponse.json({ error: 'Key not found' }, { status: 404 })

    const isOwner = key.userId === session.user.id
    const isAdmin = (session.user.roles || []).includes('ADMIN')
    if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

    let from = toDate(searchParams.get('from'), monthStart)
    let to = toDate(searchParams.get('to'), now)
    if (from > to) [from, to] = [to, from]

    const rangeDays = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1
    if (rangeDays > MAX_RANGE_DAYS) {
        from = new Date(to.getTime() - (MAX_RANGE_DAYS - 1) * 86_400_000)
    }

    const rangeEnd = new Date(to)
    rangeEnd.setUTCHours(23, 59, 59, 999)

    const logs = await prisma.apiKeyUsageLog.findMany({
        where: { apiKeyId: id, createdAt: { gte: from, lte: rangeEnd } },
        select: { endpoint: true, createdAt: true },
    })

    const dayCounts = new Map<string, number>()
    const cursor = new Date(from)
    while (cursor <= to) {
        dayCounts.set(cursor.toISOString().slice(0, 10), 0)
        cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    const endpointCounts = new Map<string, number>()
    for (const log of logs) {
        const day = log.createdAt.toISOString().slice(0, 10)
        dayCounts.set(day, (dayCounts.get(day) || 0) + 1)
        endpointCounts.set(log.endpoint, (endpointCounts.get(log.endpoint) || 0) + 1)
    }

    const totalCalls = await prisma.apiKeyUsageLog.count({ where: { apiKeyId: id } })

    return NextResponse.json({
        totalCalls,
        rangeFrom: from.toISOString().slice(0, 10),
        rangeTo: to.toISOString().slice(0, 10),
        dailyCounts: Array.from(dayCounts, ([date, count]) => ({ date, count })),
        topEndpoints: Array.from(endpointCounts, ([endpoint, count]) => ({ endpoint, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
    })
}
