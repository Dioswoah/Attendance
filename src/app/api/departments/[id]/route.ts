import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidateCache, CacheKeys } from '@/lib/cache'

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { name } = await req.json()

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 })
        }

        const updated = await prisma.department.update({
            where: { id },
            data: { name }
        })

        void invalidateCache(CacheKeys.departments, CacheKeys.staffDashboard, CacheKeys.employees)
        return NextResponse.json(updated)
    } catch (error) {
        console.error("Update department error:", error)
        return NextResponse.json({ error: 'Failed to update department' }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        await prisma.user.updateMany({
            where: { departmentId: id },
            data: { departmentId: null }
        })

        await prisma.department.update({
            where: { id },
            data: { deletedAt: new Date() }
        })

        void invalidateCache(CacheKeys.departments, CacheKeys.staffDashboard, CacheKeys.employees)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Delete department error:", error)
        return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 })
    }
}
