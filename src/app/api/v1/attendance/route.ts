import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey, parsePagination } from '@/lib/api-keys'

export const dynamic = 'force-dynamic'

// Public v1 (API-key auth, read-only): attendance records.
// Query params: from/to (YYYY-MM-DD), email, page, pageSize (max 100).
export async function GET(request: Request) {
    const apiAuth = await authenticateApiKey(request)
    if (!apiAuth) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const email = searchParams.get('email')
    for (const [label, v] of [['from', from], ['to', to]] as const) {
        if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
            return NextResponse.json({ error: `${label} must be YYYY-MM-DD` }, { status: 400 })
        }
    }
    const { page, pageSize, skip } = parsePagination(searchParams)

    const where = {
        deletedAt: null,
        ...(from || to
            ? { date: { ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59Z`) } : {}) } }
            : {}),
        ...(email ? { user: { email: { equals: email, mode: 'insensitive' as const } } } : {}),
    }

    const [total, records] = await Promise.all([
        prisma.attendance.count({ where }),
        prisma.attendance.findMany({
            where,
            orderBy: [{ date: 'desc' }, { clockIn: 'desc' }],
            skip,
            take: pageSize,
            select: {
                id: true,
                date: true,
                clockIn: true,
                clockOut: true,
                status: true,
                mode: true,
                source: true,
                duration: true,
                notes: true,
                user: { select: { id: true, name: true, email: true } },
                breaks: { select: { startTime: true, endTime: true } },
            },
        }),
    ])

    return NextResponse.json({ page, pageSize, total, records })
}
