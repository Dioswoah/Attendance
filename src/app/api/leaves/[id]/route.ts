import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"


export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const body = await req.json()

        // 1. Get the Current Manager's Session (Who is performing the approval)
        const session = await auth() as any
        const managerId = session?.user?.id
        const managerAccessToken = session?.accessToken

        const leave = await prisma.leave.update({
            where: { id },
            data: {
                status: body.status,
                declineReason: body.declineReason // Add decline reason
            },
            include: { user: true }
        })

        // Notify User (In-App)
        const message = leave.status === 'APPROVED'
            ? "Your leave request has been approved."
            : `Your leave request has been declined. Reason: ${leave.declineReason || 'No reason provided'}`;

        await prisma.notification.create({
            data: {
                userId: leave.userId,
                title: `Leave Request ${leave.status}`,
                message: message,
                type: "LEAVE_STATUS",
                link: "/leaves" // Assuming user checks here
            }
        })

        // Send Email Notification to User (From Manager)
        if (managerAccessToken && session?.user?.email) {
            // Need manager's details for the "From" field matching the token
            // We can trust session.user for name/email
            const managerName = session.user.name || "Manager"
            const managerEmail = session.user.email

            // Import dynamically or ensure it's imported at top
            const { sendLeaveStatusUpdateEmail } = await import("@/lib/email")

            await sendLeaveStatusUpdateEmail({
                userName: leave.user.name || "Employee",
                userEmail: leave.user.email,
                managerName,
                managerEmail,
                managerAccessToken,
                leaveType: leave.type,
                startDate: new Date(leave.startDate).toLocaleDateString(),
                endDate: new Date(leave.endDate).toLocaleDateString(),
                status: leave.status as 'APPROVED' | 'DECLINED',
                updatedAt: new Date().toLocaleDateString(),
                declineReason: leave.declineReason || undefined
            })
        } else {
            console.warn("[Leave PATCH] Cannot send email: Missing manager session or access token")
        }


        // Notification Code block removed to comply with "only the manager assigned on that user" rule
        // The user receives a notification (above), and the email (above).
        // No other admins are notified unless they are the manager.

        // @ts-ignore
        if (global.io) global.io.emit('update-data')
        return NextResponse.json(leave)
    } catch (error) {
        console.error("Failed to update leave:", error)
        return NextResponse.json({ error: "Failed to update leave" }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        await prisma.leave.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete leave" }, { status: 500 })
    }
}
