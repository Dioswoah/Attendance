import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DAYS = 30

// Usage stats for one key — calls/day for the chart, plus totals and the
// most-hit endpoints. Viewable by the key's own owner, or any ADMIN.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const key = await prisma.apiKey.findUnique({ where: { id }, select: { userId: true } })
    if (!key) return NextResponse.json({ error: 'Key not found' }, { status: 404 })

    const isOwner = key.userId === session.user.id
    const isAdmin = (session.user.roles || []).includes('ADMIN')
    if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const since = new Date()
    since.setDate(since.getDate() - (DAYS - 1))
    since.setHours(0, 0, 0, 0)

    const logs = await prisma.apiKeyUsageLog.findMany({
        where: { apiKeyId: id, createdAt: { gte: since } },
        select: { endpoint: true, createdAt: true },
    })

    const dayCounts = new Map<string, number>()
    for (let i = 0; i < DAYS; i++) {
        const d = new Date(since)
        d.setDate(d.getDate() + i)
        dayCounts.set(d.toISOString().slice(0, 10), 0)
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
        last30Days: Array.from(dayCounts, ([date, count]) => ({ date, count })),
        topEndpoints: Array.from(endpointCounts, ([endpoint, count]) => ({ endpoint, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
    })
}
