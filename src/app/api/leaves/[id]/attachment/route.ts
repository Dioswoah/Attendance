import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { downloadFile } from "@/lib/gcs"

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    try {
        const session = await auth() as any
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const userRoles: string[] = session.user.roles || []
        const isPrivileged = userRoles.includes("ADMIN") || userRoles.includes("MANAGER")

        // Try LeaveRequest first, then Leave
        let attachmentPath: string | null = null
        let ownerId: string | null = null

        const leaveReq = await (prisma as any).leaveRequest.findUnique({
            where: { id },
            select: { userId: true, attachmentPath: true }
        })

        if (leaveReq) {
            attachmentPath = leaveReq.attachmentPath
            ownerId = leaveReq.userId
        } else {
            const leave = await (prisma as any).leave.findUnique({
                where: { id },
                select: { userId: true, attachmentPath: true }
            })
            if (leave) {
                attachmentPath = leave.attachmentPath
                ownerId = leave.userId
            }
        }

        if (!ownerId) {
            return NextResponse.json({ error: "Leave not found" }, { status: 404 })
        }

        // Auth check: must be owner, manager, or admin
        if (ownerId !== session.user.id && !isPrivileged) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        if (!attachmentPath) {
            return NextResponse.json({ error: "No attachment found" }, { status: 404 })
        }

        const { buffer, contentType, filename } = await downloadFile(attachmentPath)
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `inline; filename="${filename}"`,
                "Cache-Control": "private, no-cache"
            }
        })
    } catch (error: any) {
        console.error("[Attachment] download error:", error?.message || error)
        return NextResponse.json({ error: "Failed to load attachment", detail: error?.message }, { status: 500 })
    }
}
