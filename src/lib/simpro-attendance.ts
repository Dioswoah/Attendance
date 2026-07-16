// simPRO-driven technician attendance.
//
// Flow: each field tech's FIRST scheduled job of the (Sydney) day is resolved
// from simPRO schedules; its activity timeline tells us when the tech set
// Travelling / On Site from the simPRO mobile app. That event becomes their
// RSA clock-in — but ONLY when SIMPRO_ATTENDANCE_WRITE=true. With the flag
// off this module is a pure read-only status view.
//
// simPRO itself is never written to (see src/lib/simpro.ts — GET only).

import { prisma } from '@/lib/prisma'
import {
    SIMPRO_COMPANY_IDS,
    getJob,
    getJobTimelines,
    getSchedulesForDate,
    isSimproConfigured,
    type SimproSchedule,
    type SimproTimelineEntry,
} from '@/lib/simpro'
import { SIMPRO_FIELD_ROSTER } from '@/lib/simpro-roster'
import { logActivity, updateAttendanceSummary } from '@/lib/db-utils'
import { invalidateCache, CacheKeys } from '@/lib/cache'
import { broadcastUpdate } from '@/lib/eventBus'

const SYDNEY_TZ = 'Australia/Sydney'

export function sydneyToday(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: SYDNEY_TZ })
}

export type SimproMobileStatus = 'NO_SCHEDULE' | 'NOT_STARTED' | 'TRAVELLING' | 'ON_SITE' | 'COMPLETED'

export interface TechDayStatus {
    simproEmployeeId: number
    name: string
    rsaEmail: string
    userId: string | null
    jobCount: number
    firstJob: {
        companyId: number
        jobId: number
        reference: string
        startTime: string | null
        endTime: string | null
        customer: string | null
        site: string | null
        jobStatusName: string | null
        jobStatusColor: string | null
    } | null
    simproStatus: SimproMobileStatus
    simproStatusAt: string | null // ISO timestamp of the latest mobile-status event
    simproStatusMessage: string | null
    simproFirstStartedAt: string | null // when the tech FIRST went Travelling/On Site on the first job — this is the clock-in time
    lastJob: {
        companyId: number
        jobId: number
        reference: string
        completedAt: string | null // tech marked Completed on their final job of the day
    } | null
    rsa: {
        clockedInToday: boolean
        clockInAt: string | null
        clockOutAt: string | null
        source: string | null
    }
}

function parseMobileStatus(message: string): Exclude<SimproMobileStatus, 'NO_SCHEDULE' | 'NOT_STARTED'> | null {
    const m = message.toLowerCase()
    if (!m.includes('mobile status')) return null
    // simPRO can bundle several updates into one timeline entry, NEWEST FIRST,
    // separated by <br /> — e.g. "Mobile status set to Onsite (07:50)<br />
    // Mobile status set to Travelling (07:27)". Only the first segment is the
    // tech's current state.
    const latest = m.split(/<br\s*\/?>/)[0]
    if (/on[\s-]?site|onsite|arrived/.test(latest)) return 'ON_SITE'
    if (/travell?ing/.test(latest)) return 'TRAVELLING'
    if (/complete/.test(latest)) return 'COMPLETED'
    return null
}

// A bundled entry ("Onsite (07:50)<br />Travelling (07:27)") carries the earlier
// status change only inside the text — recover the earliest (HH:MM) so clock-in
// reflects when the tech actually started, not when simPRO synced the events.
function earliestTimeInMessage(message: string, entryAt: string): string {
    const times = [...message.matchAll(/\((\d{1,2}):(\d{2})\)/g)]
        .map((m) => `${m[1].padStart(2, '0')}:${m[2]}`)
        .sort()
    if (!times.length) return entryAt
    const m = entryAt.match(/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2})?(.*)$/)
    if (!m) return entryAt
    return `${m[1]}T${times[0]}:00${m[2] || ''}`
}

