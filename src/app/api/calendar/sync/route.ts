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

        // 1. Try to get Real-time Google Chat Presence (The "Gmail Dot")
        let appStatus = 'AVAILABLE';
        let foundPresence = false;

        try {
            const chatRes = await fetch('https://chat.googleapis.com/v1/users/me/presence', {
                headers: { 'Authorization': `Bearer ${session.accessToken}` },
                cache: 'no-store'
            });

            if (chatRes.ok) {
                const chatData = await chatRes.json();

                if (chatData.presence === 'DO_NOT_DISTURB') {
                    appStatus = 'DO_NOT_DISTURB';
                    foundPresence = true;
                } else if (chatData.presence === 'AWAY' || chatData.presence === 'OFFLINE') {
                    appStatus = 'APPEAR_OFFLINE';
                    foundPresence = true;
                } else if (chatData.presence === 'ONLINE') {
                    appStatus = 'AVAILABLE';
                    foundPresence = true;
                }
            }
        } catch (e) {
            // Squelch errors for stability
        }


        if (!foundPresence) {
            console.log('[Sync] No presence data found.');
            // If we failed to get presence, we should NOT fall back to Calendar per user request.
            // We return success: false so the frontend doesn't update (avoiding spam/flicker)
            return NextResponse.json({
                success: false,
                message: "Could not fetch Google Status"
            });
        }

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
