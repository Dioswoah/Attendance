"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import { getBrowserTimezone } from "@/lib/timezone"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
    HardHat, RefreshCw, Search, Truck, MapPin, CheckCircle2, CalendarOff,
    Clock, Link2, AlertCircle, Umbrella,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface TechDayStatus {
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
    simproStatus: "NO_SCHEDULE" | "NOT_STARTED" | "TRAVELLING" | "ON_SITE" | "COMPLETED" | "ON_LEAVE"
    simproStatusAt: string | null
    simproStatusMessage: string | null
    lastJob: {
        companyId: number
        jobId: number
        reference: string
        completedAt: string | null
    } | null
    leave: {
        name: string
    } | null
    rsa: {
        clockedInToday: boolean
        clockInAt: string | null
        clockOutAt: string | null
        source: string | null
    }
}

interface TechStatusResponse {
    date: string
    writeEnabled: boolean
    technicians: TechDayStatus[]
}

const fetcher = (url: string) => fetch(url).then(async (r) => {
    if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || `HTTP ${r.status}`)
    return r.json()
})

function statusInfo(status: TechDayStatus["simproStatus"]) {
    switch (status) {
        case "TRAVELLING": return { label: "Travelling", icon: Truck, className: "bg-amber-100 text-amber-800 border-amber-200" }
        case "ON_SITE": return { label: "On Site", icon: MapPin, className: "bg-green-100 text-green-800 border-green-200" }
        case "COMPLETED": return { label: "Completed", icon: CheckCircle2, className: "bg-blue-100 text-blue-800 border-blue-200" }
        case "NOT_STARTED": return { label: "Not Started", icon: Clock, className: "bg-slate-100 text-slate-600 border-slate-200" }
        case "NO_SCHEDULE": return { label: "No Schedule", icon: CalendarOff, className: "bg-slate-50 text-slate-400 border-slate-100" }
        case "ON_LEAVE": return { label: "On Leave", icon: Umbrella, className: "bg-violet-100 text-violet-700 border-violet-200" }
    }
}

// A tech is done for the day once they've clocked out or marked their last
// job Completed — the first-job status badge would otherwise stay frozen at
// "On Site" (techs rarely tap Completed on job #1 before moving on).
function isDoneForDay(t: TechDayStatus): boolean {
    return t.simproStatus !== "ON_LEAVE" && Boolean(t.rsa.clockOutAt || t.lastJob?.completedAt)
}

// What the row's badge actually shows — used by the status filter.
function effectiveStatus(t: TechDayStatus): TechDayStatus["simproStatus"] | "DONE" {
    return isDoneForDay(t) ? "DONE" : t.simproStatus
}

const STATUS_FILTERS: { value: string; label: string }[] = [
    { value: "ALL", label: "All statuses" },
    { value: "ON_SITE", label: "On Site" },
    { value: "TRAVELLING", label: "Travelling" },
    { value: "NOT_STARTED", label: "Not Started" },
    { value: "DONE", label: "Done for day" },
    { value: "COMPLETED", label: "Completed" },
    { value: "NO_SCHEDULE", label: "No Schedule" },
    { value: "ON_LEAVE", label: "On Leave" },
]

function fmtTime(iso: string | null, timeZone: string): string {
    if (!iso) return "—"
    try {
        return new Date(iso)
            .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone })
            .toLowerCase()
            .replace(" ", "")
    } catch {
        return "—"
    }
}

