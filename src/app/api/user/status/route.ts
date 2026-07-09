
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from "@/auth"
import { syncStatusToCalendar } from "@/lib/calendar"

export async function PUT(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const body = await req.json()
        const { status, customStatusMessage } = body

        if (!status) {
            return new NextResponse("Status is required", { status: 400 })
        }

        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                availabilityStatus: status,
                customStatusMessage: customStatusMessage
            }
        })

        // Sync to Google Calendar (non-blocking)
        const sessionWithToken = session as any
        if (sessionWithToken?.accessToken) {
            // Get current attendance to determine work mode
            const today = new Date()
            today.setUTCHours(0, 0, 0, 0)
            const attendance = await prisma.attendance.findFirst({
                where: {
                    userId: session.user.id,
                    date: today,
                    clockOut: null,
                    clockIn: { not: null },
                    deletedAt: null
                }
            })

            const userWithTimezone = updatedUser as any
            const timezone = userWithTimezone?.selectedTimezone || 'UTC'
            const workMode = attendance?.mode || 'OFFICE'

            syncStatusToCalendar(sessionWithToken.accessToken, status, workMode, timezone, customStatusMessage)
                .catch(err => console.error('[Calendar Sync] Failed on manual status change:', err))
        }

        return NextResponse.json(updatedUser)
    } catch (error) {
        console.error("Update status error:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
