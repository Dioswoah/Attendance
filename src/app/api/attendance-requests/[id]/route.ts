import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { sendLeaveStatusUpdateEmail } from "@/lib/email"
import { broadcastUpdate } from "@/lib/eventBus"
import { logActivity, updateAttendanceSummary } from '@/lib/db-utils'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const body = await req.json()
        const session = await auth() as any
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        // Fetch request
        const request = await prisma.attendanceRequest.findUnique({
            where: { id },
            include: { user: { include: { manager: true } } }
        })
        if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })

        const roles = session.user.roles || []
        const isAdmin = roles.includes('ADMIN')
        const isManager = request.user.managerId === session.user.id
        const isUserEditing = session.user.id === request.userId && !isAdmin && !isManager

        // Update Request
        const timeZone = request.user.selectedTimezone || 'Asia/Manila'
        const newTime = body.time ? new Date(body.time) : new Date(request.time)
        const localDateStr = newTime.toLocaleDateString('en-CA', { timeZone })
        const normalizedDate = new Date(`${localDateStr}T00:00:00Z`)

        const updatedRequest = await prisma.attendanceRequest.update({
            where: { id },
            data: {
                status: isUserEditing ? "PENDING" : (body.status || request.status),
                declineReason: isUserEditing ? null : (body.declineReason || request.declineReason),
                time: body.time ? newTime : undefined,
                type: body.type !== undefined ? body.type : request.type,
                reason: body.reason !== undefined ? body.reason : request.reason,
                date: normalizedDate,
                // @ts-ignore
                isArchived: body.isArchived !== undefined ? body.isArchived : request.isArchived,
            }
        })

        const status = updatedRequest.status
        const declineReason = updatedRequest.declineReason

        if (status === 'APPROVED') {
            if (request.targetId) {
                if (['CLOCK_IN', 'CLOCK_OUT'].includes(request.type)) {
                    await prisma.attendance.update({
                        where: { id: request.targetId },
                        data: {
                            [request.type === 'CLOCK_IN' ? 'clockIn' : 'clockOut']: request.time,
                            status: 'PRESENT'
                        }
                    })
                } else if (['BREAK_START', 'BREAK_END'].includes(request.type)) {
                    await prisma.break.update({
                        where: { id: request.targetId },
                        data: {
                            [request.type === 'BREAK_START' ? 'startTime' : 'endTime']: request.time
                        }
                    })
                }
            } else {
                const startDate = new Date(request.date)
                startDate.setHours(0, 0, 0, 0)
                const endDate = new Date(startDate)
                endDate.setDate(endDate.getDate() + 1)

                let attendance = await prisma.attendance.findFirst({
                    where: {
                        userId: request.userId,
                        date: { gte: startDate, lt: endDate }
                    }
                })

                const updateData: any = {}
                if (attendance && attendance.notes === `PROVISIONAL_REQUEST:${request.id}`) {
                    updateData.notes = null
                }

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
        } else if (status === 'DECLINED' && request.type === 'CLOCK_IN') {
            const provisional = await prisma.attendance.findFirst({
                where: {
                    userId: request.userId,
                    notes: `PROVISIONAL_REQUEST:${request.id}`
                }
            })
            if (provisional) {
                await prisma.attendance.delete({
                    where: { id: provisional.id }
                })
            }
        }

        // --- Log & Summary ---
        await updateAttendanceSummary(request.userId, request.date)
        await logActivity({
            userId: request.userId,
            action: isUserEditing ? 'ATTENDANCE_REQUEST_EDIT' : `ATTENDANCE_REQUEST_${status}`,
            entityType: 'ATTENDANCE_REQUEST',
            entityId: id,
            details: { actor: session.user.name, status, type: request.type, date: request.date }
        })

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
                declineReason: declineReason || undefined
            })
        }

        broadcastUpdate('attendance', updatedRequest)
        return NextResponse.json(updatedRequest)

    } catch (e) {
        console.error(e)
        return NextResponse.json({ error: "Failed" }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const session = await auth()
        const request = await prisma.attendanceRequest.findUnique({
            where: { id }
        })
        if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })

        await prisma.attendanceRequest.update({
            where: { id },
            data: { deletedAt: new Date() }
        })

        const provisional = await prisma.attendance.findFirst({
            where: {
                userId: request.userId,
                notes: `PROVISIONAL_REQUEST:${id}`
            }
        })

        if (provisional) {
            if (provisional.clockOut) {
                const updateData: any = { notes: null }
                if (request.type === 'CLOCK_IN') updateData.clockIn = null
                if (request.type === 'BREAK_START') updateData.breakStart = null
                await prisma.attendance.update({
                    where: { id: provisional.id },
                    data: updateData
                })
            } else {
                await prisma.attendance.delete({
                    where: { id: provisional.id }
                })
            }
        }

        // --- Log & Summary ---
        await updateAttendanceSummary(request.userId, request.date)
        await logActivity({
            userId: request.userId,
            action: 'ATTENDANCE_REQUEST_DELETE',
            entityType: 'ATTENDANCE_REQUEST',
            entityId: id,
            details: { actor: session?.user?.name || "System" }
        })

        broadcastUpdate('attendance', { id, deleted: true })
        return NextResponse.json({ success: true })
    } catch (e) {
        console.error("Delete request error:", e)
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
    }
}
