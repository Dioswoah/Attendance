import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Consolidated leave-credits table for the admin Xero page. Reads only from
// our own DB (never calls Xero live) — data is only as fresh as the last
// "Refresh from Xero" click or weekly cron run.
export async function GET() {
    const session = await auth()
    if (!session?.user?.roles?.includes('ADMIN')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const staff = await prisma.user.findMany({
        where: { employmentLocation: 'Australia', isArchived: false },
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            email: true,
            xeroEmployeeId: true,
            xeroLeaveBalances: {
                select: { leaveName: true, hours: true, syncedAt: true },
                orderBy: { leaveName: 'asc' },
            },
        },
    })

    const staffRows = staff.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        linked: s.xeroEmployeeId !== null,
        lastSyncedAt: s.xeroLeaveBalances[0]?.syncedAt ?? null,
        balances: s.xeroLeaveBalances.map(b => ({ name: b.leaveName, hours: b.hours })),
    }))

    return NextResponse.json({ staff: staffRows })
}
