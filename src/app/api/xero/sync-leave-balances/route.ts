import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { syncXeroLeaveBalances } from '@/lib/xero-leave-sync'

export const dynamic = 'force-dynamic'

// Manual "Refresh from Xero" trigger for the admin leave-credits table.
// The automatic path is the weekly cron; this lets an admin pull on demand
// instead of waiting, without hitting Xero on every page view.
export async function POST() {
    const session = await auth()
    if (!session?.user?.roles?.includes('ADMIN')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await syncXeroLeaveBalances(session.user.id as string)
    if (result.error) {
        return NextResponse.json({ success: false, ...result }, { status: 400 })
    }
    return NextResponse.json({ success: true, ...result })
}
