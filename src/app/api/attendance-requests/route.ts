import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { sendLeaveRequestEmail } from "@/lib/email"
import { broadcastUpdate } from "@/lib/eventBus"
import { logActivity, updateAttendanceSummary } from '@/lib/db-utils'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const managerId = searchParams.get('managerId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    try {
        const requests = await prisma.attendanceRequest.findMany({
            where: {
                ...(userId && { userId }),
                ...(managerId && { user: { managerId } }),
                ...(status && { status: status.includes(',') ? { in: status.split(',') } : status }),
                ...(startDate && endDate && {
                    date: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                }),
                deletedAt: null
            },
            include: { user: true },
            orderBy: { createdAt: 'desc' }
        })

        // Attach the current attendance record for amendment requests (targetId present)
        const targetIds = requests.map(r => r.targetId).filter(Boolean) as string[]
        const targetAttendances = targetIds.length > 0
            ? await prisma.attendance.findMany({ where: { id: { in: targetIds } } })
            : []
        const targetMap = new Map(targetAttendances.map(a => [a.id, a]))

        return NextResponse.json(requests.map(r => ({
            ...r,
            targetAttendance: r.targetId ? (targetMap.get(r.targetId) ?? null) : null
        })))
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { userId, type, time, reason, targetId, workMode, locationDetails } = body

        // Fetch User to determine timezone for proper date normalization
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { manager: true }
        }) as any

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        const timeZone = user.selectedTimezone || 'Asia/Manila'
        const eventTime = new Date(time)

        // Determine the "Logical Date" based on the Event's Local Time
        // This ensures Feb 11 5 AM Manila is recorded as Feb 11, not Feb 10 (UTC)
        const localDateStr = eventTime.toLocaleDateString('en-CA', { timeZone }) // YYYY-MM-DD
        const normalizedDate = new Date(`${localDateStr}T00:00:00Z`)

        // Auto-approve if only metadata changed (Clock In time is identical to existing)
        if (type === 'CLOCK_IN' && targetId) {
            const existingAttendance = await prisma.attendance.findUnique({ where: { id: targetId } })
            if (existingAttendance?.clockIn) {
                const timeDiffMs = Math.abs(eventTime.getTime() - existingAttendance.clockIn.getTime())
                if (timeDiffMs < 60000) { // Under 1 minute = time unchanged, metadata-only change
                    const autoRequest = await prisma.attendanceRequest.create({
                        data: { userId, date: normalizedDate, type, time: eventTime, reason, status: 'APPROVED', targetId }
                    })
                    await prisma.attendance.update({
                        where: { id: targetId },
                        data: {
                            ...(workMode && { mode: workMode as any }),
                            ...(locationDetails !== undefined && { locationDetails }),
                            notes: 'METADATA_AMENDMENT_AUTO_APPROVED'
                        }
                    })
                    await prisma.notification.create({
                        data: {
                            userId,
                            title: 'Record Updated',
                            message: 'Your attendance record details were updated automatically.',
                            type: 'LEAVE_STATUS',
                            link: '/user/amend-records'
                        }
                    })
                    await updateAttendanceSummary(userId, normalizedDate)
                    await logActivity({ userId, action: 'ATTENDANCE_REQUEST_SUBMIT', entityType: 'ATTENDANCE_REQUEST', entityId: autoRequest.id, details: { type, auto_approved: true } })
                    broadcastUpdate('attendance', autoRequest)
                    return NextResponse.json({ ...autoRequest, autoApproved: true })
                }
            }
        }

        const request = await prisma.attendanceRequest.create({
            data: {
                userId,
                date: normalizedDate,
                type,
                time: eventTime,
                reason: JSON.stringify({ reason, workMode, locationDetails }),
                status: 'PENDING',
                targetId
            }
        })

        // PROVISIONAL ATTENDANCE:
        // Only create a provisional attendance row when submitting a brand-new CLOCK_IN
        // for a date that has NO existing attendance record at all (targetId is null).
        // If targetId is provided, the user is amending an EXISTING record — we must NOT
        // create a new row; the original record stays unchanged until the request is approved.
        if (type === 'CLOCK_IN' && !targetId) {
            const existing = await prisma.attendance.findFirst({
                where: {
                    userId,
                    date: normalizedDate
                }
            })

            if (!existing) {
                await prisma.attendance.create({
                    data: {
                        userId,
                        date: normalizedDate,
                        clockIn: eventTime,
                        status: 'PRESENT',
                        mode: (workMode as any) || 'OFFICE',
                        locationDetails: locationDetails || null,
                        notes: `PROVISIONAL_REQUEST:${request.id}`
                    }
                })
            }
        }

        const session = await auth() as any

        if (user?.managerId) {
            await prisma.notification.create({
                data: {
                    userId: user.managerId,
                    title: "Attendance Correction Request",
                    message: `${user.name} requesting correction for ${type} on ${localDateStr}`,
                    type: "LEAVE_REQUEST",
                    link: "/user/manager"
                }
            })

            // Send Email
            if (user.manager?.email && session?.accessToken) {
                await sendLeaveRequestEmail({
                    managerName: user.manager.name || "Manager",
                    managerEmail: user.manager.email,
                    userName: user.name || "Employee",
                    userEmail: user.email,
                    userAccessToken: session.accessToken,
                    leaveType: `Correction: ${type}`,
                    startDate: localDateStr,
                    endDate: localDateStr,
                    duration: `${eventTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: user.manager?.selectedTimezone || 'Asia/Manila' })} (Your Time) / ${eventTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone })} (Staff Time)`,
                    reason: reason,
                    leaveId: request.id,
                    refreshToken: session.refreshToken,
                    customTitle: 'Correction Request'
                })
            }
        }

        // Update Summary
        await updateAttendanceSummary(userId, normalizedDate)

        // Log Activity
        await logActivity({
            userId,
            action: 'ATTENDANCE_REQUEST_SUBMIT',
            entityType: 'ATTENDANCE_REQUEST',
            entityId: request.id,
            details: { type, date: normalizedDate, time: eventTime, reason }
        })

        broadcastUpdate('attendance', request)
        return NextResponse.json(request)
    } catch (error) {
        console.error("Failed to create attendance request:", error)
        return NextResponse.json({ error: "Failed to create request" }, { status: 500 })
    }
}
