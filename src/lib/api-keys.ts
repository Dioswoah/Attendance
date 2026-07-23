import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

// Developer-portal API keys for the public read-only v1 API.
// Keys look like `rsa_<64 hex chars>`; only the SHA-256 hash is stored.

const KEY_PREFIX = 'rsa_'

export function generateApiKey(): { plaintext: string; keyHash: string; keyPrefix: string } {
    const plaintext = KEY_PREFIX + randomBytes(32).toString('hex')
    return {
        plaintext,
        keyHash: hashApiKey(plaintext),
        // Enough to recognise the key in the UI without being usable.
        keyPrefix: plaintext.slice(0, 12),
    }
}

export function hashApiKey(plaintext: string): string {
    return createHash('sha256').update(plaintext).digest('hex')
}

export type ApiKeyAuth = {
    userId: string
    keyId: string
    userName: string | null
}

// Authenticates a public v1 request. Accepts the key via
// `Authorization: Bearer <key>` or `x-api-key: <key>`.
// Returns null when the key is missing, unknown, revoked, or its owner
// is archived / no longer a DEVELOPER.
export async function authenticateApiKey(request: Request): Promise<ApiKeyAuth | null> {
    const authHeader = request.headers.get('authorization')
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
    const plaintext = bearer || request.headers.get('x-api-key')?.trim()
    if (!plaintext || !plaintext.startsWith(KEY_PREFIX)) return null

    const key = await prisma.apiKey.findUnique({
        where: { keyHash: hashApiKey(plaintext) },
        include: { user: { select: { id: true, name: true, roles: true, isArchived: true, deletedAt: true } } },
    })
    if (!key || key.revokedAt) return null
    if (key.user.isArchived || key.user.deletedAt || !key.user.roles.includes('DEVELOPER')) return null

    // Best-effort usage stamp + log — never blocks or fails the request.
    prisma.apiKey
        .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
        .catch(() => {})
    prisma.apiKeyUsageLog
        .create({ data: { apiKeyId: key.id, endpoint: new URL(request.url).pathname } })
        .catch(() => {})

    return { userId: key.user.id, keyId: key.id, userName: key.user.name }
}

// Shared pagination parsing for v1 list endpoints.
export function parsePagination(searchParams: URLSearchParams): { page: number; pageSize: number; skip: number } {
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10) || 50))
    return { page, pageSize, skip: (page - 1) * pageSize }
}
