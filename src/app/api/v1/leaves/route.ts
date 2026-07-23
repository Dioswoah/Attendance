import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey, parsePagination } from '@/lib/api-keys'

export const dynamic = 'force-dynamic'

// Public v1 (API-key auth, read-only): leave records.
// Query params: from/to (YYYY-MM-DD, matches leaves overlapping the range),
// email, status (e.g. APPROVED), page, pageSize (max 100).
export async function GET(request: Request) {
    const apiAuth = await authenticateApiKey(request)
    if (!apiAuth) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const email = searchParams.get('email')
    const status = searchParams.get('status')
    for (const [label, v] of [['from', from], ['to', to]] as const) {
        if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
            return NextResponse.json({ error: `${label} must be YYYY-MM-DD` }, { status: 400 })
        }
    }
    const { page, pageSize, skip } = parsePagination(searchParams)

    const where = {
        deletedAt: null,
        isArchived: false,
        ...(status ? { status: { equals: status, mode: 'insensitive' as const } } : {}),
        ...(from ? { endDate: { gte: new Date(`${from}T00:00:00Z`) } } : {}),
        ...(to ? { startDate: { lte: new Date(`${to}T23:59:59Z`) } } : {}),
        ...(email ? { user: { email: { equals: email, mode: 'insensitive' as const } } } : {}),
    }

    const [total, leaves] = await Promise.all([
        prisma.leave.count({ where }),
        prisma.leave.findMany({
            where,
            orderBy: { startDate: 'desc' },
            skip,
            take: pageSize,
            select: {
                id: true,
                startDate: true,
                endDate: true,
                type: true,
                status: true,
                duration: true,
                user: { select: { id: true, name: true, email: true } },
            },
        }),
    ])

    return NextResponse.json({ page, pageSize, total, leaves })
}
