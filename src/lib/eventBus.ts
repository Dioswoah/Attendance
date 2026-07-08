import { EventEmitter } from 'events'
import Redis from 'ioredis'

const CHANNEL = 'attendance:updates'

// In-process emitter — SSE handlers subscribe to this
const globalForEvents = globalThis as unknown as {
    eventBus: EventEmitter
    redisPub: Redis | null
    redisSub: Redis | null
}

export const eventBus: EventEmitter =
    globalForEvents.eventBus || (globalForEvents.eventBus = new EventEmitter())

eventBus.setMaxListeners(200) // 80 users + headroom

// Set up Redis Pub/Sub only once per process
function initRedisPubSub() {
    const url = process.env.REDIS_URL
    if (!url) return

    if (!globalForEvents.redisPub) {
        globalForEvents.redisPub = new Redis(url, {
            maxRetriesPerRequest: null, // keep retrying for pub/sub
            enableReadyCheck: true,
            lazyConnect: true,
            connectTimeout: 5000,
        })
        globalForEvents.redisPub.on('error', (err) =>
            console.error('[Redis Pub] error:', err.message)
        )
    }

    if (!globalForEvents.redisSub) {
        globalForEvents.redisSub = new Redis(url, {
            maxRetriesPerRequest: null,
            enableReadyCheck: true,
            lazyConnect: true,
            connectTimeout: 5000,
        })
        globalForEvents.redisSub.on('error', (err) =>
            console.error('[Redis Sub] error:', err.message)
        )

        // Forward messages from Redis into the local in-process emitter
        globalForEvents.redisSub.subscribe(CHANNEL, (err) => {
            if (err) console.error('[Redis Sub] subscribe error:', err.message)
        })
        globalForEvents.redisSub.on('message', (_channel, message) => {
            try {
                const data = JSON.parse(message)
                // Emit locally WITHOUT re-publishing to avoid echo loops
                eventBus.emit('update:local', data)
            } catch {
                // Malformed message — ignore
            }
        })

        // When no Redis, local emit goes to 'update'. Wire local events from Redis to 'update'.
        eventBus.on('update:local', (data) => eventBus.emit('update', data))
    }
}

// Broadcast an update to all instances via Redis (falls back to local if no Redis)
export const broadcastUpdate = (
    type: 'attendance' | 'leaves' | 'staff' | 'notification' | 'validation',
    data?: unknown
) => {
    const payload = { type, data, timestamp: new Date().toISOString() }

    if (globalForEvents.redisPub) {
        globalForEvents.redisPub
            .publish(CHANNEL, JSON.stringify(payload))
            .catch((err) => {
                // Redis publish failed — fall back to local emit only
                console.error('[Redis Pub] publish failed, falling back local:', err.message)
                eventBus.emit('update', payload)
            })
    } else {
        // No Redis configured — local in-process broadcast (single instance)
        eventBus.emit('update', payload)
    }
}

// Initialize pub/sub on module load (Next.js hot-reload safe)
if (typeof process !== 'undefined') {
    initRedisPubSub()
}
