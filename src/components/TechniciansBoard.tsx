"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { useSSE } from "@/contexts/SSEContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
    HardHat, RefreshCw, Search, Link2, AlertCircle,
    MoreHorizontal, Pencil, Clock, Archive, ArchiveRestore, Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface TechDayStatus {
    simproEmployeeId: number | null
    name: string
    rsaEmail: string
    userId: string | null
    canManage: boolean
    archived: boolean
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
        clockOutViaSimpro: boolean
        source: string | null
        attendanceId: string | null
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

// "HH:mm" in the given IANA tz, for prefilling <input type="time">.
function toHHmm(iso: string | null, timeZone: string): string {
    if (!iso) return ""
    try {
        return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone })
    } catch {
        return ""
    }
}

// Turn a wall-clock date + "HH:mm" in a tz into a real instant (mirrors the
// Manual Entry admin editor so times land at the same UTC offset).
function parseTimeInTimezone(dateStr: string, timeStr: string, tz: string): Date {
    try {
        const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
            .formatToParts(new Date(`${dateStr}T12:00:00`))
            .find((p) => p.type === "timeZoneName")
        let offset = part?.value.replace("GMT", "") || "+00:00"
        if (offset === "") offset = "Z"
        return new Date(`${dateStr}T${timeStr}:00${offset}`)
    } catch {
        return new Date(`${dateStr}T${timeStr}:00`)
    }
}

