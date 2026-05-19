import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { manager: true, department: true, secondaryDepartments: true }
    })
    return NextResponse.json(user, {
        headers: {
            'Cache-Control': 'no-store, max-age=0'
        }
    })
}

export async function PATCH(req: Request) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { location, managerId, departmentId, secondaryDepartmentIds, shiftStartTime, shiftEndTime, managerNotificationsEnabled } = body

    const updateData: any = {}
    if (location !== undefined) {
        updateData.employmentLocation = location
        if (location === 'Philippines') {
            updateData.selectedTimezone = 'Asia/Manila'
            updateData.useCurrentTimezone = false
        } else if (location === 'Australia') {
            updateData.selectedTimezone = 'Australia/Sydney'
            updateData.useCurrentTimezone = false
        }
    }
    if (managerId !== undefined) updateData.managerId = managerId === "unassigned" ? null : managerId
    if (departmentId !== undefined) updateData.departmentId = departmentId === "unassigned" ? null : departmentId
    if (secondaryDepartmentIds !== undefined) {
        updateData.secondaryDepartments = { set: secondaryDepartmentIds.map((id: string) => ({ id })) }
    }
    if (shiftStartTime !== undefined) updateData.shiftStartTime = shiftStartTime
    if (shiftEndTime !== undefined) updateData.shiftEndTime = shiftEndTime
    if (managerNotificationsEnabled !== undefined) updateData.managerNotificationsEnabled = managerNotificationsEnabled

    const updated = await prisma.user.update({
        where: { id: session.user.id },
        data: updateData,
        include: { manager: true, department: true, secondaryDepartments: true }
    })
    return NextResponse.json(updated)
}
