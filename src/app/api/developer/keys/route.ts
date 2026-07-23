import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateApiKey } from '@/lib/api-keys'
import { logActivity } from '@/lib/db-utils'

export const dynamic = 'force-dynamic'

const MAX_KEYS_PER_USER = 10

async function requireDeveloper() {
    const session = await auth()
    if (!session?.user?.id) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    const roles = session.user.roles || []
    if (!roles.includes('DEVELOPER')) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
    return { userId: session.user.id as string }
}

// List the caller's own API keys (never exposes hashes or plaintext).
export async function GET() {
    const gate = await requireDeveloper()
    if ('error' in gate) return gate.error

    const keys = await prisma.apiKey.findMany({
        where: { userId: gate.userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, keyPrefix: true, createdAt: true, lastUsedAt: true, revokedAt: true },
    })
    return NextResponse.json({ keys })
}

// Create a named key. The plaintext is returned ONCE in this response and
// never stored or shown again.
export async function POST(request: Request) {
    const gate = await requireDeveloper()
    if ('error' in gate) return gate.error

    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : ''
    if (!name) {
        return NextResponse.json({ error: 'A key name is required' }, { status: 400 })
    }

    const activeCount = await prisma.apiKey.count({ where: { userId: gate.userId, revokedAt: null } })
    if (activeCount >= MAX_KEYS_PER_USER) {
        return NextResponse.json({ error: `Limit of ${MAX_KEYS_PER_USER} active keys reached — revoke one first` }, { status: 400 })
    }

    const { plaintext, keyHash, keyPrefix } = generateApiKey()
    const key = await prisma.apiKey.create({
        data: { name, keyHash, keyPrefix, userId: gate.userId },
        select: { id: true, name: true, keyPrefix: true, createdAt: true },
    })

    logActivity({
        userId: gate.userId,
        action: 'CREATE',
        entityType: 'API_KEY',
        entityId: key.id,
        details: `Created API key "${name}" (${keyPrefix}…)`,
    })

    return NextResponse.json({ key: { ...key, plaintext } }, { status: 201 })
}
