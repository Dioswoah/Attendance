import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from "@/auth"
import { syncCalendarStatusForUser } from "@/lib/status-sync"

// Per-user browser poll: syncs the LOGGED-IN user's availability from their
// Google Calendar. Delegates to the shared helper so it can never disagree
// with the server-side cron (/api/cron/status-sync), which uses the exact
// same derivation. (Marc, 2026-07-22 — consolidated the two duplicate
// calendar-sync routes that used to race.)
export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const token = (session as any).accessToken
        if (!token) {
            return NextResponse.json({ status: 'unchanged', error: "No Google Access Token" })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { selectedTimezone: true, availabilityStatus: true },
        })

        const result = await syncCalendarStatusForUser({
            userId: session.user.id,
            accessToken: token,
            timezone: user?.selectedTimezone || 'UTC',
            currentStatus: user?.availabilityStatus ?? null,
        })

        return NextResponse.json({ status: result.status, synced: true, changed: result.changed })
    } catch (error) {
        console.error("[Sync] Internal Error:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
