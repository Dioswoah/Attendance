"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
    HardHat, RefreshCw, Search, Truck, MapPin, CheckCircle2, CalendarOff,
    Clock, Link2, AlertCircle,
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
    simproStatus: "NO_SCHEDULE" | "NOT_STARTED" | "TRAVELLING" | "ON_SITE" | "COMPLETED"
    simproStatusAt: string | null
    simproStatusMessage: string | null
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
    }
}

function fmtTime(iso: string | null): string {
    if (!iso) return "—"
    try {
        return format(new Date(iso), "h:mmaaa")
    } catch {
        return "—"
    }
}

export default function AdminTechniciansPage() {
    const [search, setSearch] = useState("")
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
        const filtered = q ? list.filter((t) => t.name.toLowerCase().includes(q)) : list
        const rank = { ON_SITE: 0, TRAVELLING: 1, NOT_STARTED: 2, COMPLETED: 3, NO_SCHEDULE: 4 }
        return [...filtered].sort((a, b) => rank[a.simproStatus] - rank[b.simproStatus] || a.name.localeCompare(b.name))
    }, [data, search])

    const counts = useMemo(() => {
        const list = data?.technicians ?? []
        return {
            active: list.filter((t) => t.simproStatus === "TRAVELLING" || t.simproStatus === "ON_SITE").length,
            scheduled: list.filter((t) => t.simproStatus !== "NO_SCHEDULE").length,
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
                    <Button variant="outline" size="sm" onClick={runLinkStaff} disabled={linking}>
                        <Link2 className={cn("h-4 w-4 mr-2", linking && "animate-spin")} />
                        Link simPRO Staff
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>
                        <RefreshCw className={cn("h-4 w-4 mr-2", isValidating && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            </div>

            {linkResult && (
                <p className="text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted/40">{linkResult}</p>
            )}

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{counts.active}</p><p className="text-xs text-muted-foreground">Travelling / On Site now</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{counts.scheduled}</p><p className="text-xs text-muted-foreground">Scheduled today</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{counts.clockedIn}</p><p className="text-xs text-muted-foreground">Clocked in (RSA)</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{counts.unlinked}</p><p className="text-xs text-muted-foreground">Not linked to RSA user</p></CardContent></Card>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <CardTitle className="text-base">Field Technicians — First Job of the Day</CardTitle>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search technician..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-8"
                            />
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
                                        const info = statusInfo(t.simproStatus)
                                        return (
                                            <tr key={t.simproEmployeeId} className="border-b last:border-0 hover:bg-muted/40">
                                                <td className="py-2.5 pr-4">
                                                    <div className="font-medium">{t.name}</div>
                                                    {!t.userId && (
                                                        <div className="text-xs text-amber-600">not linked to RSA user</div>
                                                    )}
                                                </td>
                                                <td className="py-2.5 pr-4">
                                                    <Badge variant="outline" className={cn("gap-1", info.className)}>
                                                        <info.icon className="h-3 w-3" />
                                                        {info.label}
                                                    </Badge>
                                                    {t.simproStatusAt && (
                                                        <div className="text-xs text-muted-foreground mt-0.5">{fmtTime(t.simproStatusAt)}</div>
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
                                                    {t.firstJob?.startTime ? `${fmtTime(t.firstJob.startTime)} – ${fmtTime(t.firstJob.endTime)}` : "—"}
                                                </td>
                                                <td className="py-2.5 pr-4">{t.jobCount || "—"}</td>
                                                <td className="py-2.5 pr-4 whitespace-nowrap">
                                                    {t.rsa.clockedInToday ? (
                                                        <div>
                                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                                In {fmtTime(t.rsa.clockInAt)}
                                                            </Badge>
                                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                                {t.rsa.source === "SIMPRO" ? "via simPRO" : t.rsa.source?.toLowerCase() || ""}
                                                                {t.rsa.clockOutAt ? ` · out ${fmtTime(t.rsa.clockOutAt)}` : ""}
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
