// simPRO API client — READ-ONLY BY DESIGN.
// Hard rule for this integration: we only ever VIEW/FETCH data from simPRO.
// This module deliberately exposes no POST/PUT/PATCH/DELETE capability so a
// write against simPRO cannot happen by accident anywhere in the app.

export const SIMPRO_COMPANY_IDS = [1, 10] as const // 1 = Labrobin/Red Men, 10 = Adair Evacuation

const PAGE_SIZE = 250

function baseUrl(): string {
    const url = process.env.SIMPRO_BASE_URL
    if (!url) throw new Error('SIMPRO_BASE_URL is not configured')
    return url.replace(/\/+$/, '')
}

function token(): string {
    const t = process.env.SIMPRO_TOKEN
    if (!t) throw new Error('SIMPRO_TOKEN is not configured')
    return t
}

export function isSimproConfigured(): boolean {
    return Boolean(process.env.SIMPRO_BASE_URL && process.env.SIMPRO_TOKEN)
}

// Staging runs without Redis, so a small in-memory TTL cache keeps us well
// under simPRO's API call limits (max-instances is 1 there, so this is safe).
const memCache = new Map<string, { expires: number; data: unknown }>()

function cacheGet<T>(key: string): T | undefined {
    const hit = memCache.get(key)
    if (!hit) return undefined
    if (Date.now() > hit.expires) {
        memCache.delete(key)
        return undefined
    }
    return hit.data as T
}

function cacheSet(key: string, data: unknown, ttlMs: number) {
    if (memCache.size > 500) memCache.clear()
    memCache.set(key, { expires: Date.now() + ttlMs, data })
}

// Global throttle + retry: a full technician sweep fans out ~80 GETs
// (27 techs x job + timelines), which trips simPRO's rate limit (HTTP 429).
// Keep a small number in flight, retry 429s with backoff, and dedupe
// identical concurrent requests (the UI route and the clock-in processor
// sweep the same paths back-to-back).
const MAX_CONCURRENT = 4
let activeRequests = 0
const slotQueue: (() => void)[] = []

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (activeRequests >= MAX_CONCURRENT) {
        await new Promise<void>((resolve) => slotQueue.push(resolve))
    }
    activeRequests++
    try {
        return await fn()
    } finally {
        activeRequests--
        slotQueue.shift()?.()
    }
}

const inflight = new Map<string, Promise<unknown>>()

async function simproGet<T>(path: string, ttlMs: number): Promise<T> {
    const cached = cacheGet<T>(path)
    if (cached !== undefined) return cached

    const pending = inflight.get(path)
    if (pending) return pending as Promise<T>

    const request = withSlot(async () => {
        // A concurrent caller may have populated the cache while we queued.
        const recheck = cacheGet<T>(path)
        if (recheck !== undefined) return recheck

        for (let attempt = 1; attempt <= 4; attempt++) {
            const res = await fetch(`${baseUrl()}/api/v1.0${path}`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token()}`,
                    Accept: 'application/json',
                },
                cache: 'no-store',
            })
            if (res.status === 429 && attempt < 4) {
                const retryAfter = Number(res.headers.get('retry-after'))
                const waitSec = Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : attempt, 10)
                await new Promise((r) => setTimeout(r, waitSec * 1000))
                continue
            }
            if (!res.ok) {
                throw new Error(`simPRO GET ${path} failed with HTTP ${res.status}`)
            }
            const data = (await res.json()) as T
            cacheSet(path, data, ttlMs)
            return data
        }
        throw new Error(`simPRO GET ${path} rate-limited after retries`)
    }).finally(() => inflight.delete(path))

    inflight.set(path, request)
    return request as Promise<T>
}

async function simproGetAllPages<T>(pathWithQuery: string, ttlMs: number): Promise<T[]> {
    const results: T[] = []
    const sep = pathWithQuery.includes('?') ? '&' : '?'
    for (let page = 1; page <= 20; page++) {
        const batch = await simproGet<T[]>(`${pathWithQuery}${sep}pageSize=${PAGE_SIZE}&page=${page}`, ttlMs)
        results.push(...batch)
        if (batch.length < PAGE_SIZE) break
    }
    return results
}

// ── Types (fields verified against the live API) ──────────────────────────

export interface SimproScheduleBlock {
    Hrs: number
    StartTime: string // "08:00"
    EndTime: string
    ISO8601StartTime: string // "2026-07-15T08:00:00+10:00"
    ISO8601EndTime: string
}

export interface SimproSchedule {
    ID: number
    Type: string // "job" | "activity"
    Reference: string // "445672-368311" (jobId-costCenterId)
    TotalHours: number
    Staff: { ID: number; Name: string; Type: string }
    Date: string // "2026-07-15"
    Blocks: SimproScheduleBlock[]
}

export interface SimproJob {
    ID: number
    Type?: string
    Name?: string
    Customer?: { CompanyName?: string; GivenName?: string; FamilyName?: string }
    Site?: { ID?: number; Name?: string }
    Status?: { ID?: number; Name?: string; Color?: string }
    Stage?: string
}

export interface SimproTimelineEntry {
    Type: string // "Mobile Status" | "Schedule" | "General Message" | ...
    Message: string
    Staff?: { ID: number; Name: string }
    Date: string // ISO8601 with offset
}

// Placeholder jobs (on-call/standby rosters like "YOU ARE ON CALL****") that
// techs never mark Completed — they must not drive the clock-out signal.
export function isPlaceholderJob(job: SimproJob): boolean {
    return /\bon.?call\b|\bstand.?by\b|\*{3,}/i.test(`${job.Site?.Name ?? ''} ${job.Name ?? ''}`)
}

// ── Read-only fetchers ─────────────────────────────────────────────────────

/** All schedule entries for one company on one date (YYYY-MM-DD). */
export async function getSchedulesForDate(companyId: number, date: string): Promise<SimproSchedule[]> {
    return simproGetAllPages<SimproSchedule>(
        `/companies/${companyId}/schedules/?Date=${date}`,
        60_000,
    )
}

/** Job header info (customer, site, status + calendar color). Cached longer — changes rarely. */
export async function getJob(companyId: number, jobId: number): Promise<SimproJob> {
    return simproGet<SimproJob>(
        `/companies/${companyId}/jobs/${jobId}?columns=ID,Type,Name,Customer,Site,Status,Stage`,
        5 * 60_000,
    )
}

/** Activity timeline of a job (mobile statuses, schedule entries, system messages). */
export async function getJobTimelines(companyId: number, jobId: number): Promise<SimproTimelineEntry[]> {
    return simproGetAllPages<SimproTimelineEntry>(
        `/companies/${companyId}/jobs/${jobId}/timelines/`,
        45_000,
    )
}
