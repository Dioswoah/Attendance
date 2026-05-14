import { redis } from './redis'

// Cache key prefixes — used for targeted invalidation
export const CacheKeys = {
    employees: 'employees:all',
    managers: 'managers:all',
    departments: 'departments:all',
    staffDashboard: 'dashboard:staff',
    attendanceSummary: (filters: string) => `attendance:summary:${filters}`,
    leaves: (filters: string) => `leaves:${filters}`,
    attendanceRequests: (filters: string) => `attendance-requests:${filters}`,
} as const

// Default TTLs in seconds
const TTL = {
    employees: 600,        // 10 min — changes only on hire/fire/edit
    managers: 1800,        // 30 min — role changes are rare
    departments: 3600,     // 1 hour — almost never changes
    staffDashboard: 15,    // 15 sec — near real-time attendance state
    attendanceSummary: 120, // 2 min — historical summaries
    leaves: 120,           // 2 min — leave lists
    attendanceRequests: 60, // 1 min — pending requests
} as const

export async function getCache<T>(key: string): Promise<T | null> {
    if (!redis) return null
    try {
        const raw = await redis.get(key)
        if (!raw) return null
        return JSON.parse(raw) as T
    } catch {
        return null
    }
}

export async function setCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!redis) return
    try {
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    } catch {
        // Non-fatal — app continues without cache
    }
}

// Invalidate one or more cache keys (pass prefixes to wipe patterns)
export async function invalidateCache(...keys: string[]): Promise<void> {
    if (!redis || keys.length === 0) return
    try {
        await redis.del(...keys)
    } catch {
        // Non-fatal
    }
}

// Scan and delete all keys matching a prefix pattern (e.g. "leaves:*")
export async function invalidateCachePattern(pattern: string): Promise<void> {
    if (!redis) return
    try {
        let cursor = '0'
        do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
            cursor = nextCursor
            if (keys.length > 0) await redis.del(...keys)
        } while (cursor !== '0')
    } catch {
        // Non-fatal
    }
}

export { TTL }
