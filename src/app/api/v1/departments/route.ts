import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey } from '@/lib/api-keys'

export const dynamic = 'force-dynamic'

// Public v1 (API-key auth, read-only): departments with manager and headcount.
export async function GET(request: Request) {
    const apiAuth = await authenticateApiKey(request)
    if (!apiAuth) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })

    const departments = await prisma.department.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            shiftStartTime: true,
            manager: { select: { id: true, name: true, email: true } },
            _count: { select: { users: { where: { isArchived: false, deletedAt: null } } } },
        },
    })

    return NextResponse.json({
        departments: departments.map((d) => ({
            id: d.id,
            name: d.name,
            shiftStartTime: d.shiftStartTime,
            manager: d.manager,
            employeeCount: d._count.users,
        })),
    })
}