function firstBlockStart(s: SimproSchedule): string | null {
    const starts = (s.Blocks || []).map((b) => b.ISO8601StartTime).filter(Boolean).sort()
    return starts[0] ?? null
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length)
    let next = 0
    async function worker() {
        while (next < items.length) {
            const i = next++
            results[i] = await fn(items[i])
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
    return results
}

/**
 * Live per-technician view for one Sydney date: first job + simPRO mobile
 * status + RSA attendance state. Read-only — safe to call from UI routes.
 */
export async function getTechDayStatuses(date?: string): Promise<TechDayStatus[]> {
    if (!isSimproConfigured()) throw new Error('simPRO is not configured on this deployment')
    const day = date || sydneyToday()

    // 1) All schedules for the day across both companies, grouped per tech.
    const perCompany = await Promise.all(
        SIMPRO_COMPANY_IDS.map(async (companyId) => ({
            companyId,
            schedules: await getSchedulesForDate(companyId, day).catch((err) => {
                console.error(`[simPRO] schedules fetch failed for company ${companyId}:`, err)
                return [] as SimproSchedule[]
            }),
        })),
    )

    const byTech = new Map<number, { companyId: number; schedule: SimproSchedule }[]>()
    for (const { companyId, schedules } of perCompany) {
        for (const s of schedules) {
            if (s.Type !== 'job') continue
            if (s.Staff?.Type && s.Staff.Type !== 'employee') continue
            const list = byTech.get(s.Staff.ID) || []
            list.push({ companyId, schedule: s })
            byTech.set(s.Staff.ID, list)
        }
    }

    // 2) RSA users + today's attendance for the whole roster in two queries.
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { simproEmployeeId: { in: SIMPRO_FIELD_ROSTER.map((r) => r.simproEmployeeId) } },
                { email: { in: SIMPRO_FIELD_ROSTER.map((r) => r.rsaEmail), mode: 'insensitive' } },
            ],
            deletedAt: null,
        },
        select: { id: true, email: true, simproEmployeeId: true },
    })
    const targetDate = new Date(`${day}T00:00:00Z`)
    const attendanceRows = await prisma.attendance.findMany({
        where: { userId: { in: users.map((u) => u.id) }, date: targetDate, deletedAt: null, clockIn: { not: null } },
        orderBy: { clockIn: 'asc' },
        select: { userId: true, clockIn: true, clockOut: true, source: true },
    })

    // 3) Resolve each roster tech's first job, then fetch its details + timeline.
    const statuses = await mapWithConcurrency(SIMPRO_FIELD_ROSTER, 5, async (tech): Promise<TechDayStatus> => {
        const user =
            users.find((u) => u.simproEmployeeId === tech.simproEmployeeId) ||
            users.find((u) => u.email.toLowerCase() === tech.rsaEmail.toLowerCase()) ||
            null
        const att = user ? attendanceRows.find((a) => a.userId === user.id) : undefined
        const rsa = {
            clockedInToday: Boolean(att),
            clockInAt: att?.clockIn?.toISOString() ?? null,
            clockOutAt: att?.clockOut?.toISOString() ?? null,
            source: att?.source ?? null,
        }

        const jobs = (byTech.get(tech.simproEmployeeId) || []).sort((a, b) =>
            (firstBlockStart(a.schedule) || '9').localeCompare(firstBlockStart(b.schedule) || '9'),
        )
        if (jobs.length === 0) {
            return {
                simproEmployeeId: tech.simproEmployeeId, name: tech.displayName, rsaEmail: tech.rsaEmail,
                userId: user?.id ?? null, jobCount: 0, firstJob: null,
                simproStatus: 'NO_SCHEDULE', simproStatusAt: null, simproStatusMessage: null, simproFirstStartedAt: null, lastJob: null, rsa,
            }
        }

        // Status + clock-in come STRICTLY from the tech's FIRST job of the day
        // (Marc, 2026-07-16). Overlapping twins — jobs tied at the same earliest
        // start time — count as the first job, since techs tap their status on
        // either one. The last-job set is fetched too, only for the clock-out
        // signal. Later jobs are never fetched.
        const uniqueJobs: { companyId: number; jobId: number; reference: string; schedule: SimproSchedule; start: string }[] = []
        const seenJobs = new Set<string>()
        for (const j of jobs) {
            const id = parseInt(j.schedule.Reference.split('-')[0], 10)
            const key = `${j.companyId}:${id}`
            if (seenJobs.has(key)) continue
            seenJobs.add(key)
            uniqueJobs.push({ companyId: j.companyId, jobId: id, reference: j.schedule.Reference, schedule: j.schedule, start: firstBlockStart(j.schedule) || '9' })
        }

        const earliestStart = uniqueJobs[0].start
        const latestStart = uniqueJobs[uniqueJobs.length - 1].start
        const firstTied = uniqueJobs.filter((j) => j.start === earliestStart)
        const lastTied = uniqueJobs.filter((j) => j.start === latestStart)
        const scanJobs = uniqueJobs.filter((j) => j.start === earliestStart || j.start === latestStart)
        const inSet = (set: typeof uniqueJobs, e: { job: { companyId: number; jobId: number } }) =>
            set.some((j) => j.companyId === e.job.companyId && j.jobId === e.job.jobId)

        const timelines = await Promise.all(
            scanJobs.map(async (j) => ({
                job: j,
                timeline: await getJobTimelines(j.companyId, j.jobId).catch((err) => {
                    console.error(`[simPRO] timeline fetch failed for job ${j.jobId} (company ${j.companyId}):`, err)
                    return [] as SimproTimelineEntry[]
                }),
            })),
        )

        const events = timelines
            .flatMap(({ job, timeline }) =>
                timeline
                    .filter((t) => t.Type === 'Mobile Status' && t.Staff?.ID === tech.simproEmployeeId)
                    .filter((t) => (t.Date || '').startsWith(day))
                    .map((t) => ({ status: parseMobileStatus(t.Message), at: t.Date, message: t.Message, job })),
            )
            .filter((e) => e.status !== null)
            .sort((a, b) => a.at.localeCompare(b.at))

        let simproStatus: SimproMobileStatus = 'NOT_STARTED'
        let simproStatusAt: string | null = null
        let simproStatusMessage: string | null = null
        let simproFirstStartedAt: string | null = null

        const firstJobEvents = events.filter((e) => inSet(firstTied, e))
        const latest = firstJobEvents[firstJobEvents.length - 1]
        if (latest) {
            simproStatus = latest.status!
            simproStatusAt = latest.at
            simproStatusMessage = latest.message
        }
        // Clock-in time = when they FIRST went Travelling/On Site on the first
        // job — never the Completed time (unless Completed is the only event
        // they ever set).
        const startedEvents = firstJobEvents.filter((e) => e.status === 'TRAVELLING' || e.status === 'ON_SITE')
        const earliestEvent = startedEvents[0] ?? firstJobEvents[0]
        if (earliestEvent) {
            simproFirstStartedAt = earliestTimeInMessage(earliestEvent.message, earliestEvent.at)
        }

        // "First job" column: among jobs tied at the earliest start, prefer the
        // one the tech actually worked (where their earliest event lives).
        const first =
            (earliestEvent && firstTied.find((j) => j.companyId === earliestEvent.job.companyId && j.jobId === earliestEvent.job.jobId)) ||
            firstTied[0]
        const blocks = first.schedule.Blocks || []

        let customer: string | null = null
        let site: string | null = null
        let jobStatusName: string | null = null
        let jobStatusColor: string | null = null
        try {
            const job = await getJob(first.companyId, first.jobId)
            customer = job.Customer?.CompanyName?.trim() ||
                [job.Customer?.GivenName, job.Customer?.FamilyName].filter(Boolean).join(' ').trim() || null
            site = job.Site?.Name ?? null
            jobStatusName = job.Status?.Name ?? null
            jobStatusColor = job.Status?.Color ?? null
        } catch (err) {
            console.error(`[simPRO] job fetch failed for job ${first.jobId} (company ${first.companyId}):`, err)
        }

        // Clock-out signal: Completed on the LAST job of the day (any of the
        // jobs tied at the latest start time counts).
        const completedOnLast = events.filter((e) => e.status === 'COMPLETED' && inSet(lastTied, e))
        const lastCompleted = completedOnLast[completedOnLast.length - 1]
        const last = lastCompleted?.job ?? lastTied[lastTied.length - 1]

        return {
            simproEmployeeId: tech.simproEmployeeId, name: tech.displayName, rsaEmail: tech.rsaEmail,
            userId: user?.id ?? null, jobCount: jobs.length,
            firstJob: {
                companyId: first.companyId, jobId: first.jobId, reference: first.reference,
                startTime: blocks[0]?.ISO8601StartTime ?? null,
                endTime: blocks[blocks.length - 1]?.ISO8601EndTime ?? null,
                customer, site, jobStatusName, jobStatusColor,
            },
            simproStatus, simproStatusAt, simproStatusMessage, simproFirstStartedAt,
            lastJob: {
                companyId: last.companyId, jobId: last.jobId, reference: last.reference,
                completedAt: lastCompleted?.at ?? null,
            },
            rsa,
        }
    })

    return statuses
}

