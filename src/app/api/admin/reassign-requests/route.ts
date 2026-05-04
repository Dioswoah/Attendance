import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"

// POST /api/admin/reassign-requests
// Body: { fromManagerId, toManagerId } — admin bulk reassign
// Body: { requestId, requestType, toManagerId } — per-request reassign (manager or admin)
export async function POST(req: Request) {
    try {
        const session = await auth() as any
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const roles = session.user.roles || []
        const isAdmin = roles.includes('ADMIN')
        const isManager = roles.includes('MANAGER') || isAdmin

        const body = await req.json()
        const { fromManagerId, toManagerId, requestId, requestType } = body

        if (!toManagerId) return NextResponse.json({ error: "toManagerId is required" }, { status: 400 })

        // --- Option 1: Admin bulk reassign (all pending requests from one manager's staff) ---
        if (fromManagerId) {
            if (!isAdmin) return NextResponse.json({ error: "Only admins can bulk reassign" }, { status: 403 })

            const [leaveCount, attnCount] = await Promise.all([
                prisma.leaveRequest.updateMany({
                    where: {
                        status: 'PENDING',
                        deletedAt: null,
                        OR: [
                            { assignedManagerId: fromManagerId },
                            { assignedManagerId: null, user: { managerId: fromManagerId } }
                        ]
                    },
                    data: { assignedManagerId: toManagerId }
                }),
                prisma.attendanceRequest.updateMany({
                    where: {
                        status: 'PENDING',
                        deletedAt: null,
                        OR: [
                            { assignedManagerId: fromManagerId },
                            { assignedManagerId: null, user: { managerId: fromManagerId } }
                        ]
                    },
                    data: { assignedManagerId: toManagerId }
                })
            ])

            return NextResponse.json({
                success: true,
                reassigned: { leaveRequests: leaveCount.count, attendanceRequests: attnCount.count }
            })
        }

        // --- Option 2: Per-request reassign (manager or admin reassigns a single request) ---
        if (requestId && requestType) {
            if (!isManager) return NextResponse.json({ error: "Only managers or admins can reassign requests" }, { status: 403 })

            if (requestType === 'LEAVE') {
                const request = await prisma.leaveRequest.findUnique({
                    where: { id: requestId },
                    include: { user: true }
                })
                if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 })

                // Only the current assigned manager (or admin) can reassign
                const isAssigned = (request as any).assignedManagerId === session.user.id
                    || (!( request as any).assignedManagerId && request.user.managerId === session.user.id)
                if (!isAdmin && !isAssigned) {
                    return NextResponse.json({ error: "You are not assigned to this request" }, { status: 403 })
                }

                await prisma.leaveRequest.update({
                    where: { id: requestId },
                    data: { assignedManagerId: toManagerId === 'reset' ? null : toManagerId }
                })
            } else if (requestType === 'ATTENDANCE') {
                const request = await prisma.attendanceRequest.findUnique({
                    where: { id: requestId },
                    include: { user: true }
                })
                if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 })

                const isAssigned = (request as any).assignedManagerId === session.user.id
                    || (!(request as any).assignedManagerId && request.user.managerId === session.user.id)
                if (!isAdmin && !isAssigned) {
                    return NextResponse.json({ error: "You are not assigned to this request" }, { status: 403 })
                }

                await prisma.attendanceRequest.update({
                    where: { id: requestId },
                    data: { assignedManagerId: toManagerId === 'reset' ? null : toManagerId }
                })
            } else {
                return NextResponse.json({ error: "Invalid requestType" }, { status: 400 })
            }

            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ error: "Provide either fromManagerId (bulk) or requestId + requestType (single)" }, { status: 400 })
    } catch (error) {
        console.error("[Reassign] Error:", error)
        return NextResponse.json({ error: "Failed to reassign requests" }, { status: 500 })
    }
}
