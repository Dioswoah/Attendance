// @ts-nocheck
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { sendLeaveStatusUpdateEmail, sendLeaveActionEmail } from "@/lib/email"
import { broadcastUpdate } from "@/lib/eventBus"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const body = await req.json()
        const session = await auth() as any

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // 1. Try to find LeaveRequest
        const leaveRequest = await prisma.leaveRequest.findUnique({
            where: { id },
            include: { user: { include: { manager: true } } }
        })

        if (leaveRequest) {
            const isManager = session.user.id !== leaveRequest.userId // Or check role 'MANAGER' | 'ADMIN'

            // Update Request
            const updatedRequest = await prisma.leaveRequest.update({
                where: { id },
                data: {
                    status: body.status,
                    declineReason: body.declineReason,
                    // @ts-ignore
                    isArchived: body.isArchived,
                    // Allow editing pending request details?
                    startDate: body.startDate ? new Date(body.startDate) : undefined,
                    endDate: body.endDate ? new Date(body.endDate) : undefined,
                    reason: body.reason,
                    type: body.type,
                    duration: body.duration,
                    startTime: body.startTime ? new Date(body.startTime) : undefined,
                    endTime: body.endTime ? new Date(body.endTime) : undefined,
                },
                include: { user: true }
            })

            // If Approved, Create OFFICIAL LEAVE record
            if (body.status === 'APPROVED' && leaveRequest.status !== 'APPROVED') {
                // Create Leave
                await prisma.leave.create({
                    data: {
                        userId: leaveRequest.userId,
                        startDate: updatedRequest.startDate,
                        endDate: updatedRequest.endDate,
                        type: updatedRequest.type,
                        reason: updatedRequest.reason,
                        status: 'APPROVED',
                        duration: updatedRequest.duration,
                        startTime: updatedRequest.startTime,
                        endTime: updatedRequest.endTime,
                    }
                })
            }

            // Notifications (Reuse logic or simplify)
            // Notify User
            await prisma.notification.create({
                data: {
                    userId: updatedRequest.userId,
                    title: `Leave Request ${updatedRequest.status}`,
                    message: updatedRequest.status === 'APPROVED' ? "Your leave request has been approved." : `Your leave request has been declined/updated.`,
                    type: "LEAVE_STATUS",
                    link: "/leaves"
                }
            })

            // Email to User
            if (session.accessToken && session.user.email) {
                await sendLeaveStatusUpdateEmail({
                    userName: updatedRequest.user.name || "Employee",
                    userEmail: updatedRequest.user.email,
                    managerName: session.user.name || "Manager",
                    managerEmail: session.user.email,
                    managerAccessToken: session.accessToken,
                    leaveType: updatedRequest.type,
                    startDate: new Date(updatedRequest.startDate).toLocaleDateString(),
                    endDate: new Date(updatedRequest.endDate).toLocaleDateString(),
                    status: updatedRequest.status as 'APPROVED' | 'DECLINED',
                    updatedAt: new Date().toLocaleDateString(),
                    declineReason: updatedRequest.declineReason || undefined
                })
            }

            broadcastUpdate('leaves', updatedRequest)
            return NextResponse.json(updatedRequest)
        }

        // 2. Fallback: Check if it is an existing Leave (Direct Amendment)
        const currentLeave = await prisma.leave.findUnique({
            where: { id },
            include: {
                user: {
                    include: {
                        manager: true
                    }
                }
            }
        })

        if (!currentLeave) {
            return NextResponse.json({ error: "Leave/Request not found" }, { status: 404 })
        }

        // Existing LEAVE Amendment Logic (Original Logic)
        const isManager = session.user.id !== currentLeave.userId

        let updatedLeave

        if (isManager) {
            updatedLeave = await prisma.leave.update({
                where: { id },
                data: {
                    status: body.status,
                    declineReason: body.declineReason,
                    // @ts-ignore
                    isArchived: body.isArchived,
                    startDate: body.startDate ? new Date(body.startDate) : undefined,
                    endDate: body.endDate ? new Date(body.endDate) : undefined,
                    reason: body.reason,
                    type: body.type,
                    duration: body.duration,
                    startTime: body.startTime ? new Date(body.startTime) : undefined,
                    endTime: body.endTime ? new Date(body.endTime) : undefined,
                },
                include: { user: true }
            })

            await prisma.notification.create({
                data: {
                    userId: updatedLeave.userId,
                    title: `Leave Request ${updatedLeave.status}`,
                    message: updatedLeave.status === 'APPROVED' ? "Your leave request has been approved." : `Your leave request has been declined/updated.`,
                    type: "LEAVE_STATUS",
                    link: "/leaves"
                }
            })

            if (session.accessToken && session.user.email) {
                await sendLeaveStatusUpdateEmail({
                    userName: updatedLeave.user.name || "Employee",
                    userEmail: updatedLeave.user.email,
                    managerName: session.user.name || "Manager",
                    managerEmail: session.user.email,
                    managerAccessToken: session.accessToken,
                    leaveType: updatedLeave.type,
                    startDate: new Date(updatedLeave.startDate).toLocaleDateString(),
                    endDate: new Date(updatedLeave.endDate).toLocaleDateString(),
                    status: updatedLeave.status as 'APPROVED' | 'DECLINED',
                    updatedAt: new Date().toLocaleDateString(),
                    declineReason: updatedLeave.declineReason || undefined
                })
            }

            // NEW: Notify Manager if Admin is the one editing
            if (currentLeave.user.managerId && currentLeave.user.managerId !== session.user.id) {
                await prisma.notification.create({
                    data: {
                        userId: currentLeave.user.managerId,
                        title: "Staff Leave Modified",
                        message: `Leave request for ${updatedLeave.user.name} has been modified by an administrator.`,
                        type: "LEAVE_REQUEST",
                        link: "/admin/leaves"
                    }
                })

                if (session.accessToken && currentLeave.user.manager?.email) {
                    await sendLeaveActionEmail({
                        managerName: currentLeave.user.manager.name || "Manager",
                        managerEmail: currentLeave.user.manager.email,
                        userName: session.user.name || "Administrator",
                        userEmail: session.user.email,
                        userAccessToken: session.accessToken,
                        leaveType: updatedLeave.type,
                        startDate: new Date(updatedLeave.startDate).toLocaleDateString(),
                        endDate: new Date(updatedLeave.endDate).toLocaleDateString(),
                        action: 'UPDATED'
                    })
                }
            }

        } else {
            // User updating their own leave
            updatedLeave = await prisma.leave.update({
                where: { id },
                data: {
                    startDate: body.startDate ? new Date(body.startDate) : undefined,
                    endDate: body.endDate ? new Date(body.endDate) : undefined,
                    reason: body.reason,
                    type: body.type,
                    duration: body.duration,
                    startTime: body.startTime ? new Date(body.startTime) : undefined,
                    endTime: body.endTime ? new Date(body.endTime) : undefined,
                    // If user edits approved leave, what happens? Usually reset to pending?
                    // status: "PENDING" 
                    // But if it's separate model, user shouldn't edit 'Leave' directly often.
                    // Let's assume user edits revert to pending or simple update if allowed.
                },
                include: { user: { include: { manager: true } } }
            })

            if (updatedLeave.user.managerId) {
                await prisma.notification.create({
                    data: {
                        userId: updatedLeave.user.managerId,
                        title: "Leave Request Updated",
                        message: `${updatedLeave.user.name} has updated their leave request.`,
                        type: "LEAVE_REQUEST",
                        link: "/admin/leaves"
                    }
                })

                if (session.accessToken && updatedLeave.user.manager?.email) {
                    await sendLeaveActionEmail({
                        managerName: updatedLeave.user.manager.name || "Manager",
                        managerEmail: updatedLeave.user.manager.email,
                        userName: updatedLeave.user.name || "Employee",
                        userEmail: updatedLeave.user.email,
                        userAccessToken: session.accessToken,
                        leaveType: updatedLeave.type,
                        startDate: new Date(updatedLeave.startDate).toLocaleDateString(),
                        endDate: new Date(updatedLeave.endDate).toLocaleDateString(),
                        action: 'UPDATED'
                    })
                }
            }
        }

        // NEW: Notify Admins if Manager is modifying history
        const isAdmin = session.user.roles?.includes('ADMIN')
        if (!isAdmin && session.user.id !== updatedLeave.userId) {
            const admins = await prisma.user.findMany({ where: { roles: { has: 'ADMIN' } } })
            for (const admin of admins) {
                await prisma.notification.create({
                    data: {
                        userId: admin.id,
                        title: "Manager Modified History",
                        message: `${session.user.name} has modified an approved leave for ${updatedLeave.user.name}.`,
                        type: "LEAVE_STATUS",
                        link: "/admin/leaves"
                    }
                })
            }
        }

        broadcastUpdate('leaves', updatedLeave)
        return NextResponse.json(updatedLeave)
    } catch (error) {
        return NextResponse.json({ error: "Failed to update leave" }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const session = await auth() as any
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // 1. Try to find LeaveRequest
        const leaveRequest = await prisma.leaveRequest.findUnique({
            where: { id },
            include: { user: { include: { manager: true } } }
        })

        if (leaveRequest) {
            const roles = (session.user as any).roles || []
            const isAdmin = roles.includes('ADMIN')
            const isManager = leaveRequest.user.managerId === session.user.id

            if (leaveRequest.userId !== session.user.id && !isAdmin && !isManager) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
            }

            await prisma.leaveRequest.update({
                where: { id },
                data: { deletedAt: new Date() }
            })

            // Notifications for LeaveRequest deletion
            if (leaveRequest.userId !== session.user.id) {
                // Admin/Manager deleting user request
                await prisma.notification.create({
                    data: {
                        userId: leaveRequest.userId,
                        title: "Leave Request Removed",
                        message: "Your leave request has been removed by an administrator.",
                        type: "LEAVE_CANCELLED",
                        link: "/leaves"
                    }
                })
            } else {
                // User deleting their own request
                if (leaveRequest.user.managerId) {
                    await prisma.notification.create({
                        data: {
                            userId: leaveRequest.user.managerId,
                            title: "Leave Request Cancelled",
                            message: `${leaveRequest.user.name} has cancelled their leave request.`,
                            type: "LEAVE_CANCELLED",
                            link: "/admin/leaves"
                        }
                    })
                }
            }

            broadcastUpdate('leaves', { id, deleted: true })
            return NextResponse.json({ success: true })
        }

        // 2. Fallback to Leave
        const leave = await prisma.leave.findUnique({
            where: { id },
            include: { user: { include: { manager: true } } }
        })

        if (!leave) return NextResponse.json({ error: "Not found" }, { status: 404 })

        // Check permissions
        const roles = (session.user as any).roles || []
        const isAdmin = roles.includes('ADMIN')
        const isManager = leave.user.managerId === session.user.id

        if (leave.userId !== session.user.id && !isAdmin && !isManager) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        await prisma.leave.update({
            where: { id },
            data: { deletedAt: new Date() }
        })

        if (leave.userId !== session.user.id) {
            // Admin/Manager Deleting User's Leave
            // 1. Notify User
            await prisma.notification.create({
                data: {
                    userId: leave.userId,
                    title: "Leave Request Removed",
                    message: "Your leave request has been removed by an administrator.",
                    type: "LEAVE_CANCELLED",
                    link: "/leaves"
                }
            })

            if (session.accessToken && leave.user.email) {
                // Reuse status update email or action email? Action email seems generic enough.
                await sendLeaveActionEmail({
                    managerName: session.user.name || "Administrator",
                    managerEmail: session.user.email,
                    userName: leave.user.name || "Employee",
                    userEmail: leave.user.email, // Send TO user
                    userAccessToken: session.accessToken, // From Admin
                    leaveType: leave.type,
                    startDate: new Date(leave.startDate).toLocaleDateString(),
                    endDate: new Date(leave.endDate).toLocaleDateString(),
                    action: 'CANCELLED'
                })
            }

            // 2. Notify Manager (if exists and not the one deleting)
            if (leave.user.managerId && leave.user.managerId !== session.user.id) {
                await prisma.notification.create({
                    data: {
                        userId: leave.user.managerId,
                        title: "Staff Leave Removed",
                        message: `Leave request for ${leave.user.name} has been removed by an administrator.`,
                        type: "LEAVE_CANCELLED",
                        link: "/admin/leaves"
                    }
                })

                if (session.accessToken && leave.user.manager?.email) {
                    await sendLeaveActionEmail({
                        managerName: leave.user.manager.name || "Manager", // Receiver name for context? No, function expects managerName as "Sender" usually, but here we are notifying manager.
                        // Let's swap generic usages:
                        // We are sending TO the manager.
                        // "managerName" in the email template is "Hi [managerName]".
                        managerEmail: leave.user.manager.email,
                        userName: session.user.name || "Administrator", // The "Sender"
                        userEmail: session.user.email,
                        userAccessToken: session.accessToken,
                        leaveType: leave.type,
                        startDate: new Date(leave.startDate).toLocaleDateString(),
                        endDate: new Date(leave.endDate).toLocaleDateString(),
                        action: 'CANCELLED'
                    })
                }
            }
        } else {
            // User Deleting Own Leave (Existing Logic)
            if (leave.user.managerId) {
                await prisma.notification.create({
                    data: {
                        userId: leave.user.managerId,
                        title: "Leave Request Cancelled",
                        message: `${leave.user.name} has cancelled their leave request.`,
                        type: "LEAVE_CANCELLED",
                        link: "/admin/leaves"
                    }
                })

                if (session.accessToken && leave.user.manager?.email) {
                    await sendLeaveActionEmail({
                        managerName: leave.user.manager.name || "Manager",
                        managerEmail: leave.user.manager.email,
                        userName: leave.user.name || "Employee",
                        userEmail: leave.user.email,
                        userAccessToken: session.accessToken,
                        leaveType: leave.type,
                        startDate: new Date(leave.startDate).toLocaleDateString(),
                        endDate: new Date(leave.endDate).toLocaleDateString(),
                        action: 'CANCELLED'
                    })
                }
            }
        }

        // NEW: Notify Admins if Manager is deleting history
        const isAdminSession = session.user.roles?.includes('ADMIN')
        const targetLeave = leave || (leaveRequest as any)
        if (!isAdminSession && session.user.id !== targetLeave.userId) {
            const admins = await prisma.user.findMany({ where: { roles: { has: 'ADMIN' } } })
            for (const admin of admins) {
                await prisma.notification.create({
                    data: {
                        userId: admin.id,
                        title: "Manager Deleted History",
                        message: `${session.user.name} has deleted an approved/denied leave for ${targetLeave.user?.name || 'User'}.`,
                        type: "LEAVE_CANCELLED",
                        link: "/admin/leaves"
                    }
                })
            }
        }

        broadcastUpdate('leaves', { id, deleted: true })
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete leave" }, { status: 500 })
    }
}
