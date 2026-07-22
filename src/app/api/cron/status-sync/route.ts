import { NextResponse } from 'next/server'
import { syncAllClockedInUsers } from '@/lib/status-sync'

export const dynamic = 'force-dynamic'

// Manual/standalone trigger for the calendar → availability sweep of all
// clocked-in users. On prod this same sweep is also called every minute from
// /api/cron/notifications; this route stays for on-demand runs and testing.
// Gated by its own flag so it can run on staging without the prod-only crons.
export async function GET(request: Request) {
    if (process.env.CALENDAR_STATUS_SYNC_ENABLED !== 'true') {
        return NextResponse.json({ success: true, message: 'Calendar status sync disabled on this deployment.' })
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('x-cron-secret')
    const expectedSecret = process.env.CRON_SECRET
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}` && authHeader !== expectedSecret) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        const result = await syncAllClockedInUsers()
        return NextResponse.json({ success: true, ...result })
    } catch (error) {
        console.error('[StatusSync] cron failed:', error)
        return NextResponse.json({ success: false, error: 'Status sync failed' }, { status: 500 })
    }
}
