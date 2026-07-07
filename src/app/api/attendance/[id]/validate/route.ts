import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { broadcastUpdate } from "@/lib/eventBus"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const session = await auth()
        const roles = (session?.user as any)?.roles || []
        if (!session?.user?.id || (!roles.includes('MANAGER') && !roles.includes('ADMIN'))) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 })
        }

        const { status } = await req.json()
        if (status !== 'VALIDATED' && status !== 'NEEDS_CORRECTION' && status !== null) {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 })
        }

        const attendance = await prisma.attendance.update({
            where: { id },
            data: {
                validationStatus: status,
                validatedAt: status ? new Date() : null
            }
        })

        broadcastUpdate('attendance', attendance)

        return NextResponse.json(attendance)
    } catch (error) {
        console.error("PATCH attendance validate error:", error)
        return NextResponse.json({ error: "Failed to update validation status" }, { status: 500 })
    }
}
