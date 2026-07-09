import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"

// PATCH /api/admin/self-check/[id] — Body: { status: 'IGNORED' | 'RESOLVED' }
// Covers the Ignore/Validate actions. Edit is intentionally not implemented yet.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth() as any
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const roles = session.user.roles || []
        if (!roles.includes('ADMIN')) return NextResponse.json({ error: "Admin access required" }, { status: 403 })

        const { id } = await params
        const { status } = await req.json()

        if (status !== 'IGNORED' && status !== 'RESOLVED') {
            return NextResponse.json({ error: "status must be IGNORED or RESOLVED" }, { status: 400 })
        }

        const finding = await prisma.selfCheckFinding.update({
            where: { id },
            data: { status, resolvedById: session.user.id, resolvedAt: new Date() },
        })

        await prisma.activityLog.create({
            data: {
                userId: session.user.id,
                action: status === 'IGNORED' ? "SELF_CHECK_IGNORE" : "SELF_CHECK_RESOLVE",
                entityType: "SelfCheckFinding",
                entityId: finding.id,
                details: { issueType: finding.issueType, targetEntityType: finding.entityType, targetEntityId: finding.entityId },
            },
        })

        return NextResponse.json({ finding })
    } catch (error) {
        console.error("[SelfCheck] PATCH Error:", error)
        return NextResponse.json({ error: "Failed to update finding" }, { status: 500 })
    }
}
