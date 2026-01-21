
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { sendLeaveRequestEmail } from "@/lib/email"

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const managerId = searchParams.get('managerId')
    const status = searchParams.get('status')

    try {
        const requests = await prisma.attendanceRequest.findMany({
            where: {
                ...(userId && { userId }),
                ...(managerId && { user: { managerId } }),
                ...(status && { status }),
                deletedAt: null
            },
            include: { user: true },
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json(requests)
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { userId, date, type, time, reason } = body

        const request = await prisma.attendanceRequest.create({
            data: {
                userId,
                date: new Date(date),
                type,
                time: new Date(time),
                reason,
                status: 'PENDING'
            }
        })

        // Notify Manager
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { manager: true }
        }) as any

        const session = await auth() as any

        if (user?.managerId) {
            await prisma.notification.create({
                data: {
                    userId: user.managerId,
                    title: "Attendance Correction Request",
                    message: `${user.name} requesting correction for ${type} on ${new Date(date).toLocaleDateString()}`,
                    type: "LEAVE_REQUEST",
                    link: "/user/manager"
                }
            })

            // Send Email
            if (user.manager?.email && session?.accessToken) {
                await sendLeaveRequestEmail({
                    managerName: user.manager.name || "Manager",
                    managerEmail: user.manager.email,
                    userName: user.name || "Employee",
                    userEmail: user.email,
                    userAccessToken: session.accessToken,
                    leaveType: `Correction: ${type}`,
                    startDate: new Date(date).toLocaleDateString(),
                    endDate: new Date(date).toLocaleDateString(),
                    duration: new Date(time).toLocaleTimeString(),
                    reason: reason,
                    leaveId: request.id
                })
            }
        }

        // @ts-ignore
        if (global.io) global.io.emit('update-data')
        return NextResponse.json(request)
    } catch (error) {
        console.error("Failed to create attendance request:", error)
        return NextResponse.json({ error: "Failed to create request" }, { status: 500 })
    }
}
