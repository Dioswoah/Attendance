// Calendar-driven availability status sync — single source of truth.
//
// Both the per-user browser poll (/api/user/status/sync) and the server-side
// cron (/api/cron/status-sync) call syncCalendarStatusForUser so they can
// never disagree. The status is derived from the user's Google Calendar via
// getCurrentWorkingLocation (meeting / focus time / OOO / working location).
//
// NOTE: this only ever writes the "in-app" availability overlay (AVAILABLE /
// DO_NOT_DISTURB / APPEAR_AWAY). It never writes APPEAR_OFFLINE — offline is
// derived from attendance clock-in state in the UI, not from the calendar.

import { prisma } from '@/lib/prisma'
import { broadcastUpdate } from '@/lib/eventBus'
import { invalidateCache, CacheKeys } from '@/lib/cache'
import { getCurrentWorkingLocation } from '@/lib/calendar'

type DerivedStatus = { status: 'AVAILABLE' | 'DO_NOT_DISTURB' | 'APPEAR_AWAY'; customMessage: string | null }

/**
 * Exchange a stored Google refresh token for a usable access token. Reuses the
 * still-valid stored access token when possible to avoid a refresh round-trip
 * on every call. Returns null if the account has no refresh token or the
 * refresh fails (revoked grant, etc.) — callers should skip that user.
 */
export async function getFreshGoogleAccessToken(account: {
    access_token: string | null
    refresh_token: string | null
    expires_at: number | null
}): Promise<string | null> {
    const nowSec = Math.floor(Date.now() / 1000)
    // Reuse the stored token while it has >2 min of life left.
    if (account.access_token && account.expires_at && account.expires_at - nowSec > 120) {
        return account.access_token
    }
    if (!account.refresh_token) return null

    try {
        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.AUTH_GOOGLE_ID || '',
                client_secret: process.env.AUTH_GOOGLE_SECRET || '',
                grant_type: 'refresh_token',
                refresh_token: account.refresh_token,
            }),
        })
        if (!res.ok) {
            console.error('[StatusSync] token refresh failed:', res.status)
            return null
        }
        const data = await res.json()
        return data.access_token ?? null
    } catch (e) {
        console.error('[StatusSync] token refresh error:', e)
        return null
    }
}

/**
 * Map a Google Calendar working-location/event result to an in-app status.
 * A clocked-in person with nothing special on their calendar is "Active".
 */
function deriveStatus(loc: Awaited<ReturnType<typeof getCurrentWorkingLocation>>): DerivedStatus {
    if (!loc) return { status: 'AVAILABLE', customMessage: null }
    if (loc.label === 'In a Meeting') return { status: 'DO_NOT_DISTURB', customMessage: 'On going' }
    if (loc.label === 'Offline') return { status: 'APPEAR_AWAY', customMessage: loc.summary || 'Out of Office' }
    // Any concrete working location (In Office / Working from Home / custom) → Active.
    return { status: 'AVAILABLE', customMessage: null }
}

/**
 * Read the user's calendar, derive their availability, and persist + broadcast
 * ONLY when it actually changed (avoids needless writes, cache busts, and SSE
 * noise). Returns whether anything changed and the resulting status.
 */
export async function syncCalendarStatusForUser(opts: {
    userId: string
    accessToken: string
    timezone?: string
    currentStatus?: string | null
}): Promise<{ changed: boolean; status: string }> {
    const { userId, accessToken } = opts
    const timezone = opts.timezone || 'UTC'

    const loc = await getCurrentWorkingLocation(accessToken, timezone)
    const { status, customMessage } = deriveStatus(loc)

    let current = opts.currentStatus
    if (current === undefined) {
        const u = await prisma.user.findUnique({ where: { id: userId }, select: { availabilityStatus: true } })
        current = u?.availabilityStatus ?? null
    }

    if (current === status) return { changed: false, status }

    await prisma.user.update({
        where: { id: userId },
        data: { availabilityStatus: status as any, customStatusMessage: customMessage },
    })

    broadcastUpdate('staff', { userId, availabilityStatus: status, customStatusMessage: customMessage })
    await invalidateCache(CacheKeys.staffDashboard)

    return { changed: true, status }
}
