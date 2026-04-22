// @ts-nocheck
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { sendLeaveStatusUpdateEmail, sendLeaveActionEmail, sendGeneralEmail } from "@/lib/email"
import { broadcastUpdate } from "@/lib/eventBus"
import { notifyRole } from "@/lib/notifications"
import { logActivity, updateAttendanceSummary } from '@/lib/db-utils'

async function updateRangeSummaries(userId, startDate, endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const current = new Date(start)
    while (current <= end) {
        await updateAttendanceSummary(userId, new Date(current))
        current.setDate(current.getDate() + 1)
    }
}

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
            const roles = session.user.roles || []
            const isAdmin = roles.includes('ADMIN')
            const isTargetManager = leaveRequest.user.managerId === session.user.id
            const isManager = isAdmin || isTargetManager
            const isUserEditing = session.user.id === leaveRequest.userId && !isManager

            // Update Request
            const updatedRequest = await prisma.leaveRequest.update({
                where: { id },
                data: {
                    status: isUserEditing ? "PENDING" : (body.status || leaveRequest.status),
                    declineReason: isUserEditing ? null : (body.declineReason || leaveRequest.declineReason),
                    // @ts-ignore
                    isArchived: body.isArchived !== undefined ? body.isArchived : leaveRequest.isArchived,
                    startDate: body.startDate ? new Date(body.startDate) : undefined,
                    endDate: body.endDate ? new Date(body.endDate) : undefined,
                    reason: body.reason !== undefined ? body.reason : leaveRequest.reason,
                    type: body.type !== undefined ? body.type : leaveRequest.type,
                    duration: body.duration !== undefined ? body.duration : leaveRequest.duration,
                    startTime: body.startTime !== undefined ? (body.startTime ? new Date(body.startTime) : null) : undefined,
                    endTime: body.endTime !== undefined ? (body.endTime ? new Date(body.endTime) : null) : undefined,
                },
                include: { user: true }
            })

            // If user edited an APPROVED request, we MUST soft-delete the existing official Leave record
            if (isUserEditing && leaveRequest.status === 'APPROVED') {
                await prisma.leave.updateMany({
                    where: {
                        userId: leaveRequest.userId,
                        startDate: leaveRequest.startDate,
                        endDate: leaveRequest.endDate,
                        type: leaveRequest.type,
                        deletedAt: null
                    },
                    data: { deletedAt: new Date() }
                })
            }

            // If Manager Approved, Create OFFICIAL LEAVE record
            if (!isUserEditing && body.status === 'APPROVED' && leaveRequest.status !== 'APPROVED') {
                // Create Leave
                const newLeave = await prisma.leave.create({
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

                // Notify Admin about Manager Approval
                if (isManager && !isAdmin) {
                    await notifyRole("ADMIN", "Manager Approval", `Manager ${session.user.name} approved leave for ${updatedRequest.user.name}.`, "INFO");

                    const admins = await prisma.user.findMany({ where: { roles: { has: 'ADMIN' }, email: { not: null } } });
                    for (const admin of admins) {
                        if (session.accessToken) {
                            await sendGeneralEmail({
                                toEmail: admin.email!,
                                subject: "Manager Approved Leave",
                                title: "Leave Approved",
                                message: `Manager ${session.user.name} has approved a leave request for ${updatedRequest.user.name} (${updatedRequest.type}).`,
                                accessToken: session.accessToken,
                                refreshToken: session.refreshToken,
                                link: `https://attendance-app-712513641417.us-central1.run.app/admin/leaves`
                            });
                        }
                    }
                }
            }

            // --- Log & Summary ---
            await updateRangeSummaries(updatedRequest.userId, updatedRequest.startDate, updatedRequest.endDate)
            await logActivity({
                userId: updatedRequest.userId,
                action: isUserEditing ? 'LEAVE_EDIT' : `LEAVE_${updatedRequest.status}`,
                entityType: 'LEAVE',
                entityId: id,
                details: {
                    actor: session.user.name,
                    status: updatedRequest.status,
                    type: updatedRequest.type,
                    dateRange: `${updatedRequest.startDate.toLocaleDateString()} - ${updatedRequest.endDate.toLocaleDateString()}`,
                    adminRefreshToken: session.refreshToken
                }
            })

            // Notifications
            if (isUserEditing) {
                if (updatedRequest.user.managerId) {
                    await prisma.notification.create({
                        data: {
                            userId: updatedRequest.user.managerId,
                            title: "Leave Request Updated",
                            message: `${updatedRequest.user.name} has updated their leave request.`,
                            type: "LEAVE_REQUEST",
                            link: "/admin/leaves"
                        }
                    })

                    if (session.accessToken && updatedRequest.user.manager?.email) {
                        await sendLeaveActionEmail({
                            managerName: updatedRequest.user.manager.name || "Manager",
                            managerEmail: updatedRequest.user.manager.email,
                            userName: updatedRequest.user.name || "Employee",
                            userEmail: updatedRequest.user.email,
                            userAccessToken: session.accessToken,
                            leaveType: updatedRequest.type,
                            startDate: new Date(updatedRequest.startDate).toLocaleDateString(),
                            endDate: new Date(updatedRequest.endDate).toLocaleDateString(),
                            action: 'UPDATED',
                            refreshToken: session.refreshToken
                        })
                    }
                }
            } else {
                await prisma.notification.create({
                    data: {
                        userId: updatedRequest.userId,
                        title: `Leave Request ${updatedRequest.status}`,
                        message: updatedRequest.status === 'APPROVED' ? "Your leave request has been approved." : `Your leave request has been declined/updated.`,
                        type: "LEAVE_STATUS",
                        link: "/leaves"
                    }
                })

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
                        declineReason: updatedRequest.declineReason || undefined,
                        managerRefreshToken: session.refreshToken
                    })
                }

                // Notify manager if actor is not the manager (i.e. admin acted on it)
                const mgr = updatedRequest.user.manager
                if (mgr && mgr.id !== session.user.id) {
                    await prisma.notification.create({
                        data: {
                            userId: mgr.id,
                            title: `Leave Request ${updatedRequest.status} by Admin`,
                            message: `${session.user.name || 'Admin'} has ${updatedRequest.status.toLowerCase()} a ${updatedRequest.type} leave request for ${updatedRequest.user.name} (${new Date(updatedRequest.startDate).toLocaleDateString()} - ${new Date(updatedRequest.endDate).toLocaleDateString()}).`,
                            type: "ADMIN_ACTION",
                            link: "/user/manager?tab=calendar"
                        }
                    })
                    broadcastUpdate('notification', { userId: mgr.id })
                    if (session.accessToken && mgr.email) {
                        const mgrAccount = await prisma.account.findFirst({ where: { userId: mgr.id, provider: 'google' } })
                        await sendLeaveStatusUpdateEmail({
                            userName: mgr.name || "Manager",
                            userEmail: mgr.email,
                            managerName: session.user.name || "Admin",
                            managerEmail: session.user.email,
                            managerAccessToken: mgrAccount?.access_token || session.accessToken,
                            leaveType: `${updatedRequest.type} leave for ${updatedRequest.user.name}`,
                            startDate: new Date(updatedRequest.startDate).toLocaleDateString(),
                            endDate: new Date(updatedRequest.endDate).toLocaleDateString(),
                            status: updatedRequest.status as 'APPROVED' | 'DECLINED',
                            updatedAt: new Date().toLocaleDateString(),
                            declineReason: updatedRequest.declineReason || undefined,
                            customTitle: 'Staff Leave Decision by Admin'
                        })
                    }
                }
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

        const isManager = session.user.id !== currentLeave.userId
        let updatedLeave

        if (isManager) {
            updatedLeave = await prisma.leave.update({
                where: { id },
                data: {
                    status: body.status,
                    declineReason: body.declineReason,
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
                    declineReason: updatedLeave.declineReason || undefined,
                    managerRefreshToken: session.refreshToken
                })
            }

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
                        action: 'UPDATED',
                        refreshToken: session.refreshToken
                    })
                }
            }

        } else {
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
                        action: 'UPDATED',
                        refreshToken: session.refreshToken
                    })
                }
            }
        }

        // --- Log & Summary ---
        await updateRangeSummaries(updatedLeave.userId, updatedLeave.startDate, updatedLeave.endDate)
        await logActivity({
            userId: updatedLeave.userId,
            action: isManager ? 'ADMIN_LEAVE_EDIT' : 'LEAVE_EDIT',
            entityType: 'LEAVE',
            entityId: id,
            details: {
                actor: session.user.name,
                status: updatedLeave.status,
                type: updatedLeave.type
            }
        })

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

            // --- Log & Summary ---
            await updateRangeSummaries(leaveRequest.userId, leaveRequest.startDate, leaveRequest.endDate)
            await logActivity({
                userId: leaveRequest.userId,
                action: 'LEAVE_CANCEL',
                entityType: 'LEAVE_REQUEST',
                entityId: id,
                details: { actor: session.user.name }
            })

            broadcastUpdate('leaves', { id, deleted: true })
            return NextResponse.json({ success: true })
        }

        const leave = await prisma.leave.findUnique({
            where: { id },
            include: { user: { include: { manager: true } } }
        })

        if (!leave) return NextResponse.json({ error: "Not found" }, { status: 404 })

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

        // --- Log & Summary ---
        await updateRangeSummaries(leave.userId, leave.startDate, leave.endDate)
        await logActivity({
            userId: leave.userId,
            action: 'LEAVE_DELETE',
            entityType: 'LEAVE',
            entityId: id,
            details: { actor: session.user.name }
        })

        broadcastUpdate('leaves', { id, deleted: true })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("DELETE leave error:", error)
        return NextResponse.json({ error: "Failed to delete leave" }, { status: 500 })
    }
}
