import { NextResponse } from 'next/server'
import { syncXeroLeaveBalances } from '@/lib/xero-leave-sync'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    if (process.env.ENABLE_CRON !== 'true') {
        return NextResponse.json({ success: true, message: 'Cron disabled on this deployment.' })
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('x-cron-secret')
    const expectedSecret = process.env.CRON_SECRET
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}` && authHeader !== expectedSecret) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    console.log('[Xero Leave Sync] Weekly cron triggered')

    try {
        const result = await syncXeroLeaveBalances()
        console.log(`[Xero Leave Sync] Done — synced: ${result.synced}, skipped: ${result.skipped}`)
        return NextResponse.json({ success: true, ...result })
    } catch (err: any) {
        console.error('[Xero Leave Sync] Error:', err.message)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
