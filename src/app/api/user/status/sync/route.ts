import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from "@/auth"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const token = (session as any).accessToken
        if (!token) {
            // No token (maybe logged in with credentials?), can't sync.
            return NextResponse.json({ error: "No Google Access Token" }, { status: 400 })
        }

        let googleStatus = 'AVAILABLE';
        let customMessage = '';

        try {
            const chatRes = await fetch('https://chat.googleapis.com/v1/users/me/presence', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (chatRes.ok) {
                const chatData = await chatRes.json();

                // Map Google Status -> App Status
                if (chatData.presence === 'DO_NOT_DISTURB') googleStatus = 'DO_NOT_DISTURB';
                else if (chatData.presence === 'AWAY') googleStatus = 'APPEAR_AWAY';
                else if (chatData.presence === 'OFFLINE') googleStatus = 'APPEAR_OFFLINE';
                else googleStatus = 'AVAILABLE';

                if (chatData.customStatus?.status) {
                    customMessage = chatData.customStatus.status;
                }
            } else {
                console.error("[Sync] Google Chat API Failed:", await chatRes.text())
                return NextResponse.json({ status: 'unchanged', error: 'Google API Error' })
            }
        } catch (e) {
            console.error("[Sync] Network Error:", e)
            return NextResponse.json({ status: 'unchanged', error: 'Network Error' })
        }

        // Update DB
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                availabilityStatus: googleStatus as any,
                customStatusMessage: customMessage || null
            }
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
