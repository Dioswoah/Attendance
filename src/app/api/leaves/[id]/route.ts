import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const body = await req.json()
        const leave = await prisma.leave.update({
            where: { id },
            data: {
                startDate: body.startDate ? new Date(body.startDate) : undefined,
                endDate: body.endDate ? new Date(body.endDate) : undefined,
                type: body.type,
                reason: body.reason,
                duration: body.duration,
                status: body.status
            }
        })
        return NextResponse.json(leave)
    } catch (error) {
        return NextResponse.json({ error: "Failed to update leave" }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        await prisma.leave.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete leave" }, { status: 500 })
    }
}
