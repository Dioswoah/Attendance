import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth() as any
        if (!session?.user?.id || !session.user.roles?.includes('ADMIN')) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params

        // Delete all active sessions for this user to force them to log back in
        await prisma.session.deleteMany({
            where: { userId: id }
        })

        return NextResponse.json({ message: "User signed out successfully" })
    } catch (error) {
        console.error("Failed to force logout user:", error)
        return NextResponse.json({ error: "Failed to force sign out user" }, { status: 500 })
    }
}
