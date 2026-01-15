import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

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
        await prisma.attendance.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete attendance record" }, { status: 500 })
    }
}
