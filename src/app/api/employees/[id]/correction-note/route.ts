import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { broadcastUpdate } from '@/lib/eventBus'
import { invalidateCache, CacheKeys } from '@/lib/cache'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const session = await auth()
        const roles = (session?.user as any)?.roles || []
        if (!session?.user?.id || (!roles.includes('MANAGER') && !roles.includes('ADMIN'))) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 })
        }

        const { note } = await req.json()

        const updated = await prisma.user.update({
            where: { id },
            data: { correctionNote: note || null }
        })

        void invalidateCache(CacheKeys.employees, CacheKeys.managers, CacheKeys.staffDashboard)
        broadcastUpdate('staff')

        return NextResponse.json({ id: updated.id, correctionNote: updated.correctionNote })
    } catch (error) {
        console.error("PATCH correction-note error:", error)
        return NextResponse.json({ error: "Failed to update correction note" }, { status: 500 })
    }
}
