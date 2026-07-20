import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey, parsePagination } from '@/lib/api-keys'

export const dynamic = 'force-dynamic'

// Public v1 (API-key auth, read-only): employees directory.
// Query params: department (name), email, page, pageSize (max 100).
// Deliberately excludes anything sensitive (passwords, tokens, notes).
export async function GET(request: Request) {
    const apiAuth = await authenticateApiKey(request)
    if (!apiAuth) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const department = searchParams.get('department')
    const email = searchParams.get('email')
    const { page, pageSize, skip } = parsePagination(searchParams)

    const where = {
        isArchived: false,
        deletedAt: null,
        ...(email ? { email: { equals: email, mode: 'insensitive' as const } } : {}),
        ...(department ? { department: { name: { equals: department, mode: 'insensitive' as const } } } : {}),
    }

    const [total, employees] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
            where,
            orderBy: { name: 'asc' },
            skip,
            take: pageSize,
            select: {
                id: true,
                name: true,
                email: true,
                roles: true,
                employmentLocation: true,
                shiftStartTime: true,
                shiftEndTime: true,
                workingDays: true,
                department: { select: { id: true, name: true } },
                manager: { select: { id: true, name: true, email: true } },
            },
        }),
    ])

    return NextResponse.json({ page, pageSize, total, employees })
}
