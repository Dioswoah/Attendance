import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from "@/auth"
import { sendBreakLimitEmail } from "@/lib/email"
import { broadcastUpdate } from "@/lib/eventBus"

export async function POST(req: Request) {
    const session = await auth() as any
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const { type, totalBreakTime, limit } = await req.json()
        const userId = session.user.id

        // 1. Create In-App Notification
        const notification = await prisma.notification.create({
            data: {
                userId,
                title: type === 'WARNING' ? "Break Schedule Update" : "Break Time Check-in",
                message: type === 'WARNING'
                    ? `Just a gentle reminder that you have about 15 minutes remaining for your break.`
                    : `It appears your break time has extended slightly beyond the daily allocation. Please check in when you can.`,
                type: "BREAK_LIMIT",
                link: "/user"
            }
        })

        // 2. Broadcast for real-time bell
        broadcastUpdate('notification', { userId })

        // 3. Send email for both Warning and Exceeded types
        if (session.accessToken) {
            await sendBreakLimitEmail({
                userName: session.user.name || "Employee",
                userEmail: session.user.email,
                userAccessToken: session.accessToken,
                totalBreakTime,
                limit,
                isWarning: type === 'WARNING'
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Break limit API error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
