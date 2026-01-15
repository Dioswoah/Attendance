import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const userId = searchParams.get('userId')
    const departmentId = searchParams.get('departmentId')
    const managerId = searchParams.get('managerId')
    const status = searchParams.get('status')

    try {
        const leaves = await prisma.leave.findMany({
            where: {
                ...(userId && { userId }),
                user: {
                    ...(departmentId && departmentId !== 'all' && { departmentId }),
                    ...(managerId && { managerId })
                },
                ...(status && { status }),
                ...(startDate && endDate && {
                    startDate: { gte: new Date(startDate) },
                    endDate: { lte: new Date(endDate) }
                })
            },
            include: { user: { include: { department: true } } },
            orderBy: { createdAt: 'desc' }
        }) as any

        const transformed = leaves.map(l => ({
            id: l.id,
            userId: l.userId,
            userName: l.user.name,
            userImage: l.user.image,
            department: l.user.department?.name,
            startDate: l.startDate.toISOString(),
            endDate: l.endDate.toISOString(),
            type: l.type,
            reason: l.reason,
            status: l.status,
            duration: l.duration
        }))

        return NextResponse.json(transformed)
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch leaves" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { userId, startDate, endDate, type, reason, duration } = body

        const leave = await prisma.leave.create({
            data: {
                userId,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                type,
                reason,
                duration,
                status: "PENDING"
            }
        })

        return NextResponse.json(leave)
    } catch (error) {
        return NextResponse.json({ error: "Failed to create leave" }, { status: 500 })
    }
}
