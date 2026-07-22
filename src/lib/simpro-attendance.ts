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
import type { Attendance } from '@prisma/client'
import {
    SIMPRO_COMPANY_IDS,
    getJob,
    getJobTimelines,
    getSchedulesForDate,
    isSimproConfigured,
    type SimproSchedule,
    type SimproTimelineEntry,
} from '@/lib/simpro'
import { SIMPRO_FIELD_ROSTER, type SimproRosterEntry } from '@/lib/simpro-roster'
import { logActivity, updateAttendanceSummary } from '@/lib/db-utils'
import { invalidateCache, CacheKeys } from '@/lib/cache'
import { broadcastUpdate } from '@/lib/eventBus'

const SYDNEY_TZ = 'Australia/Sydney'

export function sydneyToday(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: SYDNEY_TZ })
}

export type SimproMobileStatus = 'NO_SCHEDULE' | 'NOT_STARTED' | 'TRAVELLING' | 'ON_SITE' | 'COMPLETED' | 'ON_LEAVE'

export interface TechDayStatus {
    simproEmployeeId: number | null // null for manually-added technicians (no simPRO link)
    name: string
    rsaEmail: string
    userId: string | null
    canManage: boolean // true when a mutable RSA User backs this row (edit name / attendance / archive / delete)
    archived: boolean // technicianArchivedAt is set (only ever true when includeArchived was requested)
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
    leave: {
        name: string // leave type from the RSA app's APPROVED Leave record covering this day
    } | null
    rsa: {
        clockedInToday: boolean
        clockInAt: string | null
        clockOutAt: string | null
        source: string | null
        attendanceId: string | null // the picked Attendance row id, for inline admin edit/clear
    }
}

// The effective technician the board renders — either a static roster entry or
// a DB-flagged User (manual or migrated). `simproEmployeeId` is null for a
// manually-added tech; `userId` is pre-resolved for DB-driven records.
interface TechEntry {
    simproEmployeeId: number | null
    simproName: string
    rsaEmail: string
    displayName: string
    userId: string | null
    archived: boolean
}

/**
 * DB-driven technician list for the board: every User flagged isTechnician,
 * plus any static-roster entry not yet represented in the DB (so nobody who is
 * visible today disappears before the backfill/link runs). Archived techs are
 * excluded unless includeArchived is set.
 */
