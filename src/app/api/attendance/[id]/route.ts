import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

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
        return NextResponse.json(attendance)
    } catch (error) {
        return NextResponse.json({ error: "Failed to update attendance record" }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        await prisma.attendance.update({
            where: { id },
            data: { deletedAt: new Date() }
        })
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete attendance record" }, { status: 500 })
    }
}
