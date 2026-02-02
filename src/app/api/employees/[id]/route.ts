import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await req.json()
        const { name, email, departmentId, roles, managerId, isArchived, location } = body
        const updateData: any = {}
        if (name !== undefined) updateData.name = name
        if (email !== undefined) updateData.email = email
        if (departmentId !== undefined) updateData.departmentId = departmentId === "unassigned" ? null : departmentId
        if (roles !== undefined) updateData.roles = roles
        if (managerId !== undefined) updateData.managerId = managerId === "unassigned" ? null : managerId
        if (isArchived !== undefined) updateData.isArchived = isArchived
        if (location !== undefined) updateData.location = location

        const updated = await prisma.user.update({
            where: { id },
            data: updateData
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error("Update employee error:", error)
        return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 })
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