// showLinkTools: admin portal gets the "Link simPRO Staff" button, unlinked
// warnings and the unlinked stat card; the user-portal (OPERATIONS) view is
// read-only field status.
export function TechniciansBoard({ showLinkTools = false }: { showLinkTools?: boolean }) {
    // This board is exclusively Australian field technicians, and every simPRO
    // schedule/attendance timestamp is anchored to Sydney (see sydneyToday() in
    // simpro-attendance.ts). Render — and edit — all times in the business
    // timezone so they read as when the tech actually worked, regardless of the
    // viewer's location. Following the viewer's browser tz previously showed
    // times 2h early for anyone working from Manila (UTC+8) vs Sydney (UTC+10).
    const userTimeZone = "Australia/Sydney"
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("ALL")
    const [linking, setLinking] = useState(false)
    const [linkResult, setLinkResult] = useState<string | null>(null)
    const [includeArchived, setIncludeArchived] = useState(false)
    const [busyId, setBusyId] = useState<string | null>(null)

    // Edit-name dialog
    const [nameDialog, setNameDialog] = useState<{ userId: string; original: string } | null>(null)
    const [nameInput, setNameInput] = useState("")
    // Edit-attendance dialog
    const [attDialog, setAttDialog] = useState<{ userId: string; attendanceId: string | null; name: string } | null>(null)
    const [clockInInput, setClockInInput] = useState("")
    const [clockOutInput, setClockOutInput] = useState("")
    const [savingDialog, setSavingDialog] = useState(false)

    const { data, error, isLoading, isValidating, mutate } = useSWR<TechStatusResponse>(
        `/api/simpro/tech-status${includeArchived ? "?includeArchived=1" : ""}`,
        fetcher,
        { refreshInterval: 60_000, revalidateOnFocus: true },
    )

    // A simPRO webhook clock-in/out broadcasts the same 'attendance' event the
    // rest of the app uses — revalidate immediately instead of waiting up to
    // 60s for the next poll (Marc, 2026-07-22).
    useSSE((payload) => {
        if (payload.type === "attendance") mutate()
    })

    const technicians = useMemo(() => {
        const list = data?.technicians ?? []
        const q = search.trim().toLowerCase()
        let filtered = q ? list.filter((t) => t.name.toLowerCase().includes(q)) : list
        filtered = statusFilter === "ALL"
            ? filtered
            : filtered.filter((t) => effectiveStatus(t) === statusFilter)
        const rank = { ON_SITE: 0, TRAVELLING: 1, NOT_STARTED: 2, COMPLETED: 3, NO_SCHEDULE: 4, ON_LEAVE: 5 }
        const rankOf = (t: TechDayStatus) => (isDoneForDay(t) ? rank.COMPLETED : rank[t.simproStatus])
        return [...filtered].sort((a, b) => rankOf(a) - rankOf(b) || a.name.localeCompare(b.name))
    }, [data, search, statusFilter])

    const counts = useMemo(() => {
        const list = data?.technicians ?? []
        return {
            active: list.filter((t) => t.simproStatus === "TRAVELLING" || t.simproStatus === "ON_SITE").length,
            notStarted: list.filter((t) => t.simproStatus === "NOT_STARTED").length,
            onLeave: list.filter((t) => t.simproStatus === "ON_LEAVE").length,
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

    async function patchEmployee(userId: string, body: Record<string, unknown>) {
        const res = await fetch(`/api/employees/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
        if (!res.ok) {
            const d = await res.json().catch(() => null)
            throw new Error(d?.error || `HTTP ${res.status}`)
        }
    }

    async function withBusy(userId: string, label: string, fn: () => Promise<void>) {
        setBusyId(userId)
        try {
            await fn()
            await mutate()
            toast.success(label)
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Action failed")
        } finally {
            setBusyId(null)
        }
    }

    function openNameDialog(t: TechDayStatus) {
        if (!t.userId) return
        setNameDialog({ userId: t.userId, original: t.name })
        setNameInput(t.name)
    }

    function openAttendanceDialog(t: TechDayStatus) {
        if (!t.userId) return
        setAttDialog({ userId: t.userId, attendanceId: t.rsa.attendanceId, name: t.name })
        setClockInInput(toHHmm(t.rsa.clockInAt, userTimeZone))
        setClockOutInput(toHHmm(t.rsa.clockOutAt, userTimeZone))
    }

    async function saveName() {
        if (!nameDialog) return
        const value = nameInput.trim()
        if (!value) { toast.error("Name can't be empty"); return }
        setSavingDialog(true)
        try {
            await patchEmployee(nameDialog.userId, { technicianDisplayName: value })
            await mutate()
            toast.success("Technician name updated")
            setNameDialog(null)
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to update name")
        } finally {
            setSavingDialog(false)
        }
    }

    async function saveAttendance() {
        if (!attDialog) return
        const day = data?.date
        if (!day) { toast.error("No active date"); return }
        if (!clockInInput) { toast.error("Clock-in time is required"); return }
        setSavingDialog(true)
        try {
            const clockIn = parseTimeInTimezone(day, clockInInput, userTimeZone).toISOString()
            const clockOut = clockOutInput ? parseTimeInTimezone(day, clockOutInput, userTimeZone).toISOString() : null
            if (attDialog.attendanceId) {
                const res = await fetch(`/api/attendance/${attDialog.attendanceId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ clockIn, clockOut }),
                })
                if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `HTTP ${res.status}`)
            } else {
                const res = await fetch(`/api/attendance`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: attDialog.userId, date: day, clockIn, clockOut, mode: "OFFICE", locationDetails: "Manual (Technicians board)" }),
                })
                if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `HTTP ${res.status}`)
            }
            await mutate()
            toast.success("RSA attendance updated")
            setAttDialog(null)
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to update attendance")
        } finally {
            setSavingDialog(false)
        }
    }

    async function clearAttendance() {
        if (!attDialog?.attendanceId) { setAttDialog(null); return }
        setSavingDialog(true)
        try {
            const res = await fetch(`/api/attendance/${attDialog.attendanceId}`, { method: "DELETE" })
            if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `HTTP ${res.status}`)
            await mutate()
            toast.success("RSA attendance cleared")
            setAttDialog(null)
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to clear attendance")
        } finally {
            setSavingDialog(false)
        }
    }

    function archiveTech(t: TechDayStatus) {
        if (!t.userId) return
        if (!window.confirm(`Archive ${t.name}? This archives them as a staff member too (they move to the archived list) and removes them from this board. Reversible via Show archived → Unarchive.`)) return
        void withBusy(t.userId, "Technician & staff member archived", () => patchEmployee(t.userId!, { technicianArchivedAt: new Date().toISOString(), isArchived: true }))
    }

    function unarchiveTech(t: TechDayStatus) {
        if (!t.userId) return
        void withBusy(t.userId, "Technician & staff member restored", () => patchEmployee(t.userId!, { technicianArchivedAt: null, isArchived: false }))
    }

    function deleteTech(t: TechDayStatus) {
        if (!t.userId) return
        if (!window.confirm(`Remove ${t.name} from the Technicians board? This does NOT delete the staff member — it just takes them off this board.`)) return
        void withBusy(t.userId, "Technician removed from board", () => patchEmployee(t.userId!, { isTechnician: false }))
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
                        <Button
                            variant={includeArchived ? "default" : "outline"}
                            size="sm"
                            onClick={() => setIncludeArchived((v) => !v)}
                        >
                            <Archive className="h-4 w-4 mr-2" />
                            {includeArchived ? "Hide archived" : "Show archived"}
                        </Button>
                    )}
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
                <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{counts.notStarted}</p><p className="text-xs text-muted-foreground">Not started</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{counts.onLeave}</p><p className="text-xs text-muted-foreground">On leave</p></CardContent></Card>
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
                                        <th className="py-2 pr-4">First Job</th>
                                        <th className="py-2 pr-4">Customer / Site</th>
                                        <th className="py-2 pr-4">Scheduled</th>
                                        <th className="py-2 pr-4">RSA Attendance</th>
                                        {showLinkTools && <th className="py-2 pr-2 text-right">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {technicians.map((t) => {
                                        const rowKey = t.userId ?? (t.simproEmployeeId != null ? `simpro-${t.simproEmployeeId}` : t.rsaEmail)
                                        return (
                                            <tr key={rowKey} className={cn("border-b last:border-0 hover:bg-muted/40", t.archived && "opacity-60")}>
                                                <td className="py-2.5 pr-4">
                                                    <div className="font-medium flex items-center gap-2">
                                                        {t.name}
                                                        {t.archived && <Badge variant="outline" className="text-[10px] text-slate-500">Archived</Badge>}
                                                        {t.simproEmployeeId == null && <Badge variant="outline" className="text-[10px] text-slate-500">Manual</Badge>}
                                                    </div>
                                                    {showLinkTools && !t.userId && (
                                                        <div className="text-xs text-amber-600">not linked to RSA user</div>
                                                    )}
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
                                                <td className="py-2.5 pr-4 whitespace-nowrap">
                                                    {t.rsa.clockedInToday ? (
                                                        <div className="flex items-start gap-1.5">
                                                            {/* Clock-IN column: "via simPRO" belongs to the clock-in
                                                                only (simPRO auto clock-in from the tech's first job). */}
                                                            <div className="flex flex-col items-start">
                                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                                    In {fmtTime(t.rsa.clockInAt, userTimeZone)}
                                                                </Badge>
                                                                {t.rsa.source === "SIMPRO" && (
                                                                    <span className="text-xs text-muted-foreground mt-0.5">via simPRO</span>
                                                                )}
                                                            </div>
                                                            {/* Clock-OUT column: "via RSA" belongs to the clock-out
                                                                only, and only for a human clock-out in the RSA app —
                                                                simPRO-driven clock-outs are left unmarked. */}
                                                            <div className="flex flex-col items-start">
                                                                <Badge
                                                                    variant="outline"
                                                                    className={t.rsa.clockOutAt ? "bg-slate-50 text-slate-600 border-slate-200" : "bg-slate-50 text-slate-400 border-slate-100"}
                                                                >
                                                                    Out {t.rsa.clockOutAt ? fmtTime(t.rsa.clockOutAt, userTimeZone) : "—"}
                                                                </Badge>
                                                                {t.rsa.clockOutAt && !t.rsa.clockOutViaSimpro && (
                                                                    <span className="text-xs text-muted-foreground mt-0.5">via RSA</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">Not clocked in</span>
                                                    )}
                                                </td>
                                                {showLinkTools && (
                                                    <td className="py-2.5 pr-2 text-right whitespace-nowrap">
                                                        {t.canManage && t.userId ? (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busyId === t.userId}>
                                                                        <MoreHorizontal className={cn("h-4 w-4", busyId === t.userId && "animate-pulse")} />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => openNameDialog(t)}>
                                                                        <Pencil className="h-4 w-4 mr-2" /> Edit name
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => openAttendanceDialog(t)}>
                                                                        <Clock className="h-4 w-4 mr-2" /> Edit RSA attendance
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    {t.archived ? (
                                                                        <DropdownMenuItem onClick={() => unarchiveTech(t)}>
                                                                            <ArchiveRestore className="h-4 w-4 mr-2" /> Unarchive
                                                                        </DropdownMenuItem>
                                                                    ) : (
                                                                        <DropdownMenuItem onClick={() => archiveTech(t)}>
                                                                            <Archive className="h-4 w-4 mr-2" /> Archive
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => deleteTech(t)}>
                                                                        <Trash2 className="h-4 w-4 mr-2" /> Remove from board
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        )
                                    })}
                                    {technicians.length === 0 && (
                                        <tr><td colSpan={showLinkTools ? 6 : 5} className="py-8 text-center text-muted-foreground">No technicians match.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit technician name */}
            <Dialog open={!!nameDialog} onOpenChange={(o) => !o && setNameDialog(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Edit technician name</DialogTitle>
                        <DialogDescription>Board display name only — does not change the staff member&apos;s legal name.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Display name</Label>
                        <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Technician name" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNameDialog(null)} disabled={savingDialog}>Cancel</Button>
                        <Button onClick={saveName} disabled={savingDialog}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit RSA attendance */}
            <Dialog open={!!attDialog} onOpenChange={(o) => !o && setAttDialog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit RSA attendance</DialogTitle>
                        <DialogDescription>
                            {attDialog?.name} — {data?.date}. Times are in your timezone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-2">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Clock In</Label>
                            <Input type="time" value={clockInInput} onChange={(e) => setClockInInput(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Clock Out</Label>
                            <Input type="time" value={clockOutInput} onChange={(e) => setClockOutInput(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:justify-between">
                        <Button
                            variant="ghost"
                            className="text-red-600 hover:text-red-600"
                            onClick={clearAttendance}
                            disabled={savingDialog || !attDialog?.attendanceId}
                        >
                            <Trash2 className="h-4 w-4 mr-2" /> Clear
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setAttDialog(null)} disabled={savingDialog}>Cancel</Button>
                            <Button onClick={saveAttendance} disabled={savingDialog}>Save</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
