import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

// GET /api/notifications?userId=xxx
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const role = searchParams.get('role')

    if (!userId && !role) {
        return NextResponse.json({ error: "UserId or Role is required" }, { status: 400 })
    }

    try {
        let whereClause: any = {}
        if (userId) {
            whereClause.userId = userId
        } else if (role) {
            whereClause.user = { roles: { has: role as any } }
        }

        const notifications = await prisma.notification.findMany({
            where: {
                ...whereClause,
                deletedAt: null
            },
            orderBy: { createdAt: 'desc' }
        })
        return NextResponse.json(notifications)
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
    }
}

// PUT /api/notifications?id=xxx (Mark as read)
export async function PUT(req: Request) {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId') // Optional, to mark all as read

    try {
        if (id) {
            await prisma.notification.update({
                where: { id },
                data: { read: true }
            })
        } else if (userId) {
            await prisma.notification.updateMany({
                where: { userId, read: false },
                data: { read: true }
            })
        }
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Failed to update notification" }, { status: 500 })
    }
}
