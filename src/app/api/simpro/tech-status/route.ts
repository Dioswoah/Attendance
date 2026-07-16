import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isSimproConfigured } from '@/lib/simpro'
import { getTechDayStatuses, maybeProcessSimproClockIns, sydneyToday } from '@/lib/simpro-attendance'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const roles = session.user.roles || []
        // Strictly OPERATIONS + admins/developers (Marc, 2026-07-16) — managers
        // are deliberately NOT included.
        if (!roles.includes('ADMIN') && !roles.includes('DEVELOPER') && !roles.includes('OPERATIONS')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        if (!isSimproConfigured()) {
            return NextResponse.json({ error: 'simPRO is not configured on this deployment' }, { status: 503 })
        }

        const { searchParams } = new URL(request.url)
        const dateParam = searchParams.get('date')
        if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
            return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
        }
        const date = dateParam || sydneyToday()

        const technicians = await getTechDayStatuses(date)

        // Piggy-back the (flag-gated) clock-in processor for today's data so the
        // feature works even before a Cloud Scheduler job / webhook is set up.
        if (date === sydneyToday()) {
            maybeProcessSimproClockIns().catch((e) => console.error('[simPRO] lazy processing failed:', e))
        }

        return NextResponse.json({
            date,
            writeEnabled: process.env.SIMPRO_ATTENDANCE_WRITE === 'true',
            technicians,
        })
    } catch (error) {
        console.error('[simPRO] tech-status failed:', error)
        return NextResponse.json({ error: 'Failed to load technician status' }, { status: 500 })
    }
}
