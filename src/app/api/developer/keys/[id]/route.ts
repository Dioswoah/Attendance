import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/db-utils'

export const dynamic = 'force-dynamic'

// Revoke one of the caller's own keys. Soft-revoke (revokedAt) so usage
// history stays auditable; revoked keys are rejected by authenticateApiKey.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(session.user.roles || []).includes('DEVELOPER')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const key = await prisma.apiKey.findUnique({ where: { id } })
    if (!key || key.userId !== session.user.id) {
        return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    }
    if (key.revokedAt) {
        return NextResponse.json({ error: 'Key is already revoked' }, { status: 400 })
    }

    await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } })

    logActivity({
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'API_KEY',
        entityId: id,
        details: `Revoked API key "${key.name}" (${key.keyPrefix}…)`,
    })

    return NextResponse.json({ success: true })
}
