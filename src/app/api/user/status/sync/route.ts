import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from "@/auth"
import { broadcastUpdate } from "@/lib/eventBus"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const token = (session as any).accessToken
        if (!token) {
            return NextResponse.json({ error: "No Google Access Token" }, { status: 400 })
        }

        let googleStatus = 'AVAILABLE';
        let customMessage = '';

        try {
            // Check Google Calendar for current status (Busy/OOO)
            // Chat Presence API is not public, so we infer from Calendar Events.
            const now = new Date().toISOString()
            const timeMin = new Date().toISOString()
            const timeMax = new Date(Date.now() + 60000).toISOString() // 1 minute window

            const calRes = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (calRes.ok) {
                const calData = await calRes.json();
                const events = calData.items || [];

                // Find priority event: OutOfOffice > Busy
                // Default transparency is 'opaque' (Busy) if not specified
                const activeEvent = events.find((e: any) => {
                    if (e.status === 'cancelled') return false;
                    const isOOO = e.eventType === 'outOfOffice';
                    const isBusy = !e.transparency || e.transparency === 'opaque';
                    return isOOO || isBusy;
                });

                if (activeEvent) {
                    if (activeEvent.eventType === 'outOfOffice') {
                        googleStatus = 'APPEAR_AWAY';
                        customMessage = activeEvent.summary || 'Out of Office';
                    } else {
                        // Busy means DND/In Meeting
                        googleStatus = 'DO_NOT_DISTURB';
                        customMessage = 'On going';
                    }
                } else {
                    googleStatus = 'AVAILABLE';
                }
            } else {
                console.error("[Sync] Calendar API Failed:", await calRes.text())
                // Fail silently for now to avoid breaking UI if scope missing
                return NextResponse.json({ status: 'unchanged', error: 'Calendar API Error' })
            }
        } catch (e) {
            console.error("[Sync] Network Error:", e)
            return NextResponse.json({ status: 'unchanged', error: 'Network Error' })
        }

        // Update DB
        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                availabilityStatus: googleStatus as any,
                customStatusMessage: customMessage || null
            }
        })

        broadcastUpdate('staff', {
            userId: session.user.id,
            availabilityStatus: googleStatus,
            customStatusMessage: customMessage || null
        })

        return NextResponse.json({
            status: googleStatus,
            customMessage,
            synced: true
        })

    } catch (error) {
        console.error("[Sync] Internal Error:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
