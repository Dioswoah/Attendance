import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as { redis: Redis | null }

function createRedisClient(): Redis | null {
    const url = process.env.REDIS_URL
    if (!url) return null

    const client = new Redis(url, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        connectTimeout: 5000,
        commandTimeout: 2000,
    })

    client.on('error', (err) => {
        // Log but never crash the app — fall back to DB if Redis is down
        console.error('[Redis] connection error:', err.message)
    })

    return client
}

export const redis: Redis | null =
    process.env.NODE_ENV === 'production'
        ? (globalForRedis.redis ?? (globalForRedis.redis = createRedisClient()))
        : (globalForRedis.redis ?? (globalForRedis.redis = createRedisClient()))
