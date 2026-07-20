import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getXeroToken } from '@/lib/xero'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')?.toLowerCase().trim()

    if (!email) {
        return NextResponse.json({ error: 'email parameter required' }, { status: 400 })
    }

    // Check if Xero is connected
    try {
        await getXeroToken()
    } catch {
        return NextResponse.json({ connected: false })
    }

    // Look up user and their cached balances from DB
    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, xeroEmployeeId: true, xeroLeaveBalances: { select: { leaveName: true, hours: true, syncedAt: true } } },
    })

    if (!user) return NextResponse.json({ connected: true, found: false, email })

    const balances = user.xeroLeaveBalances
    // Linked via xeroEmployeeId but no balances yet -> "found" so the UI says
    // "no balances configured" instead of the misleading "not linked"
    if (!balances.length) {
        return NextResponse.json({ connected: true, found: Boolean(user.xeroEmployeeId), email, leaveBalances: [] })
    }

    return NextResponse.json({
        connected: true,
        found: true,
        syncedAt: balances[0].syncedAt,
        leaveBalances: balances.map(b => ({
            name: b.leaveName,
            units: b.hours,
            typeOfUnits: 'Hours',
        })),
    })
}
