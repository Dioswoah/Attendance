"use client"

import dynamic from "next/dynamic"
import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { format } from "date-fns"
import { MapPin, RefreshCcw, Loader2, MapPinOff, Eye, Building2, ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getBrowserTimezone } from "@/lib/timezone"
import type { LocationRecord } from "@/components/LocationMap"

// Leaflet must be client-side only — no SSR
const LocationMap = dynamic(() => import("@/components/LocationMap"), { ssr: false, loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
)})

type PinMode = "both" | "clockin" | "clockout"

export default function LocationPage() {
    const { data: session } = useSession()
    const userTimezone = (session?.user as any)?.useCurrentTimezone
        ? getBrowserTimezone()
        : (session?.user as any)?.selectedTimezone || "Asia/Manila"

    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [departmentId, setDepartmentId] = useState("all")
    const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
    const [records, setRecords] = useState<LocationRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [pinMode, setPinMode] = useState<PinMode>("both")
    const [highlightId, setHighlightId] = useState<string | null>(null)

    // Modal for single-record detail
    const [modalRecord, setModalRecord] = useState<LocationRecord | null>(null)
    const [modalAddress, setModalAddress] = useState<string | null>(null)
    const [addressLoading, setAddressLoading] = useState(false)

    // Fetch departments once
    useEffect(() => {
        fetch("/api/departments")
            .then(r => r.json())
            .then(data => setDepartments(Array.isArray(data) ? data : []))
            .catch(() => {})
    }, [])

    const fetchRecords = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ date, departmentId })
            const res = await fetch(`/api/admin/location?${params}`)
            if (res.ok) setRecords(await res.json())
        } catch {}
        setLoading(false)
    }, [date, departmentId])

    useEffect(() => { fetchRecords() }, [fetchRecords])

    const withLocation = records.filter(r =>
        (r.clockInLat != null && r.clockInLng != null) ||
        (r.clockOutLat != null && r.clockOutLng != null)
    )
    const withoutLocation = records.filter(r =>
        r.clockInLat == null && r.clockInLng == null &&
        r.clockOutLat == null && r.clockOutLng == null
    )
    const clockInCount  = records.filter(r => r.clockInLat != null).length
    const clockOutCount = records.filter(r => r.clockOutLat != null).length

    const openModal = async (rec: LocationRecord) => {
        setModalRecord(rec)
        setModalAddress(null)
        const lat = rec.clockInLat ?? rec.clockOutLat
        const lng = rec.clockInLng ?? rec.clockOutLng
        if (lat == null || lng == null) return
        setAddressLoading(true)
        try {
            const res = await fetch(`/api/admin/geocode?lat=${lat}&lng=${lng}`)
            const data = await res.json()
            setModalAddress(data.address || "Address not found")
        } catch {
            setModalAddress("Address not found")
        }
        setAddressLoading(false)
    }

    const hasClockIn  = (r: LocationRecord) => r.clockInLat != null && r.clockInLng != null
    const hasClockOut = (r: LocationRecord) => r.clockOutLat != null && r.clockOutLng != null

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <MapPin className="h-6 w-6 text-primary" />
                        Location
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Where staff clocked in and out
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchRecords} disabled={loading}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Select value={departmentId} onValueChange={setDepartmentId}>
                    <SelectTrigger className="w-[180px] h-9">
                        <Building2 className="h-4 w-4 mr-1 text-muted-foreground" />
                        <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departments.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={pinMode} onValueChange={v => setPinMode(v as PinMode)}>
                    <SelectTrigger className="w-[160px] h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="both">Clock In + Out</SelectItem>
                        <SelectItem value="clockin">Clock In only</SelectItem>
                        <SelectItem value="clockout">Clock Out only</SelectItem>
                    </SelectContent>
                </Select>

                <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
                    <span>
                        <span className="font-bold text-green-600">{withLocation.length}</span> with location
                    </span>
                    <span className="text-border">·</span>
                    <span>
                        <span className="font-bold text-amber-600">{withoutLocation.length}</span> no location
                    </span>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Total records", value: records.length, color: "text-foreground" },
                    { label: "With location", value: withLocation.length, color: "text-green-600" },
                    { label: "Clock-in pins", value: clockInCount, color: "text-blue-600" },
                    { label: "Clock-out pins", value: clockOutCount, color: "text-emerald-700" },
                ].map(stat => (
                    <Card key={stat.label} className="py-3 px-4">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</p>
                        <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                    </Card>
                ))}
            </div>

            {/* Map */}
            <Card className="overflow-hidden">
                <CardHeader className="py-3 px-4 border-b flex-row items-center gap-3 space-y-0">
                    <CardTitle className="text-sm font-semibold">Map</CardTitle>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto">
                        {(pinMode === "both" || pinMode === "clockin") && (
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded-full bg-blue-600" /> Clock In
                            </span>
                        )}
                        {(pinMode === "both" || pinMode === "clockout") && (
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded-full bg-green-600" /> Clock Out
                            </span>
                        )}
                    </div>
                </CardHeader>
                <div className="h-[420px] relative">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : withLocation.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                            <MapPinOff className="h-10 w-10" />
                            <p className="text-sm font-medium">No location data for this date</p>
                            <p className="text-xs">Staff need to allow location access when clocking in</p>
                        </div>
                    ) : (
                        <LocationMap
                            records={withLocation}
                            showClockIn={pinMode === "both" || pinMode === "clockin"}
                            showClockOut={pinMode === "both" || pinMode === "clockout"}
                            highlightId={highlightId}
                            onPinClick={id => {
                                setHighlightId(id)
                                const rec = records.find(r => r.id === id)
                                if (rec) openModal(rec)
                            }}
                            timezone={userTimezone}
                        />
                    )}
                </div>
            </Card>

            {/* Records table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Records — {format(new Date(date + "T12:00:00Z"), "dd MMM yyyy")}</CardTitle>
                    <CardDescription>{records.length} attendance records</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40">
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Staff</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Department</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clock In</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clock Out</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                                            No records for this date
                                        </td>
                                    </tr>
                                )}
                                {records.map(rec => {
                                    const isHighlighted = rec.id === highlightId
                                    const clockInStr = rec.clockIn
                                        ? new Date(rec.clockIn).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: userTimezone })
                                        : "—"
                                    const clockOutStr = rec.clockOut
                                        ? new Date(rec.clockOut).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: userTimezone })
                                        : "—"
                                    return (
                                        <tr
                                            key={rec.id}
                                            className={`border-b transition-colors cursor-pointer hover:bg-muted/30 ${isHighlighted ? "bg-primary/5" : ""}`}
                                            onClick={() => {
                                                setHighlightId(rec.id)
                                                openModal(rec)
                                            }}
                                        >
                                            <td className="px-4 py-3 font-medium">{rec.user.name}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{rec.user.department?.name || "—"}</td>
                                            <td className="px-4 py-3 tabular-nums text-muted-foreground">{clockInStr}</td>
                                            <td className="px-4 py-3 tabular-nums text-muted-foreground">{clockOutStr}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1.5 flex-wrap">
                                                    {hasClockIn(rec) && (
                                                        <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 text-xs px-2">
                                                            <MapPin className="h-3 w-3 mr-1" />In
                                                        </Badge>
                                                    )}
                                                    {hasClockOut(rec) && (
                                                        <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 text-xs px-2">
                                                            <MapPin className="h-3 w-3 mr-1" />Out
                                                        </Badge>
                                                    )}
                                                    {!hasClockIn(rec) && !hasClockOut(rec) && (
                                                        <span className="text-xs text-muted-foreground">No location</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {(hasClockIn(rec) || hasClockOut(rec)) && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-xs"
                                                        onClick={e => { e.stopPropagation(); openModal(rec) }}
                                                    >
                                                        <Eye className="h-3.5 w-3.5 mr-1" />
                                                        View
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Detail modal */}
            <Dialog open={!!modalRecord} onOpenChange={open => { if (!open) { setModalRecord(null); setHighlightId(null) } }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            {modalRecord?.user.name}
                        </DialogTitle>
                    </DialogHeader>
                    {modalRecord && (
                        <div className="space-y-4">
                            {/* Address */}
                            <div className="rounded-md bg-muted/40 px-4 py-3 text-sm">
                                {addressLoading ? (
                                    <span className="flex items-center gap-2 text-muted-foreground">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Resolving address…
                                    </span>
                                ) : (
                                    <span className="text-foreground">{modalAddress || "No address available"}</span>
                                )}
                            </div>

                            {/* Mini map */}
                            <div className="h-[220px] rounded-md overflow-hidden border">
                                <LocationMap
                                    records={[modalRecord]}
                                    showClockIn={hasClockIn(modalRecord)}
                                    showClockOut={hasClockOut(modalRecord)}
                                    highlightId={null}
                                    onPinClick={() => {}}
                                    timezone={userTimezone}
                                />
                            </div>

                            {/* Clock times */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-md border px-3 py-2">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Clock In</p>
                                    <p className="font-medium tabular-nums">
                                        {modalRecord.clockIn
                                            ? new Date(modalRecord.clockIn).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: userTimezone })
                                            : "—"}
                                    </p>
                                    {modalRecord.clockInAccuracy && (
                                        <p className="text-xs text-muted-foreground mt-0.5">±{Math.round(modalRecord.clockInAccuracy)}m accuracy</p>
                                    )}
                                    {!hasClockIn(modalRecord) && <p className="text-xs text-muted-foreground mt-0.5">No location</p>}
                                </div>
                                <div className="rounded-md border px-3 py-2">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Clock Out</p>
                                    <p className="font-medium tabular-nums">
                                        {modalRecord.clockOut
                                            ? new Date(modalRecord.clockOut).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: userTimezone })
                                            : "—"}
                                    </p>
                                    {modalRecord.clockOutAccuracy && (
                                        <p className="text-xs text-muted-foreground mt-0.5">±{Math.round(modalRecord.clockOutAccuracy)}m accuracy</p>
                                    )}
                                    {!hasClockOut(modalRecord) && <p className="text-xs text-muted-foreground mt-0.5">No location</p>}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
