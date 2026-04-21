import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { sendLeaveRequestEmail, sendAdminActionEmail } from "@/lib/email"
import { auth } from "@/auth"
import { broadcastUpdate } from "@/lib/eventBus"
import { logActivity, updateAttendanceSummary } from '@/lib/db-utils'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const userId = searchParams.get('userId')
    const departmentId = searchParams.get('departmentId')
    const managerId = searchParams.get('managerId')
    const status = searchParams.get('status')
    const userIdsStr = searchParams.get('userIds')

    const userFilter = (ids: string | null) => {
        if (!ids) return undefined
        const splitIds = ids.split(',').filter(id => id.length > 0)
        return splitIds.length > 0 ? { in: splitIds } : undefined
    }

    try {
        const leaveFilter: any = {
            where: {
                ...(userIdsStr ? { userId: userFilter(userIdsStr) } : userId ? { userId } : {}),
                user: {
                    ...(departmentId && departmentId !== 'all' && { departmentId }),
                    ...(managerId && { managerId })
                },
                ...(status && { status: status.includes(',') ? { in: status.split(',') } : status }),
                ...(startDate && endDate && {
                    startDate: { lte: new Date(endDate) },
                    endDate: { gte: new Date(startDate) }
                }),
                deletedAt: null
            },
            include: { user: { include: { department: true } } },
            orderBy: { createdAt: 'desc' }
        }

        const requestFilter: any = {
            where: {
                ...(userIdsStr ? { userId: userFilter(userIdsStr) } : userId ? { userId } : {}),
                user: {
                    ...(departmentId && departmentId !== 'all' && { departmentId }),
                    ...(managerId && { managerId })
                },
                ...(status && { status: status.includes(',') ? { in: status.split(',') } : status }),
                ...(startDate && endDate && {
                    startDate: { lte: new Date(endDate) },
                    endDate: { gte: new Date(startDate) }
                }),
                deletedAt: null
            },
            include: { user: { include: { department: true } } },
            orderBy: { createdAt: 'desc' }
        }

        const leaves = await prisma.leave.findMany(leaveFilter)
        let leaveRequests: any[] = []

        try {
            const lr = (prisma as any).leaveRequest
            if (lr) {
                leaveRequests = await lr.findMany(requestFilter)
            }
        } catch (e) {
            // Silently fail if model is missing from client
        }

        const transform = (l: any, isRequest: boolean) => ({
            id: l.id,
            userId: l.userId,
            userName: l.user.name,
            userImage: l.user.image,
            department: l.user.department?.name,
            startDate: l.startDate.toISOString(),
            endDate: l.endDate.toISOString(),
            startTime: l.startTime?.toISOString(),
            endTime: l.endTime?.toISOString(),
            type: l.type,
            reason: l.reason,
            status: l.status,
            duration: l.duration,
            declineReason: l.declineReason,
            createdAt: l.createdAt.toISOString(),
            userTimeZone: l.user.selectedTimezone,
            isRequest // Flag to help frontend or API distinguish if needed
        })

        const transformedLeaves = leaves.map(l => transform(l, false))
        const transformedRequests = leaveRequests.map(l => transform(l, true))

        const uniqueItems = new Map()

        for (const req of transformedRequests) {
            const key = `${req.userId}-${req.startDate.split('T')[0]}-${req.endDate.split('T')[0]}-${req.type}`
            uniqueItems.set(key, req)
        }

        for (const lv of transformedLeaves) {
            const key = `${lv.userId}-${lv.startDate.split('T')[0]}-${lv.endDate.split('T')[0]}-${lv.type}`
            if (!uniqueItems.has(key)) {
                uniqueItems.set(key, lv)
            }
        }

        // combine and sort
        const combined = Array.from(uniqueItems.values()).sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )

        return NextResponse.json(combined)
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch leaves" }, { status: 500 })
    }
}

