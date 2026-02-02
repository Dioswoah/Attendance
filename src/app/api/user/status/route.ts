
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from "@/auth"

export async function PUT(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const body = await req.json()
        const { status } = body

        if (!status) {
            return new NextResponse("Status is required", { status: 400 })
        }

        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: { availabilityStatus: status }
        })

        return NextResponse.json(updatedUser)
    } catch (error) {
        console.error("Update status error:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
