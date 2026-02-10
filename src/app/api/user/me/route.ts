import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { manager: true }
    })
    return NextResponse.json(user)
}

export async function PATCH(req: Request) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { location, managerId, departmentId } = body

    const updateData: any = {}
    if (location !== undefined) {
        updateData.location = location
        // SYNC: Auto-set timezone based on location for primary regions
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

    const updated = await prisma.user.update({
        where: { id: session.user.id },
        data: updateData
    })
    return NextResponse.json(updated)
}
