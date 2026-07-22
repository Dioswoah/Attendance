import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFreshGoogleAccessToken, syncCalendarStatusForUser } from '@/lib/status-sync'

export const dynamic = 'force-dynamic'

// Server-side calendar → availability sync for ALL currently clocked-in users.
// The per-user browser poll (/api/user/status/sync) only updates whoever has
// the app open; this cron covers everyone who's on the clock, including staff
// whose browser is closed, so their "In a Meeting" shows to admins on the
// board. Only clocked-in users are touched — offline is attendance-driven and
// the calendar never marks anyone offline (Marc, 2026-07-22).
//
// Gated by its own flag (not ENABLE_CRON) so it can run on staging for
// validation without turning on the prod-only attendance crons.
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
        // Distinct users with a live (open) attendance session.
        const openSessions = await prisma.attendance.findMany({
            where: { clockOut: null, clockIn: { not: null }, deletedAt: null },
            select: { userId: true },
            distinct: ['userId'],
        })
        const userIds = openSessions.map((s) => s.userId)
        if (userIds.length === 0) {
            return NextResponse.json({ success: true, checked: 0, synced: 0, skipped: 0 })
        }

        // Load each user's Google account + timezone + current status in one go.
        // Only accounts that granted the calendar scope and have a refresh token
        // can be synced server-side; everyone else is skipped (their badge still
        // works from attendance state).
        const users = await prisma.user.findMany({
            where: { id: { in: userIds }, deletedAt: null },
            select: {
                id: true,
                selectedTimezone: true,
                availabilityStatus: true,
                accounts: {
                    where: { refresh_token: { not: null }, scope: { contains: 'calendar' } },
                    select: { access_token: true, refresh_token: true, expires_at: true },
                    take: 1,
                },
            },
        })

        let synced = 0
        let skipped = 0
        const limit = 5
        let idx = 0
        async function worker() {
            while (idx < users.length) {
                const u = users[idx++]
                const account = u.accounts[0]
                if (!account) {
                    skipped++
                    continue
                }
                try {
                    const accessToken = await getFreshGoogleAccessToken(account)
                    if (!accessToken) {
                        skipped++
                        continue
                    }
                    const result = await syncCalendarStatusForUser({
                        userId: u.id,
                        accessToken,
                        timezone: u.selectedTimezone || 'UTC',
                        currentStatus: u.availabilityStatus,
                    })
                    if (result.changed) synced++
                } catch (e) {
                    console.error(`[StatusSync] failed for user ${u.id}:`, e)
                    skipped++
                }
            }
        }
        await Promise.all(Array.from({ length: Math.min(limit, users.length) }, worker))

        return NextResponse.json({ success: true, checked: users.length, synced, skipped })
    } catch (error) {
        console.error('[StatusSync] cron failed:', error)
        return NextResponse.json({ success: false, error: 'Status sync failed' }, { status: 500 })
    }
}