async function buildDbTechnicianList(includeArchived: boolean): Promise<TechEntry[]> {
    const techUsers = await prisma.user.findMany({
        where: {
            isTechnician: true,
            deletedAt: null,
            // Archiving a technician also archives the staff member, so either
            // flag hides them from the default board (shown under includeArchived).
            ...(includeArchived ? {} : { technicianArchivedAt: null, isArchived: false }),
        },
        select: { id: true, name: true, email: true, simproEmployeeId: true, technicianDisplayName: true, technicianArchivedAt: true, isArchived: true },
    })
    const dbBySimproId = new Set(
        techUsers.map((u) => u.simproEmployeeId).filter((v): v is number => v != null),
    )
    const dbByEmail = new Set(techUsers.map((u) => u.email.toLowerCase()))

    const fromDb: TechEntry[] = techUsers.map((u) => {
        const label = u.technicianDisplayName ?? u.name ?? u.email
        return {
            simproEmployeeId: u.simproEmployeeId ?? null,
            simproName: label,
            rsaEmail: u.email,
            displayName: label,
            userId: u.id,
            archived: Boolean(u.technicianArchivedAt) || u.isArchived,
        }
    })

    // Read-only supplement: roster entries no DB technician covers yet.
    const supplement: TechEntry[] = SIMPRO_FIELD_ROSTER
        .filter((r) => !dbBySimproId.has(r.simproEmployeeId) && !dbByEmail.has(r.rsaEmail.toLowerCase()))
        .map((r) => ({ ...r, userId: null, archived: false }))

    return [...fromDb, ...supplement]
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
 *
 * `roster` defaults to the full field roster; callers that only need to
 * refresh specific tech(s) (e.g. a webhook targeting one job) can pass a
 * narrower subset to skip fetching/scanning everyone else.
 */
export async function getTechDayStatuses(
    date?: string,
    roster?: SimproRosterEntry[],
    opts?: { includeArchived?: boolean },
): Promise<TechDayStatus[]> {
    if (!isSimproConfigured()) throw new Error('simPRO is not configured on this deployment')
    const day = date || sydneyToday()

    // When an explicit roster subset is passed (webhook/sweep targeting specific
    // simPRO techs) honour it as-is; otherwise the board is DB-driven.
    const effectiveTechs: TechEntry[] = roster
        ? roster.map((r) => ({ ...r, userId: null, archived: false }))
        : await buildDbTechnicianList(opts?.includeArchived ?? false)

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

    // 2) RSA users + today's attendance for the effective tech list in two queries.
    const techUserIds = effectiveTechs.map((t) => t.userId).filter((v): v is string => v != null)
    const techSimproIds = effectiveTechs.map((t) => t.simproEmployeeId).filter((v): v is number => v != null)
    const techEmails = effectiveTechs.map((t) => t.rsaEmail)
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { id: { in: techUserIds } },
                { simproEmployeeId: { in: techSimproIds } },
                { email: { in: techEmails, mode: 'insensitive' } },
            ],
            deletedAt: null,
        },
        select: { id: true, email: true, simproEmployeeId: true },
    })
    const targetDate = new Date(`${day}T00:00:00Z`)
    const attendanceRows = await prisma.attendance.findMany({
        where: { userId: { in: users.map((u) => u.id) }, date: targetDate, deletedAt: null, clockIn: { not: null } },
        orderBy: { clockIn: 'asc' },
        select: { id: true, userId: true, clockIn: true, clockOut: true, source: true },
    })
    // A tech can end up with more than one attendance row for the same day
    // (a stray/incorrect session gets closed, then a fresh one is opened) —
    // always prefer their currently-open session over a stale closed one, and
    // otherwise the most recently started row. Picking the earliest row here
    // used to show a tech as clocked out for the day even while they had a
    // live open session (Marc, 2026-07-22).
    const latestAttendanceByUserId = new Map<string, (typeof attendanceRows)[number]>()
    for (const row of attendanceRows) {
        const current = latestAttendanceByUserId.get(row.userId)
        if (!current) {
            latestAttendanceByUserId.set(row.userId, row)
            continue
        }
        const rowIsOpen = row.clockOut === null
        const currentIsOpen = current.clockOut === null
        const rowIsNewer = rowIsOpen === currentIsOpen && (row.clockIn?.getTime() ?? 0) > (current.clockIn?.getTime() ?? 0)
        if ((rowIsOpen && !currentIsOpen) || rowIsNewer) {
            latestAttendanceByUserId.set(row.userId, row)
        }
    }
    // On Leave is driven by the RSA app's leave feature (an APPROVED Leave
    // record covering the day), NOT by simPRO activity schedules (Marc,
    // 2026-07-16). Unlinked techs can't have app leave, so they never show it.
    const leaveRows = await prisma.leave.findMany({
        where: {
            userId: { in: users.map((u) => u.id) },
            status: 'APPROVED',
            startDate: { lte: targetDate },
            endDate: { gte: targetDate },
            deletedAt: null,
        },
        select: { userId: true, type: true },
    })
    const leaveByUserId = new Map(leaveRows.map((l) => [l.userId, l.type]))

    // 3) Resolve each tech's first job, then fetch its details + timeline.
    const statuses = await mapWithConcurrency(effectiveTechs, 5, async (tech): Promise<TechDayStatus> => {
        const user =
            (tech.userId ? users.find((u) => u.id === tech.userId) : undefined) ||
            (tech.simproEmployeeId != null ? users.find((u) => u.simproEmployeeId === tech.simproEmployeeId) : undefined) ||
            users.find((u) => u.email.toLowerCase() === tech.rsaEmail.toLowerCase()) ||
            null
        const att = user ? latestAttendanceByUserId.get(user.id) : undefined
        const rsa = {
            clockedInToday: Boolean(att),
            clockInAt: att?.clockIn?.toISOString() ?? null,
            clockOutAt: att?.clockOut?.toISOString() ?? null,
            source: att?.source ?? null,
            attendanceId: att?.id ?? null,
        }
        const canManage = Boolean(user)

        const leave = user && leaveByUserId.has(user.id) ? { name: leaveByUserId.get(user.id) as string } : null
        // Manually-added techs (no simPRO link) never have simPRO jobs; skip the fetch.
        const jobs = tech.simproEmployeeId != null
            ? (byTech.get(tech.simproEmployeeId) || []).sort((a, b) =>
                (firstBlockStart(a.schedule) || '9').localeCompare(firstBlockStart(b.schedule) || '9'),
            )
            : []
        if (jobs.length === 0) {
            return {
                simproEmployeeId: tech.simproEmployeeId, name: tech.displayName, rsaEmail: tech.rsaEmail,
                userId: user?.id ?? null, canManage, archived: tech.archived, jobCount: 0, firstJob: null,
                simproStatus: leave ? 'ON_LEAVE' : 'NO_SCHEDULE',
                simproStatusAt: null, simproStatusMessage: null, simproFirstStartedAt: null, lastJob: null, leave, rsa,
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
        const firstTied = uniqueJobs.filter((j) => j.start === earliestStart)

        // Clock-out signal: completion of the tech's AFTERNOON SAFETY CHECK
        // job — the one reliable end-of-day marker (Marc, 2026-07-21). Techs
        // don't always work jobs in scheduled order, so "last job by start
        // time" produced false clock-outs while other jobs were still open.
        // Matching on name text alone isn't enough — a job scheduled first
        // thing in the morning can also contain "safety check" in its
        // name/site/customer, which would wrongly close the whole day the
        // moment that early job is completed. Require the job's own schedule
        // to actually start in the afternoon (Marc, 2026-07-22 — caught a
        // false clock-out this produced). If no such job is scheduled for
        // this tech today, no simPRO clock-out fires at all — the nightly
        // shift-end auto clock-out covers them instead. getJob is cached, so
        // this is cheap on repeat sweeps within the cache TTL.
        const jobDetails = await mapWithConcurrency(uniqueJobs, 5, async (j) => {
            try {
                return { job: j, detail: await getJob(j.companyId, j.jobId) }
            } catch {
                return { job: j, detail: null }
            }
        })
        const startHour = (j: { start: string }) => {
            const m = j.start.match(/T(\d{2}):/)
            return m ? parseInt(m[1], 10) : null
        }
        const isAfternoonSafetyCheckJob = (entry: { job: (typeof uniqueJobs)[number]; detail: Awaited<ReturnType<typeof getJob>> | null }) => {
            if (!entry.detail) return false
            const textMatch = /safety\s*check/i.test(
                `${entry.detail.Name ?? ''} ${entry.detail.Site?.Name ?? ''} ${entry.detail.Customer?.CompanyName ?? ''}`,
            )
            if (!textMatch) return false
            const hour = startHour(entry.job)
            return hour !== null && hour >= 12
        }
        const safetyCheckJobs = jobDetails.filter(isAfternoonSafetyCheckJob).map((d) => d.job)

        const scanKeys = new Set([...firstTied, ...safetyCheckJobs].map((j) => `${j.companyId}:${j.jobId}`))
        const scanJobs = uniqueJobs.filter((j) => scanKeys.has(`${j.companyId}:${j.jobId}`))
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
        } else if (leave) {
            // Jobs pre-assigned but an approved app leave covers this day and
            // no mobile events — the tech is off, not "Not Started".
            simproStatus = 'ON_LEAVE'
            simproStatusMessage = leave.name
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

        // Clock-out signal: Completed on the SAFETY CHECK job specifically —
        // not just any job that happens to be scheduled last.
        const completedOnLast = events.filter((e) => e.status === 'COMPLETED' && inSet(safetyCheckJobs, e))
        const lastCompleted = completedOnLast[completedOnLast.length - 1]
        const last = lastCompleted?.job ?? safetyCheckJobs[safetyCheckJobs.length - 1] ?? null

        return {
            simproEmployeeId: tech.simproEmployeeId, name: tech.displayName, rsaEmail: tech.rsaEmail,
            userId: user?.id ?? null, canManage, archived: tech.archived, jobCount: jobs.length,
            firstJob: {
                companyId: first.companyId, jobId: first.jobId, reference: first.reference,
                startTime: blocks[0]?.ISO8601StartTime ?? null,
                endTime: blocks[blocks.length - 1]?.ISO8601EndTime ?? null,
                customer, site, jobStatusName, jobStatusColor,
            },
            simproStatus, simproStatusAt, simproStatusMessage, simproFirstStartedAt,
            lastJob: last ? {
                companyId: last.companyId, jobId: last.jobId, reference: last.reference,
                completedAt: lastCompleted?.at ?? null,
            } : null,
            leave,
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
 * Across instances (prod runs max-instances=3) the write phase additionally
 * takes a Postgres advisory lock inside runSimproAttendanceSweep, so two
 * instances can never double-write.
 */
let sweepChain: Promise<unknown> = Promise.resolve()

export function processSimproClockIns(date?: string, roster?: SimproRosterEntry[]): Promise<SimproClockInResult> {
    const run = sweepChain.then(() => runSimproAttendanceSweep(date, roster))
    sweepChain = run.then(() => undefined, () => undefined)
    return run
}

async function runSimproAttendanceSweep(date?: string, roster?: SimproRosterEntry[]): Promise<SimproClockInResult> {
    const day = date || sydneyToday()
    const writeEnabled = process.env.SIMPRO_ATTENDANCE_WRITE === 'true'
    const statuses = await getTechDayStatuses(day, roster)
    const result: SimproClockInResult = { writeEnabled, date: day, checked: statuses.length, created: 0, clockedOut: 0, skipped: [] }
    if (!writeEnabled) return result

    const targetDate = new Date(`${day}T00:00:00Z`)

    // DB writes are collected here and their side effects (cache, broadcast,
    // summary, activity log) fired only after the transaction commits — a
    // summary computed inside the transaction would not see the new rows.
    const clockInEvents: { userId: string; t: TechDayStatus; attendance: Attendance }[] = []
    const clockOutEvents: { userId: string; t: TechDayStatus; open: Attendance; clockOut: Date }[] = []

    // Cross-instance guard: the in-process queue only serializes sweeps within
    // ONE instance; prod runs up to 3, and two instances can both pass the
    // duplicate checks before either writes. A transaction-scoped advisory
    // lock makes the write phase mutually exclusive across all instances; a
    // concurrent sweep skips instead of queueing — the next poll re-covers
    // the same simPRO data.
    const lockAcquired = await prisma.$transaction(
        async (tx) => {
            const [{ locked }] = await tx.$queryRaw<[{ locked: boolean }]>`
                SELECT pg_try_advisory_xact_lock(hashtext('simpro-attendance-sweep')) AS locked`
            if (!locked) return false

            for (const t of statuses) {
                const started = t.simproStatus === 'TRAVELLING' || t.simproStatus === 'ON_SITE' || t.simproStatus === 'COMPLETED'
                if (!started || !t.simproStatusAt) continue
                if (!t.userId) {
                    result.skipped.push({ name: t.name, reason: 'no RSA user linked' })
                    continue
                }
                if (t.rsa.clockedInToday) continue // manual/web/biometric clock-in already exists — never duplicate

                // Concurrency/safety guards mirroring the manual clock-in route.
                const activeSession = await tx.attendance.findFirst({
                    where: { userId: t.userId, clockOut: null, deletedAt: null },
                })
                if (activeSession) {
                    result.skipped.push({ name: t.name, reason: 'already has an open session' })
                    continue
                }
                const existing = await tx.attendance.findFirst({
                    where: { userId: t.userId, date: targetDate, deletedAt: null, clockIn: { not: null } },
                })
                if (existing) continue

                const clockIn = new Date(t.simproFirstStartedAt ?? t.simproStatusAt)
                const attendance = await tx.attendance.create({
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

                await tx.user.update({ where: { id: t.userId }, data: { availabilityStatus: 'AVAILABLE' } })
                clockInEvents.push({ userId: t.userId, t, attendance })
            }

            // Clock-outs: tech marked Completed on their final job of the day.
            // Closes any open session for the day regardless of how it was opened
            // (manual/web/biometric/simPRO) — one rule for all field techs.
            for (const t of statuses) {
                if (!t.userId || !t.lastJob?.completedAt) continue

                const open = await tx.attendance.findFirst({
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
                const updated = await tx.attendance.updateMany({
                    where: { id: open.id, clockOut: null },
                    data: {
                        clockOut,
                        status: 'PRESENT',
                        ...(open.breakStart && !open.breakEnd ? { breakEnd: clockOut } : {}),
                    },
                })
                if (updated.count === 0) continue
                await tx.break.updateMany({
                    where: { attendanceId: open.id, endTime: null, deletedAt: null },
                    data: { endTime: clockOut },
                })
                result.clockedOut++

                await tx.user.update({ where: { id: t.userId }, data: { availabilityStatus: 'APPEAR_OFFLINE' } })
                clockOutEvents.push({ userId: t.userId, t, open, clockOut })
            }
            return true
        },
        // Sweep runs many small queries over the SG->AU cross-region link;
        // the default 5s interactive-transaction timeout is far too tight.
        { timeout: 120_000, maxWait: 10_000 },
    )

    if (!lockAcquired) {
        result.skipped.push({ name: '(sweep)', reason: 'another instance holds the sweep lock' })
        return result
    }

    if (clockInEvents.length > 0 || clockOutEvents.length > 0) {
        await invalidateCache(CacheKeys.staffDashboard)
    }
    for (const { userId, t, attendance } of clockInEvents) {
        broadcastUpdate('attendance', attendance)
        updateAttendanceSummary(userId, targetDate).catch((e) =>
            console.error('[simPRO] summary update failed:', e),
        )
        logActivity({
            userId,
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
    for (const { userId, t, open, clockOut } of clockOutEvents) {
        broadcastUpdate('attendance', { ...open, clockOut, status: 'PRESENT' })
        updateAttendanceSummary(userId, targetDate).catch((e) =>
            console.error('[simPRO] summary update failed:', e),
        )
        logActivity({
            userId,
            action: 'CLOCK_OUT',
            entityType: 'ATTENDANCE',
            entityId: open.id,
            details: {
                source: 'SIMPRO',
                simproJob: t.lastJob?.reference,
                simproEvent: `Completed last job of day at ${t.lastJob?.completedAt}`,
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

// Per-job debounce for webhook-triggered targeted sweeps — separate from the
// full-sweep throttle above, since a burst of job.updated pings for the same
// job (simPRO can fire several within seconds) shouldn't each kick off a
// resweep, but a ping for a DIFFERENT tech's job shouldn't wait behind it either.
const webhookJobDebounce = new Map<string, number>()
const WEBHOOK_JOB_DEBOUNCE_MS = 15_000

/**
 * React to one simPRO webhook event. The payload only ever identifies WHICH
 * job/schedule changed (never what changed about it), so this resolves that
 * jobID against today's live schedule to find which roster tech(s) — if any
 * — actually have it, and only refreshes those. A job can be shared by
 * several techs (e.g. a group "AFTERNOON SAFETY CHECK"), so every match is
 * refreshed, not just the first. If the payload doesn't identify a job (e.g.
 * simPRO's subscription test ping) or the job belongs to nobody on the
 * roster today, this does the minimum necessary — a full debounced sweep for
 * the former, nothing at all for the latter — instead of resweeping everyone
 * on every one of the ~1,500 job.updated pings a day (Marc, 2026-07-22).
 */
export async function processSimproWebhookEvent(ref: { companyId?: number; jobId?: number } | null | undefined): Promise<void> {
    if (!ref?.companyId || !ref?.jobId) {
        await maybeProcessSimproClockIns(30_000)
        return
    }

    const debounceKey = `${ref.companyId}:${ref.jobId}`
    const lastRun = webhookJobDebounce.get(debounceKey) ?? 0
    if (Date.now() - lastRun < WEBHOOK_JOB_DEBOUNCE_MS) return
    webhookJobDebounce.set(debounceKey, Date.now())
    if (webhookJobDebounce.size > 1000) webhookJobDebounce.clear()

    const day = sydneyToday()
    let schedules: SimproSchedule[]
    try {
        schedules = await getSchedulesForDate(ref.companyId, day)
    } catch (err) {
        console.error(`[simPRO] webhook schedule lookup failed for company ${ref.companyId}:`, err)
        return
    }

    const staffIds = new Set<number>()
    for (const s of schedules) {
        if (s.Type !== 'job') continue
        if (parseInt(s.Reference.split('-')[0], 10) === ref.jobId && s.Staff?.ID) staffIds.add(s.Staff.ID)
    }

    const matchedRoster = SIMPRO_FIELD_ROSTER.filter((r) => staffIds.has(r.simproEmployeeId))
    if (matchedRoster.length === 0) {
        console.log(`[simPRO] webhook targeted: job ${ref.jobId} (company ${ref.companyId}) matches nobody on the roster today — skipped`)
        return
    }

    console.log(`[simPRO] webhook targeted: job ${ref.jobId} (company ${ref.companyId}) -> ${matchedRoster.map((r) => r.displayName).join(', ')}`)
    await processSimproClockIns(day, matchedRoster)
}
