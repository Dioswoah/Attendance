import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { sendLeaveRequestEmail } from "@/lib/email"
import { auth } from "@/auth"

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const userId = searchParams.get('userId')
    const departmentId = searchParams.get('departmentId')
    const managerId = searchParams.get('managerId')
    const status = searchParams.get('status')

    try {
        const leaves = await prisma.leave.findMany({
            where: {
                ...(userId && { userId }),
                user: {
                    ...(departmentId && departmentId !== 'all' && { departmentId }),
                    ...(managerId && { managerId })
                },
                ...(status && { status }),
                ...(startDate && endDate && {
                    startDate: { gte: new Date(startDate) },
                    endDate: { lte: new Date(endDate) }
                })
            },
            include: { user: { include: { department: true } } },
            orderBy: { createdAt: 'desc' }
        }) as any

        const transformed = leaves.map(l => ({
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
            createdAt: l.createdAt.toISOString()
        }))


        return NextResponse.json(transformed)
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch leaves" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    console.log('[Leave API] POST request received');
    try {
        const body = await req.json()
        const { userId, startDate, endDate, type, reason, duration, startTime, endTime } = body
        console.log('[Leave API] Request body:', { userId, startDate, endDate, type, duration });

        // Check for existing leave requests on the same dates
        const existingLeave = await prisma.leave.findFirst({
            where: {
                userId,
                // Strict check: If ANY leave exists (Pending, Approved, OR Declined), block it.
                // Requirement: "if the existing data shows that the approved as declined then the user cannnot request again"
                OR: [
                    {
                        startDate: { lte: new Date(endDate) },
                        endDate: { gte: new Date(startDate) }
                    }
                ]
            }
        })

        if (existingLeave) {
            console.log('[Leave API] Existing leave found, rejecting request');
            return NextResponse.json({ error: "Leave request already exists for this date range" }, { status: 400 })
        }

        const leave = await prisma.leave.create({
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
        console.log('[Leave API] Leave created successfully:', leave.id);

        // Notify Manager
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { manager: true }
        }) as any;

        console.log('[Leave API] User info:', { userId, managerId: user?.managerId, hasManager: !!user?.manager });

        if (user?.managerId) {
            await prisma.notification.create({
                data: {
                    userId: user.managerId,
                    title: "New Leave Request",
                    message: `${user.name} has requested leave from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
                    type: "LEAVE_REQUEST",
                    link: "/admin/leaves" // Assuming manager checks here
                }
            })
            console.log('[Leave API] Notification created for manager');

            // Send Email Notification to Manager
            if (user.manager && user.manager.email) {
                console.log('[Leave API] Attempting to send email to manager:', user.manager.email);
                // Get session to retrieve access token
                const session = await auth() as any;
                const accessToken = session?.accessToken;

                console.log('[Leave API] Session info:', { hasSession: !!session, hasAccessToken: !!accessToken });

                if (accessToken) {
                    console.log('[Leave API] Calling sendLeaveRequestEmail...');
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
                        leaveId: leave.id
                    });
                    console.log('[Leave API] Email function completed');
                } else {
                    console.warn('[Leave API] No access token found in session. Email not sent.');
                }
            } else {
                console.warn('[Leave API] Manager has no email address. Email not sent.');
            }
        } else {
            console.warn('[Leave API] User has no manager assigned. No notification or email sent.');
        }

        console.log('[Leave API] Returning success response');
        // @ts-ignore
        if (global.io) global.io.emit('update-data')
        return NextResponse.json(leave)
    } catch (error) {
        console.error('[Leave API] Error:', error);
        return NextResponse.json({ error: "Failed to create leave" }, { status: 500 })
    }
}
