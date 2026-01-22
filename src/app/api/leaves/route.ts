import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { sendLeaveRequestEmail, sendAdminActionEmail } from "@/lib/email"
import { auth } from "@/auth"
import { broadcastUpdate } from "@/lib/eventBus"

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const userId = searchParams.get('userId')
    const departmentId = searchParams.get('departmentId')
    const managerId = searchParams.get('managerId')
    const status = searchParams.get('status')

    try {
        const leaveFilter: any = {
            where: {
                ...(userId && { userId }),
                user: {
                    ...(departmentId && departmentId !== 'all' && { departmentId }),
                    ...(managerId && { managerId })
                },
                ...(status && { status: status.includes(',') ? { in: status.split(',') } : status }),
                ...(startDate && endDate && {
                    startDate: { gte: new Date(startDate) },
                    endDate: { lte: new Date(endDate) }
                }),
                deletedAt: null
            },
            include: { user: { include: { department: true } } },
            orderBy: { createdAt: 'desc' }
        }

        const requestFilter: any = {
            where: {
                ...(userId && { userId }),
                user: {
                    ...(departmentId && departmentId !== 'all' && { departmentId }),
                    ...(managerId && { managerId })
                },
                ...(status && { status: status.includes(',') ? { in: status.split(',') } : status }),
                ...(startDate && endDate && {
                    startDate: { gte: new Date(startDate) },
                    endDate: { lte: new Date(endDate) }
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
            isRequest // Flag to help frontend or API distinguish if needed, though ID collision is possible if CUIDs clash (unlikely)
        })

        const transformedLeaves = leaves.map(l => transform(l, false))
        const transformedRequests = leaveRequests.map(l => transform(l, true))

        // combine and sort
        const combined = [...transformedLeaves, ...transformedRequests].sort((a, b) =>
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
        const { userId, startDate, endDate, type, reason, duration, startTime, endTime } = body


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

        // Create Leave REQUEST (not Leave)
        if (!(prisma as any).leaveRequest) {
            return NextResponse.json({ error: "Leave system is temporarily unavailable" }, { status: 503 })
        }

        const leaveRequest = await (prisma as any).leaveRequest.create({
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


        // Notify Manager
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { manager: true }
        }) as any;

        const session = await auth() as any;

        if (session && session.user.id !== userId) {
            if (user && user.email && session.accessToken) {
                await sendAdminActionEmail({
                    userName: user.name || "Employee",
                    userEmail: user.email,
                    adminName: session.user.name || "Administrator",
                    adminEmail: session.user.email,
                    adminAccessToken: session.accessToken,
                    actionType: 'LEAVE',
                    details: `${type} - ${duration} (${reason || 'No reason specified'})`,
                    date: `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`
                })
            }
        }

        if (user?.managerId) {
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
                    await sendLeaveRequestEmail({
                        managerName: user.manager.name || 'Manager',
                        managerEmail: user.manager.email,
                        userName: user.name || 'Employee',
                        userEmail: user.email,
                        userAccessToken: accessToken,
                        leaveType: type,
                        startDate: new Date(startDate).toLocaleDateString(),
                        endDate: new Date(endDate).toLocaleDateString(),
                        duration: duration,
                        reason: reason,
                        leaveId: leaveRequest.id
                    });
                }
            }
        }

        broadcastUpdate('leaves', leaveRequest)
        return NextResponse.json(leaveRequest)
    } catch (error) {
        return NextResponse.json({ error: "Failed to create leave request" }, { status: 500 })
    }
}
