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

        // 1. Get Google Chat Status (Presence + DND)
        let chatPresence: string | null = null;
        let dndState: string | null = null;

        try {
            // A. Fetch Presence (Online/Away/Offline)
            const chatRes = await fetch('https://chat.googleapis.com/v1/users/me/presence', {
                headers: { 'Authorization': `Bearer ${session.accessToken}` },
                cache: 'no-store'
            });
            if (chatRes.ok) {
                const chatData = await chatRes.json();
                chatPresence = chatData.presence;
                console.log(`[Sync] Chat Presence: ${chatPresence}`);
            } else {
                console.warn(`[Sync] Failed Presence fetch: ${chatRes.status}`);
            }

            // B. Fetch User DND Settings (REMOVED: Requires restricted scope)
            // We rely on Calendar "Focus Time" or "Busy" events for DND status.
        } catch (e) {
            console.error('[Sync] Chat API error:', e);
        }

        // 2. Get Calendar Events (for "In a Meeting" detection)
        const calendarLocation = await getCurrentWorkingLocation(session.accessToken, timezone);
        const isCalBusy = calendarLocation?.label === 'In a Meeting' || calendarLocation?.summary === 'Focus Time';

        // 3. Determine Final App Status
        // Allow all valid UserStatus types
        let appStatus: 'AVAILABLE' | 'DO_NOT_DISTURB' | 'APPEAR_OFFLINE' | 'APPEAR_AWAY' | 'BE_RIGHT_BACK' = 'APPEAR_OFFLINE';

        // Priority 1: DND (Explicitly set in Chat or Calendar)
        if (dndState === 'DO_NOT_DISTURB' || isCalBusy) {
            appStatus = 'DO_NOT_DISTURB';
        }
        // Priority 2: Online Presence (If not DND)
        else if (chatPresence === 'ONLINE') {
            appStatus = 'AVAILABLE';
        }
        else if (chatPresence === 'AWAY') {
            appStatus = 'APPEAR_AWAY'; // Map Google 'AWAY' to our 'APPEAR_AWAY'
        }
        // Priority 3: Offline
        else {
            // Google Chat says "OFFLINE" (or null).
            // We default to 'AVAILABLE' instead of 'APPEAR_OFFLINE' to avoid overriding 
            // the user's "Clocked In" status in the app.
            // If the user is truly offline (not using the app), the UI handles that separately via lastActive.
            appStatus = 'AVAILABLE';
        }

        console.log(`[Sync] Derived Status: ${appStatus} (Chat: ${chatPresence}, Cal Label: ${calendarLocation?.label}, Cal Summary: ${calendarLocation?.summary})`);

        // Update user status in the app
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                availabilityStatus: appStatus as any
                // usage: We can't sync custom status from Google without restricted scopes, 
                // so we preserve any manually set status in the app.
            }
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
