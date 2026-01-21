
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { sendLeaveStatusUpdateEmail } from "@/lib/email"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const body = await req.json()
        const { status, declineReason } = body // APPROVED or DECLINED
        const session = await auth() as any

        // Fetch request
        const request = await prisma.attendanceRequest.findUnique({
            where: { id },
            include: { user: { include: { manager: true } } }
        })
        if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })

        // Update Request
        const updatedRequest = await prisma.attendanceRequest.update({
            where: { id },
            data: {
                status,
                declineReason
            }
        })

        if (status === 'APPROVED') {
            // Update Attendance
            const startDate = new Date(request.date)
            startDate.setHours(0, 0, 0, 0)
            const endDate = new Date(startDate)
            endDate.setDate(endDate.getDate() + 1)

            let attendance = await prisma.attendance.findFirst({
                where: {
                    userId: request.userId,
                    date: {
                        gte: startDate,
                        lt: endDate
                    }
                }
            })

            const updateData: any = {}
            if (request.type === 'CLOCK_IN') updateData.clockIn = request.time
            if (request.type === 'CLOCK_OUT') updateData.clockOut = request.time
            if (request.type === 'BREAK_START') updateData.breakStart = request.time
            if (request.type === 'BREAK_END') updateData.breakEnd = request.time

            if (request.type === 'CLOCK_IN' && (!attendance || attendance.status === 'ABSENT')) {
                updateData.status = 'PRESENT'
            }

            if (attendance) {
                await prisma.attendance.update({
                    where: { id: attendance.id },
                    data: updateData
                })
            } else {
                await prisma.attendance.create({
                    data: {
                        userId: request.userId,
                        date: startDate,
                        status: updateData.status || 'PRESENT',
                        ...updateData
                    }
                })
            }
        }

        // Notify User
        await prisma.notification.create({
            data: {
                userId: request.userId,
                title: `Correction Request ${status}`,
                message: `Your attendance correction request has been ${status.toLowerCase()}.`,
                type: "LEAVE_STATUS",
                link: "/user/amend-records"
            }
        })

        if (session?.accessToken && request.user.email) {
            await sendLeaveStatusUpdateEmail({
                userName: request.user.name || "Employee",
                userEmail: request.user.email,
                managerName: session.user.name || "Manager",
                managerEmail: session.user.email,
                managerAccessToken: session.accessToken,
                leaveType: `Correction: ${request.type}`,
                startDate: new Date(request.date).toLocaleDateString(),
                endDate: new Date(request.date).toLocaleDateString(),
                status: status as 'APPROVED' | 'DECLINED',
                updatedAt: new Date().toLocaleDateString(),
                declineReason: declineReason
            })
        }

        // @ts-ignore
        if (global.io) global.io.emit('update-data')
        return NextResponse.json(updatedRequest)

    } catch (e) {
        console.error(e)
        return NextResponse.json({ error: "Failed" }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        await prisma.attendanceRequest.update({
            where: { id },
            data: { deletedAt: new Date() }
        })
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
    }
}
