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
                title: type === 'WARNING' ? "Break Time Warning" : "Break Limit Exceeded",
                message: type === 'WARNING'
                    ? `You have ${limit === '1 hour' ? '15 minutes' : 'minimal'} left on your daily break.`
                    : `You have exceeded your daily break limit of ${limit}.`,
                type: "BREAK_LIMIT",
                link: "/user"
            }
        })

        // 2. Broadcast for real-time bell
        broadcastUpdate('notification', { userId })

        // 3. If EXCEEDED, send email
        if (type === 'EXCEEDED' && session.accessToken) {
            await sendBreakLimitEmail({
                userName: session.user.name || "Employee",
                userEmail: session.user.email,
                userAccessToken: session.accessToken,
                totalBreakTime,
                limit
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Break limit API error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
