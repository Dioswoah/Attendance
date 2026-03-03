import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { sendGeneralEmail } from "@/lib/email"
import { broadcastUpdate } from "@/lib/eventBus"

export async function POST(req: Request) {
    try {
        const session = await auth() as any
        if (!session?.user?.id || !session.user.roles?.includes('ADMIN')) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const { userIds, type, customMessage, customSubject, customTitle, deliveryMethod = "BOTH" } = body

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return NextResponse.json({ error: "No users selected" }, { status: 400 })
        }

        const users = await prisma.user.findMany({
            where: { id: { in: userIds } }
        })

        if (!users.length) {
            return NextResponse.json({ error: "Users not found" }, { status: 404 })
        }

        const adminAccount = await prisma.account.findFirst({
            where: {
                userId: session.user.id,
                provider: 'google'
            }
        });

        // Prefer active session token as it's refreshed by NextAuth, fallback to DB
        const activeAccessToken = session?.accessToken || adminAccount?.access_token;
        const activeRefreshToken = session?.refreshToken || adminAccount?.refresh_token;

        if (!activeAccessToken) {
            return NextResponse.json({ error: "Admin Google account not linked properly. Please sign in again to refresh your connection." }, { status: 400 })
        }

        let notificationsCreated = 0;

        for (const user of users) {
            let title = "Admin Notification"
            let message = ""
            let notifType = "SYSTEM"
            let subject = "[RSA] Administrative Prompt"

            switch (type) {
                case "LATE_ARRIVAL":
                    title = "Time to Clock In?"
                    subject = "Check In: Start Your Shift?"
                    message = "Just checking in — we noticed you haven't clocked in yet. If you're already online and simply forgot, you can clock in immediately via your dashboard. If you're running late or on leave, feel free to ignore this safely!"
                    notifType = "LATE_REMINDER"
                    break;
                case "OVERDUE_DEPARTURE":
                    title = "Shift Wrap-Up"
                    subject = "Check Out Reminder: Shift Ended?"
                    message = "Just a friendly reminder to check if your shift has ended, but you're still clocked in. If you're all done for the day, please remember to clock out. If you're working a little late, no problem at all!"
                    notifType = "OVERDUE_REMINDER"
                    break;
                case "FORGOTTEN_CLOCKOUT":
                    title = "System Auto-Clock Out"
                    subject = "Friendly Reminder: Missed Clock Out"
                    message = "Hello! We noticed that you may have forgotten to clock out recently. Please verify your attendance logs and request an amend record if needed."
                    notifType = "SYSTEM"
                    break;
                case "BREAK_RETURN":
                    title = "Break Time Check-in"
                    subject = "Quick Check-in: Break Status"
                    message = "Hope you're having a good break! Just sending a quick, friendly ping regarding your break time. If you're refreshed and ready to jump back in, you can easily end your break via your dashboard."
                    notifType = "BREAK_LIMIT"
                    break;
                case "CUSTOM":
                    title = customTitle || "Important Notice"
                    subject = customSubject ? customSubject.replace(/^\[RSA\]\s*/i, '') : "Important Notice from Administration"
                    message = customMessage || "You have a new message from administration."
                    notifType = "SYSTEM"
                    break;
                default:
                    message = customMessage || "You have a new administrative notice."
            }

            // Log the notification in the database (always)
            // If it's EMAIL only, we mark it as "read" immediately so it doesn't trigger an unread badge for the user in-app.
            const dbNotification = await prisma.notification.create({
                data: {
                    userId: user.id,
                    title: title,
                    message: message,
                    type: notifType,
                    link: "/user",
                    read: deliveryMethod === "EMAIL" // Mark as read if it's strictly an email to prevent in-app badge
                }
            })

            // In-App Real-time Broadcast
            if (deliveryMethod === "BOTH" || deliveryMethod === "IN_APP") {
                broadcastUpdate('notification', { userId: user.id })
            }

            // Email Notification
            if ((deliveryMethod === "BOTH" || deliveryMethod === "EMAIL") && user.email && activeAccessToken) {
                const appUrl = process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app'
                await sendGeneralEmail({
                    toEmail: user.email,
                    subject: subject,
                    title: title,
                    message: `Hi <strong>${user.name}</strong>,<br/><br/>${message}`,
                    link: `${appUrl}/user`,
                    linkText: "View Dashboard",
                    accessToken: activeAccessToken,
                    refreshToken: activeRefreshToken || undefined
                })
            }
            notificationsCreated++;
        }

        return NextResponse.json({ message: "Notifications sent successfully", count: notificationsCreated })
    } catch (error: any) {
        console.error("Error triggering notifications:", error)
        return NextResponse.json({
            error: error.message || "Failed to send notifications. Try signing out and back in if sending emails."
        }, { status: 500 })
    }
}

