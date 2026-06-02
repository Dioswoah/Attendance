import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { syncXeroLeaveBalances } from '@/lib/xero-leave-sync'

export const dynamic = 'force-dynamic'

export async function POST() {
    const session = await auth()
    const roles: string[] = (session?.user as any)?.roles || []
    if (!session?.user || !roles.some(r => ['ADMIN', 'DEVELOPER'].includes(r))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const result = await syncXeroLeaveBalances()
        return NextResponse.json({ success: true, ...result })
    } catch (err: any) {
        console.error('[Xero Leave Sync] Manual trigger error:', err.message)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
