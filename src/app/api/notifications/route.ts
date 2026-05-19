import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { broadcastUpdate } from "@/lib/eventBus"

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

// POST /api/notifications (Create a notification — admin use)
export async function POST(req: Request) {
    try {
        const { userId, title, message, type, link } = await req.json()
        if (!userId || !title || !message) {
            return NextResponse.json({ error: "userId, title, and message are required" }, { status: 400 })
        }
        const notification = await prisma.notification.create({
            data: { userId, title, message, type: type || 'ADMIN_ACTION', link: link || '/user' }
        })
        broadcastUpdate('notification', { userId })
        return NextResponse.json(notification)
    } catch (error) {
        return NextResponse.json({ error: "Failed to create notification" }, { status: 500 })
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