export interface SimproClockInResult {
    writeEnabled: boolean
    date: string
    checked: number
    created: number
    clockedOut: number
    skipped: { name: string; reason: string }[]
}

/**
 * Turn simPRO mobile-status events into RSA attendance:
 * - first job Travelling/On Site/Completed  -> clock-in at that event time
 * - LAST job of the day marked Completed    -> clock-out at that event time
 * Only writes when SIMPRO_ATTENDANCE_WRITE=true; never touches simPRO.
 *
 * All entry points (cron route, webhook, page piggyback) are serialized
 * through a single in-process queue — two concurrent sweeps both passed the
 * duplicate check before either wrote, producing double clock-ins.
 * NOTE for prod promotion: this only serializes within one instance; with
 * max-instances > 1 a cross-instance guard (partial unique index or Postgres
 * advisory lock) is needed.
 */
let sweepChain: Promise<unknown> = Promise.resolve()

export function processSimproClockIns(date?: string): Promise<SimproClockInResult> {
    const run = sweepChain.then(() => runSimproAttendanceSweep(date))
    sweepChain = run.then(() => undefined, () => undefined)
    return run
}

async function runSimproAttendanceSweep(date?: string): Promise<SimproClockInResult> {
    const day = date || sydneyToday()
    const writeEnabled = process.env.SIMPRO_ATTENDANCE_WRITE === 'true'
    const statuses = await getTechDayStatuses(day)
    const result: SimproClockInResult = { writeEnabled, date: day, checked: statuses.length, created: 0, clockedOut: 0, skipped: [] }
    if (!writeEnabled) return result

    const targetDate = new Date(`${day}T00:00:00Z`)
    for (const t of statuses) {
        const started = t.simproStatus === 'TRAVELLING' || t.simproStatus === 'ON_SITE' || t.simproStatus === 'COMPLETED'
        if (!started || !t.simproStatusAt) continue
        if (!t.userId) {
            result.skipped.push({ name: t.name, reason: 'no RSA user linked' })
            continue
        }
        if (t.rsa.clockedInToday) continue // manual/web/biometric clock-in already exists — never duplicate

        // Concurrency/safety guards mirroring the manual clock-in route.
        const activeSession = await prisma.attendance.findFirst({
            where: { userId: t.userId, clockOut: null, deletedAt: null },
        })
        if (activeSession) {
            result.skipped.push({ name: t.name, reason: 'already has an open session' })
            continue
        }
        const existing = await prisma.attendance.findFirst({
            where: { userId: t.userId, date: targetDate, deletedAt: null, clockIn: { not: null } },
        })
        if (existing) continue

        const clockIn = new Date(t.simproFirstStartedAt ?? t.simproStatusAt)
        const attendance = await prisma.attendance.create({
            data: {
                userId: t.userId,
                date: targetDate,
                clockIn, // always set — no placeholder rows, ever
                mode: 'ONSITE',
                status: 'PRESENT',
                source: 'SIMPRO',
                notes: `Auto clock-in from simPRO: ${t.simproStatusMessage || t.simproStatus} on job ${t.firstJob?.reference ?? ''}`.trim(),
            },
        })
        result.created++

        await prisma.user.update({ where: { id: t.userId }, data: { availabilityStatus: 'AVAILABLE' } })
        await invalidateCache(CacheKeys.staffDashboard)
        broadcastUpdate('attendance', attendance)
        updateAttendanceSummary(t.userId, targetDate).catch((e) =>
            console.error('[simPRO] summary update failed:', e),
        )
        logActivity({
            userId: t.userId,
            action: 'CLOCK_IN',
            entityType: 'ATTENDANCE',
            entityId: attendance.id,
            details: {
                source: 'SIMPRO',
                simproJob: t.firstJob?.reference,
                simproStatus: t.simproStatus,
                simproEvent: t.simproStatusMessage,
            },
        }).catch(() => {})
    }

    // Clock-outs: tech marked Completed on their final job of the day.
    // Closes any open session for the day regardless of how it was opened
    // (manual/web/biometric/simPRO) — one rule for all field techs.
    for (const t of statuses) {
        if (!t.userId || !t.lastJob?.completedAt) continue

        const open = await prisma.attendance.findFirst({
            where: { userId: t.userId, date: targetDate, deletedAt: null, clockIn: { not: null }, clockOut: null },
            orderBy: { clockIn: 'desc' },
        })
        if (!open) continue

        const clockOut = new Date(t.lastJob.completedAt)
        if (open.clockIn && clockOut <= open.clockIn) {
            result.skipped.push({ name: t.name, reason: 'last-job completion is before clock-in' })
            continue
        }

        // Guarded update so a concurrent manual clock-out can't be overwritten.
        const updated = await prisma.attendance.updateMany({
            where: { id: open.id, clockOut: null },
            data: {
                clockOut,
                status: 'PRESENT',
                ...(open.breakStart && !open.breakEnd ? { breakEnd: clockOut } : {}),
            },
        })
        if (updated.count === 0) continue
        await prisma.break.updateMany({
            where: { attendanceId: open.id, endTime: null, deletedAt: null },
            data: { endTime: clockOut },
        })
        result.clockedOut++

        await prisma.user.update({ where: { id: t.userId }, data: { availabilityStatus: 'APPEAR_OFFLINE' } })
        await invalidateCache(CacheKeys.staffDashboard)
        broadcastUpdate('attendance', { ...open, clockOut, status: 'PRESENT' })
        updateAttendanceSummary(t.userId, targetDate).catch((e) =>
            console.error('[simPRO] summary update failed:', e),
        )
        logActivity({
            userId: t.userId,
            action: 'CLOCK_OUT',
            entityType: 'ATTENDANCE',
            entityId: open.id,
            details: {
                source: 'SIMPRO',
                simproJob: t.lastJob.reference,
                simproEvent: `Completed last job of day at ${t.lastJob.completedAt}`,
            },
        }).catch(() => {})
    }
    return result
}

// Throttled trigger so UI/webhook hits don't hammer simPRO or double-process.
let lastRunAt = 0
let running = false

export async function maybeProcessSimproClockIns(minIntervalMs = 4 * 60_000): Promise<SimproClockInResult | null> {
    if (running || Date.now() - lastRunAt < minIntervalMs) return null
    running = true
    try {
        const result = await processSimproClockIns()
        lastRunAt = Date.now()
        return result
    } finally {
        running = false
    }
}
