import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"

export async function GET(req: Request) {
    const session = await auth() as any
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const isAdmin = session.user.roles?.includes('ADMIN') || false
    const userIdInQuery = searchParams.get('userId')

    // If not admin, you can only see YOUR logs
    const userId = isAdmin ? userIdInQuery : session.user.id
    const action = searchParams.get('action')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    try {
        const [logs, total] = await Promise.all([
            prisma.activityLog.findMany({
                where: {
                    ...(userId && { userId }),
                    ...(action && { action })
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            image: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset
            }),
            prisma.activityLog.count({
                where: {
                    ...(userId && { userId }),
                    ...(action && { action })
                }
            })
        ])

        return NextResponse.json({ logs, total, limit, offset })
    } catch (error) {
        console.error("Fetch logs error:", error)
        return NextResponse.json({ error: "Failed to fetch activity logs" }, { status: 500 })
    }
}
