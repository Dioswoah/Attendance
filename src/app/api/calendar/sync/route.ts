import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from "@/auth"
import { getCurrentWorkingLocation } from "@/lib/calendar"

export const dynamic = 'force-dynamic';


/**
 * Sync user status FROM Google Calendar TO the app
 * This enables one-way sync: Google Calendar -> App
 * 
 * Usage: Call this endpoint periodically or on-demand to sync status from Google Calendar
 */
export async function POST(req: Request) {
    try {
        const session = await auth() as any
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        if (!session.accessToken) {
            return NextResponse.json({
                success: false,
                message: "No access token available. Please sign in again."
            }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id }
        }) as any

        const timezone = user?.selectedTimezone || 'UTC'

        // 1. Get Chat Presence
        let chatPresence: string | null = null;
        try {
            const chatRes = await fetch('https://chat.googleapis.com/v1/users/me/presence', {
                headers: { 'Authorization': `Bearer ${session.accessToken}` },
                cache: 'no-store'
            });
            if (chatRes.ok) {
                const chatData = await chatRes.json();
                chatPresence = chatData.presence;
            }
        } catch (e) {
            console.error('[Sync] Chat presence fetch error:', e);
        }

        // 2. Get Calendar Events (for "In a Meeting" detection)
        const calendarLocation = await getCurrentWorkingLocation(session.accessToken, timezone);
        const isCalBusy = calendarLocation?.label === 'In a Meeting' || calendarLocation?.summary === 'Focus Time';

        // 3. Determine Final App Status
        let appStatus: 'AVAILABLE' | 'DO_NOT_DISTURB' | 'APPEAR_OFFLINE' = 'APPEAR_OFFLINE';

        if (chatPresence === 'ONLINE') {
            // User is active in Google. But wait, what if they are in a meeting?
            // Usually if they are ONLINE, they are available unless they explicitly set DND.
            // If they have a calendar event and it's marking them as "In a Meeting", let's prioritize that.
            if (isCalBusy) {
                appStatus = 'DO_NOT_DISTURB';
            } else {
                appStatus = 'AVAILABLE';
            }
        } else if (chatPresence === 'DO_NOT_DISTURB' || isCalBusy) {
            appStatus = 'DO_NOT_DISTURB';
        } else {
            // AWAY, OFFLINE, or No Presence -> Offline
            appStatus = 'APPEAR_OFFLINE';
        }

        console.log(`[Sync] Derived Status: ${appStatus} (Chat: ${chatPresence}, Cal: ${calendarLocation?.label})`);

        // Update user status in the app
        await prisma.user.update({
            where: { id: session.user.id },
            data: { availabilityStatus: appStatus as any }
        })

        return NextResponse.json({
            success: true,
            message: "Status synced from Google Calendar",
            status: appStatus,
            calendarLocation: null
        })

    } catch (error) {
        console.error("[Calendar Sync] Error syncing from Google Calendar:", error)
        return NextResponse.json({
            success: false,
            error: 'Failed to sync from Google Calendar'
        }, { status: 500 })
    }
}

/**
 * Get current sync status
 */
export async function GET(req: Request) {
    try {
        const session = await auth() as any
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        if (!session.accessToken) {
            return NextResponse.json({
                synced: false,
                message: "No access token available"
            })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id }
        }) as any

        const timezone = user?.selectedTimezone || 'UTC'

        // Get current working location from Google Calendar
        const workingLocation = await getCurrentWorkingLocation(session.accessToken, timezone)

        return NextResponse.json({
            synced: true,
            appStatus: user?.availabilityStatus,
            calendarLocation: workingLocation,
            hasCalendarEvent: !!workingLocation
        })

    } catch (error) {
        console.error("[Calendar Sync] Error getting sync status:", error)
        return NextResponse.json({
            synced: false,
            error: 'Failed to get sync status'
        }, { status: 500 })
    }
}
