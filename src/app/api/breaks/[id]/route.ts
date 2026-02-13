import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { broadcastUpdate } from "@/lib/eventBus"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const breakRecord = await prisma.break.findUnique({
            where: { id },
            include: {
                attendance: {
                    select: {
                        id: true,
                        date: true,
                        clockIn: true,
                        clockOut: true,
                        user: {
                            select: {
                                name: true,
                                department: {
                                    select: {
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })

        if (!breakRecord) {
            return NextResponse.json({ error: "Break record not found" }, { status: 404 })
        }

        return NextResponse.json({
            ...breakRecord,
            date: breakRecord.attendance.date,
            userName: breakRecord.attendance.user.name,
            department: breakRecord.attendance.user.department?.name
        })
    } catch (error) {
        console.error('Error fetching break record:', error)
        return NextResponse.json({ error: "Failed to fetch break record" }, { status: 500 })
    }
}


export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const body = await req.json()

        // 1. Fetch the break with attendance to know who it belongs to
        const existingBreak = await prisma.break.findUnique({
            where: { id },
            include: { attendance: true }
        })

        if (!existingBreak) {
            return NextResponse.json({ error: "Break record not found" }, { status: 404 })
        }

        // 2. Perform the update
        const updatedBreak = await prisma.break.update({
            where: { id },
            data: {
                startTime: body.startTime ? new Date(body.startTime) : undefined,
                endTime: body.endTime ? new Date(body.endTime) : undefined,
            }
        })

        // 3. Sync with Attendance convenience fields
        // Get the latest NON-DELETED break for this attendance
        const latestBreak = await prisma.break.findFirst({
            where: {
                attendanceId: existingBreak.attendanceId,
                deletedAt: null
            },
            orderBy: { startTime: 'desc' }
        })

        const attendanceUpdate: any = {
            breakStart: latestBreak?.startTime || null,
            breakEnd: latestBreak?.endTime || null
        }

        const updatedAttendance = await prisma.attendance.update({
            where: { id: existingBreak.attendanceId },
            data: attendanceUpdate
        })

        // 4. Update User Availability Status if session is active
        if (updatedAttendance.clockOut === null) {
            let newStatus: 'AVAILABLE' | 'BE_RIGHT_BACK' = 'AVAILABLE'

            // If the LATEST break is still ongoing, user is BE_RIGHT_BACK
            if (latestBreak && !latestBreak.endTime) {
                newStatus = 'BE_RIGHT_BACK'
            }

            await prisma.user.update({
                where: { id: updatedAttendance.userId },
                data: { availabilityStatus: newStatus }
            })
        }

        // 5. Broadcast updates
        broadcastUpdate('attendance', updatedAttendance)
        broadcastUpdate('staff')

        return NextResponse.json(updatedBreak)
    } catch (error) {
        console.error("PATCH break error:", error)
        return NextResponse.json({ error: "Failed to update break record" }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        // 1. Fetch the break with attendance
        const existingBreak = await prisma.break.findUnique({
            where: { id },
            include: { attendance: true }
        })

        if (!existingBreak) {
            return NextResponse.json({ error: "Break record not found" }, { status: 404 })
        }

        // 2. Soft delete
        await prisma.break.update({
            where: { id },
            data: { deletedAt: new Date() }
        })

        // 3. Sync with Attendance convenience fields
        const latestBreak = await prisma.break.findFirst({
            where: {
                attendanceId: existingBreak.attendanceId,
                deletedAt: null
            },
            orderBy: { startTime: 'desc' }
        })

        const attendanceUpdate: any = {
            breakStart: latestBreak?.startTime || null,
            breakEnd: latestBreak?.endTime || null
        }

        const updatedAttendance = await prisma.attendance.update({
            where: { id: existingBreak.attendanceId },
            data: attendanceUpdate
        })

        // 4. Update User status
        if (updatedAttendance.clockOut === null) {
            let newStatus: 'AVAILABLE' | 'BE_RIGHT_BACK' = 'AVAILABLE'
            if (latestBreak && !latestBreak.endTime) {
                newStatus = 'BE_RIGHT_BACK'
            }
            await prisma.user.update({
                where: { id: updatedAttendance.userId },
                data: { availabilityStatus: newStatus }
            })
        }

        // 5. Broadcast
        broadcastUpdate('attendance', updatedAttendance)
        broadcastUpdate('staff')

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("DELETE break error:", error)
        return NextResponse.json({ error: "Failed to delete break record" }, { status: 500 })
    }
}
