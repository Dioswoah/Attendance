import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await req.json()
        console.log(`Updating employee ${id} with body:`, JSON.stringify(body, null, 2))

        const { name, email, departmentId, roles, managerId, isArchived, location, shiftStartTime } = body
        const updateData: any = {}
        if (name !== undefined) updateData.name = name
        if (email !== undefined) updateData.email = email

        // Use relation updates instead of scalars as the client seems out of sync
        if (departmentId !== undefined) {
            const val = (departmentId && departmentId !== "unassigned") ? departmentId : null
            updateData.department = val ? { connect: { id: val } } : { disconnect: true }
        }

        if (roles !== undefined && Array.isArray(roles)) {
            updateData.roles = { set: roles }
        }

        if (managerId !== undefined) {
            const val = (managerId && managerId !== "unassigned") ? managerId : null
            updateData.manager = val ? { connect: { id: val } } : { disconnect: true }
        }

        if (isArchived !== undefined) updateData.isArchived = isArchived
        if (location !== undefined) {
            updateData.location = location
            // SYNC: Update timezone based on location for primary regions
            if (location === 'Philippines') {
                updateData.selectedTimezone = 'Asia/Manila'
                updateData.useCurrentTimezone = false
            } else if (location === 'Australia') {
                updateData.selectedTimezone = 'Australia/Sydney'
                updateData.useCurrentTimezone = false
            }
        }
        if (shiftStartTime !== undefined) updateData.shiftStartTime = shiftStartTime

        console.log("Applying Prisma update with data:", JSON.stringify(updateData, null, 2))

        const updated = await prisma.user.update({
            where: { id },
            data: updateData
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error("Update employee error details:", error)
        return NextResponse.json({ error: 'Failed to update employee: ' + (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await prisma.user.update({
            where: { id },
            data: { deletedAt: new Date() }
        })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Delete employee error:", error)
        return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 })
    }
}
