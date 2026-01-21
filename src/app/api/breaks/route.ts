import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { sendAdminActionEmail } from "@/lib/email"

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const userId = searchParams.get('userId')

    try {
        const breaks = await prisma.break.findMany({
            where: {
                ...(userId && { attendance: { userId } }),
                ...(date && {
                    attendance: {
                        date: {
                            gte: new Date(date),
                            lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000)
                        }
                    }
                })
            },
            include: {
                attendance: {
                    include: {
                        user: { include: { department: true } }
                    }
                }
            },
            orderBy: { startTime: 'desc' }
        })

        const transformed = breaks.map(b => ({
            id: b.id,
            userId: b.attendance.userId,
            userName: b.attendance.user.name,
            department: b.attendance.user.department?.name,
            date: b.attendance.date.toISOString().split('T')[0],
            startTime: b.startTime.toISOString(),
            endTime: b.endTime?.toISOString(),
        }))

        return NextResponse.json(transformed)
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch breaks" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { userId, date, startTime, endTime } = body

        // Find or create attendance record first
        const targetDate = new Date(date)
        targetDate.setUTCHours(0, 0, 0, 0)

        let attendance = await prisma.attendance.findFirst({
            where: {
                userId,
                date: targetDate
            }
        })

        if (!attendance) {
            attendance = await prisma.attendance.create({
                data: {
                    userId,
                    date: targetDate,
                    status: 'ABSENT' // Default to absent if only break is recorded
                }
            })
        }

        const breakRecord = await prisma.break.create({
            data: {
                attendanceId: attendance.id,
                startTime: new Date(startTime),
                endTime: endTime ? new Date(endTime) : null
            }
        })

        // Notify User if Admin created it
        const session = await auth() as any
        if (session && session.user.id !== userId) {
            const targetUser = await prisma.user.findUnique({ where: { id: userId } })
            if (targetUser && targetUser.email && session.accessToken) {
                const details = `Start: ${new Date(breakRecord.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` +
                    (breakRecord.endTime ? `, End: ${new Date(breakRecord.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '')

                await sendAdminActionEmail({
                    userName: targetUser.name || "Employee",
                    userEmail: targetUser.email,
                    adminName: session.user.name || "Administrator",
                    adminEmail: session.user.email,
                    adminAccessToken: session.accessToken,
                    actionType: 'BREAK',
                    details: details,
                    date: new Date(attendance.date).toLocaleDateString()
                })
            }
        }

        return NextResponse.json(breakRecord)
    } catch (error) {
        console.error("Manual break error:", error)
        return NextResponse.json({ error: "Failed to create break record" }, { status: 500 })
    }
}