export async function POST(req: Request) {

    try {
        const body = await req.json()
        const { userId, startDate, endDate, type, reason, duration, startTime, endTime, status } = body


        const currentYear = new Date().getFullYear();

        // 1. Birthday Check
        if (type === 'BIRTHDAY') {
            const startOfYear = new Date(currentYear, 0, 1);
            const endOfYear = new Date(currentYear, 11, 31);

            const birthdayLeave = await (prisma as any).leave.findFirst({
                where: {
                    userId,
                    type: 'BIRTHDAY',
                    status: { not: 'DECLINED' },
                    startDate: {
                        gte: startOfYear,
                        lte: endOfYear
                    }
                }
            });

            const birthdayRequest = (prisma as any).leaveRequest ? await (prisma as any).leaveRequest.findFirst({
                where: {
                    userId,
                    type: 'BIRTHDAY',
                    status: { not: 'DECLINED' },
                    startDate: {
                        gte: startOfYear,
                        lte: endOfYear
                    }
                }
            }) : null;

            if (birthdayLeave || birthdayRequest) {
                return NextResponse.json({ error: "You have already requested a Birthday Leave for this year." }, { status: 400 });
            }
        }

        // Check for existing leave requests on the same dates
        const dateCheck = {
            where: {
                userId,
                deletedAt: null,
                OR: [
                    {
                        startDate: { lte: new Date(endDate) },
                        endDate: { gte: new Date(startDate) }
                    }
                ]
            }
        }

        const existingLeave = await (prisma as any).leave.findFirst(dateCheck)
        const existingRequest = (prisma as any).leaveRequest ? await (prisma as any).leaveRequest.findFirst(dateCheck) : null

        if (existingLeave || existingRequest) {
            return NextResponse.json({ error: "Leave request already exists for this date range" }, { status: 400 })
        }

        let record: any;

        if (status === 'APPROVED') {
            record = await (prisma as any).leave.create({
                data: {
                    userId,
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    startTime: startTime ? new Date(startTime) : null,
                    endTime: endTime ? new Date(endTime) : null,
                    type,
                    reason,
                    duration,
                    status: "APPROVED"
                }
            })
        } else {
            // Create Leave REQUEST (not Leave)
            if (!(prisma as any).leaveRequest) {
                return NextResponse.json({ error: "Leave system is temporarily unavailable" }, { status: 503 })
            }

            record = await (prisma as any).leaveRequest.create({
                data: {
                    userId,
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    startTime: startTime ? new Date(startTime) : null,
                    endTime: endTime ? new Date(endTime) : null,
                    type,
                    reason,
                    duration,
                    status: "PENDING"
                }
            })
        }


        // Notify Manager
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { manager: true }
        }) as any;

        const session = await auth() as any;

        if (session && session.user.id !== userId) {
            if (user && user.email) {
                // 1. Create In-App Notification
                await prisma.notification.create({
                    data: {
                        userId: userId,
                        title: "New Leave Record Added",
                        message: `An administrator (${session.user.name || 'Admin'}) has added a new leave record for you from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}.`,
                        type: "ADMIN_ACTION",
                        link: "/user"
                    }
                })

                // 2. Broadcast for real-time bell
                broadcastUpdate('notification', { userId })

                // 3. Send Email
                if (user.email) {
                    await sendAdminActionEmail({
                        userName: user.name || "Employee",
                        userEmail: user.email,
                        adminName: session.user.name || "Administrator",
                        adminEmail: session.user.email,
                        adminAccessToken: session.accessToken || '',
                        actionType: 'LEAVE',
                        details: `${type} - ${duration} (${reason || 'No reason specified'})`,
                        date: `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`,
                        adminRefreshToken: session.refreshToken
                    })
                }
            }
        }

        if (user?.managerId && status !== 'APPROVED') {
            await prisma.notification.create({
                data: {
                    userId: user.managerId,
                    title: "New Leave Request",
                    message: `${user.name} has requested leave from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
                    type: "LEAVE_REQUEST",
                    link: "/admin/leaves"
                }
            })

            if (user.manager && user.manager.email) {
                const accessToken = session?.accessToken;
                if (accessToken) {
                    let durationDisplay = duration;
                    if (startTime && endTime) {
                        const startObj = new Date(startTime);
                        const endObj = new Date(endTime);
                        const managerTz = user.manager?.selectedTimezone || 'Asia/Manila';
                        const staffTz = user.selectedTimezone || (user.employmentLocation === 'Australia' ? 'Australia/Sydney' : 'Asia/Manila');

                        const mStart = startObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: managerTz });
                        const mEnd = endObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: managerTz });

                        const sStart = startObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: staffTz });
                        const sEnd = endObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: staffTz });

                        durationDisplay = `${duration} (${mStart}-${mEnd} Local / ${sStart}-${sEnd} Staff)`;
                    }

                    await sendLeaveRequestEmail({
                        managerName: user.manager.name || 'Manager',
                        managerEmail: user.manager.email,
                        userName: user.name || 'Employee',
                        userEmail: user.email,
                        userAccessToken: accessToken,
                        leaveType: type,
                        startDate: new Date(startDate).toLocaleDateString(),
                        endDate: new Date(endDate).toLocaleDateString(),
                        duration: durationDisplay,
                        reason: reason,
                        leaveId: record.id,
                        refreshToken: accessToken === session.accessToken ? session.refreshToken : undefined
                    });
                }
            }
        }

        // Update Summaries for the date range
        const start = new Date(startDate)
        const end = new Date(endDate)
        const current = new Date(start)
        while (current <= end) {
            await updateAttendanceSummary(userId, new Date(current))
            current.setDate(current.getDate() + 1)
        }

        // Log Activity
        await logActivity({
            userId,
            action: status === 'APPROVED' ? 'LEAVE_GRANTED_ADMIN' : 'LEAVE_SUBMIT',
            entityType: 'LEAVE',
            entityId: record.id,
            details: { type, startDate, endDate, duration, reason, status }
        })

        broadcastUpdate('leaves', record)
        return NextResponse.json(record)
    } catch (error) {
        return NextResponse.json({ error: "Failed to create leave request" }, { status: 500 })
    }
}
