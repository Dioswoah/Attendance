import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"

export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const managerId = searchParams.get('managerId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const departmentId = searchParams.get('departmentId')

    const where: any = {}

    if (userId) where.userId = userId
    if (managerId) where.user = { managerId }
    if (departmentId && departmentId !== 'all') {
        where.user = { ...where.user, departmentId }
    }

    if (startDate && endDate) {
        where.date = {
            gte: new Date(startDate),
            lte: new Date(endDate)
        }
    }

    try {
        const summaries = await prisma.attendanceSummary.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        department: { select: { name: true } },
                        employmentLocation: true
                    }
                },
                overriddenBy: {
                    select: { name: true }
                }
            },
            orderBy: { date: 'desc' }
        })

        return NextResponse.json(summaries)
    } catch (error) {
        console.error("Fetch summaries error:", error)
        return NextResponse.json({ error: "Failed to fetch summaries" }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    const session = await auth()
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const body = await req.json()
        const { id, status, clockIn, clockOut, reason } = body

        const updated = await prisma.attendanceSummary.update({
            where: { id },
            data: {
                status,
                clockIn: clockIn ? new Date(clockIn) : null,
                clockOut: clockOut ? new Date(clockOut) : null,
                isManualOverride: true,
                overriddenById: session.user.id,
                overrideReason: reason
            }
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error("Update summary error:", error)
        return NextResponse.json({ error: "Failed to update summary" }, { status: 500 })
    }
}
