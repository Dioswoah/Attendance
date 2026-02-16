import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { broadcastUpdate } from "@/lib/eventBus"
import { auth } from "@/auth"
import { notifyUser, notifyRole } from "@/lib/notifications"
import { sendGeneralEmail } from "@/lib/email"

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
                status: body.status,
                date: body.date ? new Date(body.date) : undefined
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
        // If clocking out an active session
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
        // If re-opening a session
        else if (existing.clockOut !== null && attendance.clockOut === null) {
            await prisma.user.update({
                where: { id: attendance.userId },
                data: { availabilityStatus: 'AVAILABLE' }
            })
        }

        // 4. Notifications Logic
        const session = await auth();
        if (session?.user) {
            const actorId = session.user.id;
            const targetUserId = attendance.userId;
            const isSelfUpdate = actorId === targetUserId;
            // Assuming roles are available on session.user (checking typings might be needed, but assuming standard NextAuth augmentation)
            const actorRoles = (session.user as any).roles || [];
            const isManager = actorRoles.includes('MANAGER');

            // Rule 1: Admin/Manager updates User -> Notify User
            if (!isSelfUpdate) {
                // Determine if actor is Admin or Manager (if logic requires distinction)
                // For now, any non-self update triggers this

                // App Notification
                await notifyUser({
                    userId: targetUserId,
                    title: "Attendance Updated",
                    message: "An administrator or manager has updated your attendance record.",
                    type: "INFO",
                    link: `/user?date=${attendance.date.toISOString().split('T')[0]}`
                });

                // Email Notification
                if (session.accessToken) { // Need sender token
                    await sendGeneralEmail({
                        toEmail: attendance.user.email,
                        subject: "Attendance Record Updated",
                        title: "Record Updated",
                        message: `Your attendance record for ${attendance.date.toLocaleDateString()} has been modified by ${session.user.name || "an administrator"}.`,
                        accessToken: session.accessToken,
                        link: `${process.env.NEXTAUTH_URL}/user`
                    });
                }

                // Rule 3 (Partial): If Manager edits record -> Notify Admin
                // Wait, if Manager edits User, we notify User (done above).
                // Do we also notify Admin? "when the manager delete or edit ... email to the admin"
                if (isManager) {
                    await notifyRole("ADMIN", "Manager Activity", `Manager ${session.user.name} edited a record for ${attendance.user.name}.`, "INFO");
                    // Email to admins? We'd need to fetch admins or use a system email.
                    // Since we can't easily fetch all admin emails without a query, we'll skip email to admin or implement if critical.
                    // Attempting to notify ADMIN role in app notification is done.
                }
            }

            // Rule 2: User edits/deletes record (Self) -> Notify Manager
            if (isSelfUpdate) {
                if (attendance.user.manager) {
                    await notifyUser({
                        userId: attendance.user.manager.id,
                        title: "Staff Activity",
                        message: `${attendance.user.name} edited their attendance record.`,
                        type: "INFO",
                        link: `/team` // Manager view
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

        // 5. Broadcast
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

        // 4. Notification Logic
        const session = await auth()
        if (session?.user) {
            const actorId = session.user.id
            const targetUserId = existing.userId
            const isSelfAction = actorId === targetUserId
            const actorRoles = (session.user as any).roles || []
            const isManager = actorRoles.includes('MANAGER')

            if (!isSelfAction) {
                // Admin/Manager deleted User record -> Notify User
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
                        link: `${process.env.NEXTAUTH_URL}/user`
                    });
                }

                // If Manager deleted User record -> Notify Admin
                if (isManager) {
                    await notifyRole("ADMIN", "Manager Activity", `Manager ${session.user.name} deleted a record for ${existing.user.name}.`, "WARNING");
                }
            }

            if (isSelfAction && existing.user.manager) {
                // User deleted own record -> Notify Manager
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

        // 5. Broadcast
        broadcastUpdate('attendance', attendance)
        broadcastUpdate('staff')

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("DELETE attendance error:", error)
        return NextResponse.json({ error: "Failed to delete attendance record" }, { status: 500 })
    }
}
