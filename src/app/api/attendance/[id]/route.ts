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

        return NextResponse.json({
            ...attendance,
            userName: attendance.user.name,
            department: attendance.user.department?.name
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
