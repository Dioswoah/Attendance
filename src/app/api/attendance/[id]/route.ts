import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { broadcastUpdate } from "@/lib/eventBus"

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

        // 2. Perform Update
        const attendance = await prisma.attendance.update({
            where: { id },
            data: {
                clockIn: body.clockIn ? new Date(body.clockIn) : undefined,
                clockOut: body.clockOut ? new Date(body.clockOut) : undefined,
                mode: body.mode,
                status: body.status,
                date: body.date ? new Date(body.date) : undefined
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

        // 4. Broadcast
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
        // 1. Fetch to get userId
        const existing = await prisma.attendance.findUnique({
            where: { id }
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

        // 4. Broadcast
        broadcastUpdate('attendance', attendance)
        broadcastUpdate('staff')

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("DELETE attendance error:", error)
        return NextResponse.json({ error: "Failed to delete attendance record" }, { status: 500 })
    }
}
