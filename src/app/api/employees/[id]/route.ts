import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await req.json()
        const { name, email, departmentId } = body

        const updated = await prisma.user.update({
            where: { id },
            data: {
                name,
                email,
                departmentId: departmentId || null
            }
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
        await prisma.user.delete({
            where: { id }
        })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Delete employee error:", error)
        return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 })
    }
}
