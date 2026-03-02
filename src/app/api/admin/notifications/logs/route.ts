import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"

export async function GET(req: Request) {
    try {
        const session = await auth() as any
        if (!session?.user?.id || !session.user.roles?.includes('ADMIN')) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const notifications = await prisma.notification.findMany({
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            },
            take: 200 // Limit to last 200 for performance
        })

        return NextResponse.json(notifications)
    } catch (error) {
        console.error("Error fetching admin notification logs:", error)
        return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 })
    }
}
