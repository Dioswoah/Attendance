import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { broadcastUpdate } from "@/lib/eventBus"
import { auth } from "@/auth"
import { notifyUser, notifyRole } from "@/lib/notifications"
import { sendGeneralEmail } from "@/lib/email"
import { logActivity, updateAttendanceSummary } from '@/lib/db-utils'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const attendance = await prisma.attendance.findUnique({
            where: { id },
            include: {
                breaks: {
                    where: { deletedAt: null },
                    orderBy: { startTime: 'asc' }
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        department: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            }
        })

        if (!attendance) {
            return NextResponse.json({ error: "Attendance record not found" }, { status: 404 })
        }

        // Find sibling sessions for the same user on the same day
        const startOfDay = new Date(attendance.date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(attendance.date);
        endOfDay.setHours(23, 59, 59, 999);

        const siblingSessions = await prisma.attendance.findMany({
            where: {
                userId: attendance.userId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                },
                id: { not: id },
                deletedAt: null
            },
            include: {
                breaks: {
                    where: { deletedAt: null },
                    orderBy: { startTime: 'asc' }
                }
            },
            orderBy: { clockIn: 'asc' }
        })

        return NextResponse.json({
            ...attendance,
            userName: attendance.user.name,
            department: attendance.user.department?.name,
            allSessions: [
                {
                    id: attendance.id,
                    clockIn: attendance.clockIn,
                    clockOut: attendance.clockOut,
                    mode: attendance.mode,
                    breaks: attendance.breaks
                },
                ...siblingSessions.map(s => ({
                    id: s.id,
                    clockIn: s.clockIn,
                    clockOut: s.clockOut,
                    mode: s.mode,
                    breaks: s.breaks
                }))
            ].sort((a, b) => {
                if (!a.clockIn) return 1;
                if (!b.clockIn) return -1;
                return new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime();
            })
        })
    } catch (error) {
        console.error('Error fetching attendance record:', error)
        return NextResponse.json({ error: "Failed to fetch attendance record" }, { status: 500 })
    }
}


