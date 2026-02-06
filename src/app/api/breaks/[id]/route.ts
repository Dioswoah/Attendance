import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const breakRecord = await prisma.break.findUnique({
            where: { id },
            include: {
                attendance: {
                    select: {
                        id: true,
                        date: true,
                        clockIn: true,
                        clockOut: true,
                        user: {
                            select: {
                                name: true,
                                department: {
                                    select: {
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })

        if (!breakRecord) {
            return NextResponse.json({ error: "Break record not found" }, { status: 404 })
        }

        return NextResponse.json({
            ...breakRecord,
            date: breakRecord.attendance.date,
            userName: breakRecord.attendance.user.name,
            department: breakRecord.attendance.user.department?.name
        })
    } catch (error) {
        console.error('Error fetching break record:', error)
        return NextResponse.json({ error: "Failed to fetch break record" }, { status: 500 })
    }
}


export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const body = await req.json()
        const breakRecord = await prisma.break.update({
            where: { id },
            data: {
                startTime: body.startTime ? new Date(body.startTime) : undefined,
                endTime: body.endTime ? new Date(body.endTime) : undefined,
            }
        })
        return NextResponse.json(breakRecord)
    } catch (error) {
        return NextResponse.json({ error: "Failed to update break record" }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        await prisma.break.update({
            where: { id },
            data: { deletedAt: new Date() }
        })
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete break record" }, { status: 500 })
    }
}
