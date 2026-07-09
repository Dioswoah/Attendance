import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { runSelfCheckForToday } from "@/lib/self-check/runner"

// POST /api/admin/self-check — trigger a self-check scan for today (synchronous)
export async function POST() {
    try {
        const session = await auth() as any
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const roles = session.user.roles || []
        if (!roles.includes('ADMIN')) return NextResponse.json({ error: "Admin access required" }, { status: 403 })

        const result = await runSelfCheckForToday(session.user.id)
        return NextResponse.json(result)
    } catch (error) {
        console.error("[SelfCheck] POST Error:", error)
        return NextResponse.json({ error: "Failed to run self-check" }, { status: 500 })
    }
}

// GET /api/admin/self-check?status=OPEN — list findings, most recent first
export async function GET(req: Request) {
    try {
        const session = await auth() as any
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const roles = session.user.roles || []
        if (!roles.includes('ADMIN')) return NextResponse.json({ error: "Admin access required" }, { status: 403 })

        const { searchParams } = new URL(req.url)
        const status = searchParams.get('status')

        const findings = await prisma.selfCheckFinding.findMany({
            where: status ? { status: status as any } : undefined,
            include: {
                user: { select: { id: true, name: true, email: true } },
                run: { select: { id: true, scanDate: true, status: true } },
            },
            orderBy: { createdAt: 'desc' },
        })

        const latestRun = await prisma.selfCheckRun.findFirst({ orderBy: { startedAt: 'desc' } })

        const history = await prisma.activityLog.findMany({
            where: { entityType: { in: ['SelfCheckRun', 'SelfCheckFinding'] } },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            take: 20,
        })

        return NextResponse.json({ findings, latestRun, history })
    } catch (error) {
        console.error("[SelfCheck] GET Error:", error)
        return NextResponse.json({ error: "Failed to fetch self-check findings" }, { status: 500 })
    }
}