// showLinkTools: admin portal gets the "Link simPRO Staff" button, unlinked
// warnings and the unlinked stat card; the user-portal (OPERATIONS) view is
// read-only field status.
export function TechniciansBoard({ showLinkTools = false }: { showLinkTools?: boolean }) {
    const { data: session } = useSession()
    const userTimeZone = (session?.user as any)?.useCurrentTimezone
        ? getBrowserTimezone()
        : (session?.user as any)?.selectedTimezone || getBrowserTimezone()
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("ALL")
    const [linking, setLinking] = useState(false)
    const [linkResult, setLinkResult] = useState<string | null>(null)

    const { data, error, isLoading, isValidating, mutate } = useSWR<TechStatusResponse>(
        "/api/simpro/tech-status",
        fetcher,
        { refreshInterval: 60_000, revalidateOnFocus: true },
    )

    const technicians = useMemo(() => {
        const list = data?.technicians ?? []
        const q = search.trim().toLowerCase()
        let filtered = q ? list.filter((t) => t.name.toLowerCase().includes(q)) : list
        // The board tracks who clocked in/out and where they went — techs on
        // approved leave are hidden by default; pick "On Leave" to see them.
        filtered = statusFilter === "ALL"
            ? filtered.filter((t) => t.simproStatus !== "ON_LEAVE")
            : filtered.filter((t) => effectiveStatus(t) === statusFilter)
        const rank = { ON_SITE: 0, TRAVELLING: 1, NOT_STARTED: 2, COMPLETED: 3, NO_SCHEDULE: 4, ON_LEAVE: 5 }
        const rankOf = (t: TechDayStatus) => (isDoneForDay(t) ? rank.COMPLETED : rank[t.simproStatus])
        return [...filtered].sort((a, b) => rankOf(a) - rankOf(b) || a.name.localeCompare(b.name))
    }, [data, search, statusFilter])

    const counts = useMemo(() => {
        const list = data?.technicians ?? []
        return {
            active: list.filter((t) => t.simproStatus === "TRAVELLING" || t.simproStatus === "ON_SITE").length,
            scheduled: list.filter((t) => t.simproStatus !== "NO_SCHEDULE" && t.simproStatus !== "ON_LEAVE").length,
            clockedIn: list.filter((t) => t.rsa.clockedInToday).length,
            unlinked: list.filter((t) => !t.userId).length,
        }
    }, [data])

    async function runLinkStaff() {
        setLinking(true)
        setLinkResult(null)
        try {
            const res = await fetch("/api/simpro/link-staff", { method: "POST" })
            const body = await res.json()
            if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
            setLinkResult(`Linked ${body.linked.length} new, ${body.alreadyLinked.length} already linked, ${body.noRsaUser.length} missing RSA user${body.conflicts.length ? `, ${body.conflicts.length} conflicts` : ""}`)
            mutate()
        } catch (e) {
            setLinkResult(`Link failed: ${e instanceof Error ? e.message : "unknown error"}`)
        } finally {
            setLinking(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <HardHat className="h-6 w-6 text-primary" />
                        Technicians
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Live field status from simPRO {data?.date ? `— ${data.date}` : ""}
                        {data && (
                            <Badge variant="outline" className={cn("ml-2", data.writeEnabled ? "text-green-700 border-green-300" : "text-slate-500")}>
                                {data.writeEnabled ? "Auto clock-in ON" : "View only (auto clock-in off)"}
                            </Badge>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {showLinkTools && (
                        <Button variant="outline" size="sm" onClick={runLinkStaff} disabled={linking}>
                            <Link2 className={cn("h-4 w-4 mr-2", linking && "animate-spin")} />
                            Link simPRO Staff
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>
                        <RefreshCw className={cn("h-4 w-4 mr-2", isValidating && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            </div>

            {showLinkTools && linkResult && (
                <p className="text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted/40">{linkResult}</p>
            )}

            <div className={cn("grid grid-cols-2 gap-4", showLinkTools ? "md:grid-cols-4" : "md:grid-cols-3")}>
                <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{counts.active}</p><p className="text-xs text-muted-foreground">Travelling / On Site now</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{counts.scheduled}</p><p className="text-xs text-muted-foreground">Scheduled today</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{counts.clockedIn}</p><p className="text-xs text-muted-foreground">Clocked in (RSA)</p></CardContent></Card>
                {showLinkTools && (
                    <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{counts.unlinked}</p><p className="text-xs text-muted-foreground">Not linked to RSA user</p></CardContent></Card>
                )}
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <CardTitle className="text-base">Field Technicians — First Job of the Day</CardTitle>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full sm:w-44">
                                    <SelectValue placeholder="Filter status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_FILTERS.map((f) => (
                                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search technician..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {error ? (
                        <div className="flex items-center gap-2 text-sm text-red-600 py-8 justify-center">
                            <AlertCircle className="h-4 w-4" />
                            {String(error.message || "Failed to load technician status")}
                        </div>
                    ) : isLoading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                                        <th className="py-2 pr-4">Technician</th>
                                        <th className="py-2 pr-4">simPRO Status</th>
                                        <th className="py-2 pr-4">First Job</th>
                                        <th className="py-2 pr-4">Customer / Site</th>
                                        <th className="py-2 pr-4">Scheduled</th>
                                        <th className="py-2 pr-4">Jobs</th>
                                        <th className="py-2 pr-4">RSA Attendance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {technicians.map((t) => {
                                        const done = isDoneForDay(t)
                                        const info = done
                                            ? { label: "Done for day", icon: CheckCircle2, className: "bg-blue-50 text-blue-700 border-blue-200" }
                                            : statusInfo(t.simproStatus)
                                        return (
                                            <tr key={t.simproEmployeeId} className="border-b last:border-0 hover:bg-muted/40">
                                                <td className="py-2.5 pr-4">
                                                    <div className="font-medium">{t.name}</div>
                                                    {showLinkTools && !t.userId && (
                                                        <div className="text-xs text-amber-600">not linked to RSA user</div>
                                                    )}
                                                </td>
                                                <td className="py-2.5 pr-4">
                                                    <Badge variant="outline" className={cn("gap-1", info.className)}>
                                                        <info.icon className="h-3 w-3" />
                                                        {info.label}
                                                    </Badge>
                                                    {done ? (
                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                            {fmtTime(t.rsa.clockOutAt || t.lastJob?.completedAt || null, userTimeZone)}
                                                        </div>
                                                    ) : t.simproStatus === "ON_LEAVE" ? (
                                                        <div className="text-xs text-violet-600 mt-0.5">{t.leave?.name}</div>
                                                    ) : t.simproStatusAt ? (
                                                        <div className="text-xs text-muted-foreground mt-0.5">{fmtTime(t.simproStatusAt, userTimeZone)}</div>
                                                    ) : null}
                                                </td>
                                                <td className="py-2.5 pr-4">
                                                    {t.firstJob ? (
                                                        <div>
                                                            <span className="font-mono text-xs">{t.firstJob.reference}</span>
                                                            {t.firstJob.jobStatusName && (
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <span
                                                                        className="inline-block h-2 w-2 rounded-full border"
                                                                        style={{ backgroundColor: t.firstJob.jobStatusColor || "#e2e8f0" }}
                                                                    />
                                                                    <span className="text-xs text-muted-foreground truncate max-w-[180px]" title={t.firstJob.jobStatusName}>
                                                                        {t.firstJob.jobStatusName}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : <span className="text-muted-foreground">—</span>}
                                                </td>
                                                <td className="py-2.5 pr-4 max-w-[220px]">
                                                    {t.firstJob ? (
                                                        <div>
                                                            <div className="truncate" title={t.firstJob.customer || undefined}>{t.firstJob.customer || "—"}</div>
                                                            <div className="text-xs text-muted-foreground truncate" title={t.firstJob.site || undefined}>{t.firstJob.site || ""}</div>
                                                        </div>
                                                    ) : <span className="text-muted-foreground">—</span>}
                                                </td>
                                                <td className="py-2.5 pr-4 whitespace-nowrap">
                                                    {t.firstJob?.startTime ? `${fmtTime(t.firstJob.startTime, userTimeZone)} – ${fmtTime(t.firstJob.endTime, userTimeZone)}` : "—"}
                                                </td>
                                                <td className="py-2.5 pr-4">{t.jobCount || "—"}</td>
                                                <td className="py-2.5 pr-4 whitespace-nowrap">
                                                    {t.rsa.clockedInToday ? (
                                                        <div>
                                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                                In {fmtTime(t.rsa.clockInAt, userTimeZone)}
                                                            </Badge>
                                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                                {t.rsa.source === "SIMPRO" ? "via simPRO" : t.rsa.source?.toLowerCase() || ""}
                                                                {t.rsa.clockOutAt ? ` · out ${fmtTime(t.rsa.clockOutAt, userTimeZone)}` : ""}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">Not clocked in</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {technicians.length === 0 && (
                                        <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No technicians match.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