export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const session = await auth()
        const body = await req.json()

        // 1. Fetch current record to get userId and check state
        const existing = await prisma.attendance.findUnique({
            where: { id }
        })
        if (!existing) return NextResponse.json({ error: "Attendance not found" }, { status: 404 })

        // 2. Perform Update with included User/Manager info
        const attendance = await prisma.attendance.update({
            where: { id },
            data: {
                clockIn: body.clockIn ? new Date(body.clockIn) : undefined,
                clockOut: body.clockOut ? new Date(body.clockOut) : undefined,
                mode: body.mode,
                locationDetails: body.locationDetails,
                status: body.status,
                date: body.date ? new Date(body.date) : undefined,
                // Clear amendment marker when admin manually edits clock-in, so tardiness recalculates correctly
                ...(body.clockIn && existing.notes === 'CLOCK_IN_AMENDMENT_APPROVED' && { notes: null })
            },
            include: {
                user: {
                    include: {
                        manager: true
                    }
                }
            }
        })

        // 3. Update User Availability Status if session state changed
        if (existing.clockOut === null && attendance.clockOut !== null) {
            await prisma.user.update({
                where: { id: attendance.userId },
                data: { availabilityStatus: 'APPEAR_OFFLINE' }
            })

            // Also auto-close any open breaks
            await prisma.break.updateMany({
                where: {
                    attendanceId: id,
                    endTime: null
                },
                data: {
                    endTime: attendance.clockOut
                }
            })
        }
        else if (existing.clockOut !== null && attendance.clockOut === null) {
            await prisma.user.update({
                where: { id: attendance.userId },
                data: { availabilityStatus: 'AVAILABLE' }
            })
        }

        // --- Log & Summary ---
        await updateAttendanceSummary(attendance.userId, attendance.date)
        const editor = session?.user?.name || "System"
        await logActivity({
            userId: attendance.userId,
            action: 'ADMIN_EDIT',
            entityType: 'ATTENDANCE',
            entityId: id,
            details: {
                editedBy: editor,
                oldStatus: existing.status,
                newStatus: attendance.status,
                date: attendance.date
            }
        })

        // 4. Notifications Logic
        if (session?.user) {
            const actorId = session.user.id;
            const targetUserId = attendance.userId;
            const isSelfUpdate = actorId === targetUserId;
            const actorRoles = (session.user as any).roles || [];
            const isManager = actorRoles.includes('MANAGER');

            if (!isSelfUpdate) {
                await notifyUser({
                    userId: targetUserId,
                    title: "Attendance Updated",
                    message: "An administrator or manager has updated your attendance record.",
                    type: "INFO",
                    link: `/user?date=${attendance.date.toISOString().split('T')[0]}`
                });

                if (session.accessToken) {
                    await sendGeneralEmail({
                        toEmail: attendance.user.email,
                        subject: "Attendance Record Updated",
                        title: "Record Updated",
                        message: `Your attendance record for ${attendance.date.toLocaleDateString()} has been modified by ${session.user.name || "an administrator"}.`,
                        accessToken: session.accessToken,
                        link: `https://attendance-app-712513641417.us-central1.run.app/user`
                    });
                }

                // Notify manager
                if (attendance.user.manager && attendance.user.manager.id !== actorId) {
                    await notifyUser({
                        userId: attendance.user.manager.id,
                        title: "Admin Edited Attendance Record",
                        message: `${session.user.name || 'An admin'} edited the attendance record of ${attendance.user.name} for ${attendance.date.toLocaleDateString()}.`,
                        type: "ADMIN_ACTION",
                        link: "/user/manager?tab=history"
                    });
                    if (session.accessToken && attendance.user.manager.email) {
                        await sendGeneralEmail({
                            toEmail: attendance.user.manager.email,
                            subject: "Staff Attendance Record Edited by Admin",
                            title: "Attendance Record Edited",
                            message: `${session.user.name || 'An administrator'} has edited the attendance record of ${attendance.user.name} for ${attendance.date.toLocaleDateString()}.`,
                            accessToken: session.accessToken,
                            refreshToken: session.refreshToken,
                            link: `https://attendance-app-712513641417.us-central1.run.app/user/manager`
                        });
                    }
                }

                if (isManager) {
                    await notifyRole("ADMIN", "Manager Activity", `Manager ${session.user.name} edited a record for ${attendance.user.name}.`, "INFO");
                }
            }

            if (isSelfUpdate) {
                if (attendance.user.manager) {
                    await notifyUser({
                        userId: attendance.user.manager.id,
                        title: "Staff Activity",
                        message: `${attendance.user.name} edited their attendance record.`,
                        type: "INFO",
                        link: `/team`
                    });

                    if (session.accessToken) {
                        await sendGeneralEmail({
                            toEmail: attendance.user.manager.email,
                            subject: "Staff Attendance Edit",
                            title: "Attendance Edit",
                            message: `${attendance.user.name} has edited their attendance record for ${attendance.date.toLocaleDateString()}.`,
                            accessToken: session.accessToken
                        });
                    }
                }
            }
        }

        broadcastUpdate('attendance', attendance)
        broadcastUpdate('staff')

        return NextResponse.json(attendance)
    } catch (error) {
        console.error("PATCH attendance error:", error)
        return NextResponse.json({ error: "Failed to update attendance record" }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const session = await auth()
        // 1. Fetch to get userId and details for notification
        const existing = await prisma.attendance.findUnique({
            where: { id },
            include: { user: { include: { manager: true } } }
        })
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

        // 2. Soft Delete
        const attendance = await prisma.attendance.update({
            where: { id },
            data: { deletedAt: new Date() }
        })

        // 3. If it was active, update user status to OFFLINE
        if (existing.clockOut === null) {
            await prisma.user.update({
                where: { id: existing.userId },
                data: { availabilityStatus: 'APPEAR_OFFLINE' }
            })
        }

        // --- Log & Summary ---
        await updateAttendanceSummary(existing.userId, existing.date)
        const deleter = session?.user?.name || "System"
        await logActivity({
            userId: existing.userId,
            action: 'ADMIN_DELETE',
            entityType: 'ATTENDANCE',
            entityId: id,
            details: {
                deletedBy: deleter,
                date: existing.date
            }
        })

        // 4. Notification Logic
        if (session?.user) {
            const actorId = session.user.id
            const targetUserId = existing.userId
            const isSelfAction = actorId === targetUserId
            const actorRoles = (session.user as any).roles || []
            const isManager = actorRoles.includes('MANAGER')

            if (!isSelfAction) {
                await notifyUser({
                    userId: targetUserId,
                    title: "Attendance Record Deleted",
                    message: "An administrator or manager has deleted one of your attendance records.",
                    type: "WARNING",
                    link: `/user`
                });

                if (session.accessToken) {
                    await sendGeneralEmail({
                        toEmail: existing.user.email,
                        subject: "Attendance Record Deleted",
                        title: "Record Deleted",
                        message: `Your attendance record for ${existing.date.toLocaleDateString()} has been deleted by ${session.user.name || "an administrator"}.`,
                        accessToken: session.accessToken,
                        link: `https://attendance-app-712513641417.us-central1.run.app/user`
                    });
                }

                if (isManager) {
                    await notifyRole("ADMIN", "Manager Activity", `Manager ${session.user.name} deleted a record for ${existing.user.name}.`, "WARNING");
                }
            }

            if (isSelfAction && existing.user.manager) {
                await notifyUser({
                    userId: existing.user.manager.id,
                    title: "Staff Activity",
                    message: `${existing.user.name} deleted an attendance record.`,
                    type: "WARNING",
                    link: `/team`
                });
                if (session.accessToken) {
                    await sendGeneralEmail({
                        toEmail: existing.user.manager.email,
                        subject: "Staff Record Deleted",
                        title: "Attendance Deleted",
                        message: `${existing.user.name} has deleted their attendance record for ${existing.date.toLocaleDateString()}.`,
                        accessToken: session.accessToken
                    });
                }
            }
        }

        broadcastUpdate('attendance', attendance)
        broadcastUpdate('staff')

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("DELETE attendance error:", error)
        return NextResponse.json({ error: "Failed to delete attendance record" }, { status: 500 })
    }
}
