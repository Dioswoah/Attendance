import { NextResponse } from 'next/server'
import { isSimproConfigured } from '@/lib/simpro'
import { processSimproClockIns } from '@/lib/simpro-attendance'

export const dynamic = 'force-dynamic'

// Polling fallback for the simPRO attendance feature (webhook is the primary
// trigger). Intended for Cloud Scheduler every ~5 min during Sydney work
// hours. Gated by its own flag (not ENABLE_CRON, which is reserved for the
// single prod deployment) so it can run on staging against attendance_db.
export async function GET(request: Request) {
    if (process.env.SIMPRO_POLL_ENABLED !== 'true') {
        return NextResponse.json({ success: true, message: 'simPRO polling disabled on this deployment.' })
    }
    if (!isSimproConfigured()) {
        return NextResponse.json({ success: false, message: 'simPRO is not configured.' }, { status: 503 })
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('x-cron-secret')
    const expectedSecret = process.env.CRON_SECRET
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}` && authHeader !== expectedSecret) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        const result = await processSimproClockIns()
        return NextResponse.json({ success: true, ...result })
    } catch (error) {
        console.error('[simPRO] cron sync failed:', error)
        return NextResponse.json({ success: false, error: 'simPRO sync failed' }, { status: 500 })
    }
}
