import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Oversight view for ADMINs — every API key across all developer-role staff,
// not just the caller's own (never exposes hashes or plaintext).
export async function GET() {
    const session = await auth()
    if (!session?.user?.roles?.includes('ADMIN')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const keys = await prisma.apiKey.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true, name: true, keyPrefix: true, createdAt: true, lastUsedAt: true, revokedAt: true,
            user: { select: { id: true, name: true, email: true } },
        },
    })
    return NextResponse.json({ keys })
}
