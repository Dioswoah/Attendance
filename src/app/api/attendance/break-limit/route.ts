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
        const userEmail = session.user.email
        const userName = session.user.name

        // Find today's active attendance
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const attendance = await prisma.attendance.findFirst({
            where: {
                userId,
                date: { gte: today },
                clockOut: null
            }
        });

        if (!attendance) {
            return NextResponse.json({ error: "No active attendance found" }, { status: 404 });
        }

        // Check flags to prevent duplicate notifications
        if (type === 'WARNING' && attendance.breakWarningSent) {
            return NextResponse.json({ success: true, message: "Already warned" });
        }
        if (type === 'EXCEEDED' && attendance.breakLimitExceededSent) {
            return NextResponse.json({ success: true, message: "Already notified limit" });
        }

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

        // 3. Send email for both Warning and Exceeded types (with check)
        const actionLink = `https://attendance-app-712513641417.us-central1.run.app/user?action=endBreak`;
        await sendBreakLimitEmail({
            userName: userName || "Employee",
            userEmail: userEmail,
            userAccessToken: session.accessToken || '', // Fallback empty string if not available
            refreshToken: session.refreshToken || '',
            totalBreakTime,
            limit,
            actionLink
        })

        // 4. Update Flags
        await prisma.attendance.update({
            where: { id: attendance.id },
            data: {
                breakWarningSent: type === 'WARNING' ? true : attendance.breakWarningSent,
                breakLimitExceededSent: type === 'EXCEEDED' ? true : attendance.breakLimitExceededSent
            }
        });

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Break limit API error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
