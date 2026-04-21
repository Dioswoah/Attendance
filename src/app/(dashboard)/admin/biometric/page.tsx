"use client"

import { useState, useEffect, useRef } from "react"
import { format, subDays } from "date-fns"
import * as XLSX from "xlsx"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Fingerprint, Clock, AlertTriangle, RefreshCw, Loader2, Copy, Check, ChevronDown, FileSpreadsheet, FileText } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

const APPS_SCRIPT_CODE = `function doGet(e) {
  var date = e.parameter.date;
  if (!date) {
    return ContentService.createTextOutput(JSON.stringify({ error: "date param required" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var parts = date.split("-");
  var year = parseInt(parts[0]);
  var month = parseInt(parts[1]) - 1;
  var day = parseInt(parts[2]);
  var dateObj = new Date(year, month, day);
  var monthNames = ["January","February","March","April","May","June",
                    "July","August","September","October","November","December"];
  var monthLong = monthNames[dateObj.getMonth()];
  var candidates = [
    monthLong + " " + day + " " + year,
    monthLong + " " + day + ", " + year,
    monthLong + " " + String(day).padStart(2, "0") + " " + year
  ];
  var targetSheet = null;
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName().toLowerCase();
    for (var j = 0; j < candidates.length; j++) {
      if (name === candidates[j].toLowerCase()) { targetSheet = sheets[i]; break; }
    }
    if (targetSheet) break;
  }
  if (!targetSheet) {
    var tabs = sheets.map(function(s) { return s.getName(); });
    return ContentService.createTextOutput(JSON.stringify({ error: "No sheet found for: " + date, availableTabs: tabs }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var data = targetSheet.getRange("A2:J1000").getValues();
  var rows = data.filter(function(row) { return row[3] !== ""; });
  return ContentService.createTextOutput(JSON.stringify({ rows: rows })).setMimeType(ContentService.MimeType.JSON);
}`

interface BiometricEntry {
    biometric: {
        name: string
        department: string
        employeeId: string
        firstIn: string | null
        lastOut: string | null
        expectedStart: string | null
        status: string
        lateTime: string
    }
    app: {
        userName: string | null
        department: string | null
        clockIn: string | null
        clockOut: string | null
        status: string
        mode: string
    } | null
    matched: boolean
}

interface BiometricData {
    date: string
    tab: string
    entries: BiometricEntry[]
}

function bioToUtcMs(t: string, refDate: string): number | null {
    const m = t.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i)
    if (!m) return null
    let h = parseInt(m[1])
    const min = parseInt(m[2])
    if (m[3].toUpperCase() === "PM" && h !== 12) h += 12
    if (m[3].toUpperCase() === "AM" && h === 12) h = 0
    const [y, mo, d] = refDate.split("-").map(Number)
    return Date.UTC(y, mo - 1, d, h - 8, min)
}

function toMinPHT(t: string | null): number | null {
    if (!t || t === "--") return null
    try {
        if (t.includes("T")) {
            const d = new Date(t)
            if (isNaN(d.getTime())) return null
            return ((d.getUTCHours() + 8) % 24) * 60 + d.getUTCMinutes()
        }
        const ampm = t.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i)
        if (ampm) {
            let h = parseInt(ampm[1])
            const m = parseInt(ampm[2])
            if (ampm[3].toUpperCase() === "PM" && h !== 12) h += 12
            if (ampm[3].toUpperCase() === "AM" && h === 12) h = 0
            return h * 60 + m
        }
        const parts = t.split(":")
        if (parts.length >= 2) return parseInt(parts[0]) * 60 + parseInt(parts[1])
        return null
    } catch { return null }
}

function timeDiffMinutes(a: string | null, b: string | null): number | null {
    const ma = toMinPHT(a)
    const mb = toMinPHT(b)
    if (ma === null || mb === null) return null
    return mb - ma
}

function formatInTz(t: string | null, refDate: string, tz: string): string {
    if (!t || t === "--") return "—"
    try {
        const fmt = (ms: number) => new Intl.DateTimeFormat("en-US", {
            timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: true
        }).format(new Date(ms))
        if (t.includes("T")) return fmt(new Date(t).getTime())
        const utcMs = bioToUtcMs(t, refDate)
        if (utcMs !== null) return fmt(utcMs)
        return t
    } catch { return t }
}

function toMilitaryTime(t: string): string | null {
    const m = t.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i)
    if (!m) return null
    let h = parseInt(m[1])
    const min = parseInt(m[2])
    if (m[3].toUpperCase() === "PM" && h !== 12) h += 12
    if (m[3].toUpperCase() === "AM" && h === 12) h = 0
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
}

function DiffBadge({ bioTime, appTime }: { bioTime: string | null; appTime: string | null }) {
    const diff = timeDiffMinutes(bioTime, appTime)
    if (diff === null) return <span className="text-muted-foreground text-xs">—</span>
    const absDiff = Math.abs(diff)
    const sign = diff > 0 ? "+" : diff < 0 ? "−" : ""
    return (
        <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-mono font-normal">
            {sign}{absDiff} min
        </Badge>
    )
}

function PunctualityBadge({ firstIn, expectedStart }: { firstIn: string | null; expectedStart: string | null }) {
    if (!firstIn || firstIn === "--")
        return <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-[10px]">Absent</Badge>
    if (!expectedStart || expectedStart === "--")
        return <span className="text-muted-foreground text-xs">—</span>
    const diff = timeDiffMinutes(expectedStart, firstIn)
    if (diff === null) return <span className="text-muted-foreground text-xs">—</span>
    if (diff <= 5)
        return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] font-bold">On Time</Badge>
    return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-bold">Late +{diff} min</Badge>
}

function punctualityStr(firstIn: string | null, expectedStart: string | null): string {
    if (!firstIn || firstIn === "--") return "Absent"
    if (!expectedStart || expectedStart === "--") return "—"
    const diff = timeDiffMinutes(expectedStart, firstIn)
    if (diff === null) return "—"
    return diff <= 5 ? "On Time" : `Late +${diff} min`
}

function diffStr(a: string | null, b: string | null): string {
    const diff = timeDiffMinutes(a, b)
    if (diff === null) return "—"
    const sign = diff > 0 ? "+" : diff < 0 ? "−" : ""
    return `${sign}${Math.abs(diff)} min`
}

// ── Multi-select dropdown ─────────────────────────────────────────────────────
function MultiSelect({ label, options, selected, onChange }: {
    label: string
    options: string[]
    selected: string[]
    onChange: (v: string[]) => void
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const [search, setSearch] = useState("")

    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [open])

    const toggle = (v: string) =>
        onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v])

    const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))

    return (
        <div className="relative" ref={ref}>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(o => !o)}
                className="h-9 gap-1.5 text-sm font-normal"
            >
                <span>{label}</span>
                {selected.length > 0 && (
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5">{selected.length}</Badge>
                )}
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </Button>
            {open && (
                <div className="absolute z-50 mt-1 left-0 bg-white border border-border rounded-lg shadow-lg min-w-[200px]">
                    <div className="p-2 border-b">
                        <Input
                            placeholder="Search…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="h-7 text-xs"
                            autoFocus
                        />
                    </div>
                    <div className="max-h-52 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <p className="text-xs text-muted-foreground px-3 py-2">No options</p>
                        ) : filtered.map(opt => (
                            <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted cursor-pointer text-sm">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(opt)}
                                    onChange={() => toggle(opt)}
                                    className="rounded"
                                />
                                <span className="truncate">{opt}</span>
                            </label>
                        ))}
                    </div>
                    {selected.length > 0 && (
                        <div className="border-t p-1">
                            <Button variant="ghost" size="sm" onClick={() => { onChange([]); setSearch("") }} className="w-full text-xs h-7">
                                Clear all
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ── Setup instructions ────────────────────────────────────────────────────────
function SetupInstructions() {
    const [copied, setCopied] = useState(false)
    const copy = () => {
        navigator.clipboard.writeText(APPS_SCRIPT_CODE)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="pb-3">
                <CardTitle className="text-base text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    One-time setup required
                </CardTitle>
                <CardDescription className="text-amber-700 text-xs">
                    Add this function to your existing Apps Script in the biometric spreadsheet.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <ol className="text-sm text-amber-900 space-y-1.5 list-decimal list-inside">
                    <li>Open your Biometric Google Sheet → <strong>Extensions → Apps Script</strong></li>
                    <li>Scroll to the bottom, paste the function below (don't delete existing code)</li>
                    <li>Save, then <strong>Deploy → New deployment</strong> · Type: Web app · Access: <strong>Anyone</strong></li>
                    <li>Copy the URL → add to <code className="bg-amber-100 px-1 rounded">.env</code> as <code className="text-xs">BIOMETRIC_APPS_SCRIPT_URL=...</code></li>
                    <li>Restart the dev server</li>
                </ol>
                <div className="bg-gray-900 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
                        <span className="text-gray-400 text-xs font-mono">Add at bottom of existing Code.gs</span>
                        <Button size="sm" variant="ghost" onClick={copy} className="h-7 text-gray-300 hover:text-white hover:bg-gray-700 text-xs gap-1">
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied ? "Copied!" : "Copy"}
                        </Button>
                    </div>
                    <pre className="p-4 text-xs text-green-400 font-mono overflow-x-auto max-h-56 overflow-y-auto leading-relaxed">{APPS_SCRIPT_CODE}</pre>
                </div>
            </CardContent>
        </Card>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BiometricPage() {
    const [selectedDate, setSelectedDate] = useState(format(subDays(new Date(), 1), "yyyy-MM-dd"))
    const [data, setData] = useState<BiometricData | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [setupRequired, setSetupRequired] = useState(false)
    const [adminTz, setAdminTz] = useState("Asia/Manila")

    // Filters
    const [selectedNames, setSelectedNames] = useState<string[]>([])
    const [selectedDepts, setSelectedDepts] = useState<string[]>([])
    const [popup, setPopup] = useState<{ title: string; entries: BiometricEntry[] } | null>(null)

    useEffect(() => {
        fetch("/api/user/me").then(r => r.json()).then(u => {
            if (u?.selectedTimezone) setAdminTz(u.selectedTimezone)
        }).catch(() => {})
    }, [])

    const fmt = (t: string | null) => formatInTz(t, selectedDate, adminTz)

    const fetchData = async (date: string) => {
        setIsLoading(true)
        setError(null)
        setSetupRequired(false)
        setSelectedNames([])
        setSelectedDepts([])
        try {
            const res = await fetch(`/api/biometric?date=${date}`)
            const json = await res.json()
            if (!res.ok) {
                if (json.error === "SETUP_REQUIRED") setSetupRequired(true)
                else setError(json.error || "Failed to load")
                return
            }
            setData(json)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { fetchData(selectedDate) }, [selectedDate])

    // Derive filter options from loaded data
    const allNames = [...new Set((data?.entries ?? []).map(e => e.biometric.name))].sort()
    const allDepts = [...new Set((data?.entries ?? []).map(e => e.biometric.department).filter(Boolean))].sort()

    const filtered = (data?.entries ?? []).filter(e => {
        if (selectedNames.length > 0 && !selectedNames.includes(e.biometric.name)) return false
        if (selectedDepts.length > 0 && !selectedDepts.includes(e.biometric.department)) return false
        return true
    })

    const onTime = filtered.filter(e => {
        const firstIn = e.biometric.firstIn
        const expected = e.biometric.expectedStart
        if (!firstIn || firstIn === "--") return false
        if (!expected || expected === "--") return false
        const diff = timeDiffMinutes(expected, firstIn)
        return diff !== null && diff <= 5
    })
    const late = filtered.filter(e => {
        const firstIn = e.biometric.firstIn
        const expected = e.biometric.expectedStart
        if (!firstIn || firstIn === "--") return false
        if (!expected || expected === "--") return false
        const diff = timeDiffMinutes(expected, firstIn)
        return diff !== null && diff > 5
    })
    const absent = filtered.filter(e => !e.biometric.firstIn || e.biometric.firstIn === "--")

    // ── XLSX Export ──────────────────────────────────────────────────────────
    const exportXLSX = () => {
        const rows = filtered.map(e => ({
            "Name": e.biometric.name,
            "Department": e.biometric.department,
            "Employee ID": e.biometric.employeeId,
            "Expected Start": fmt(e.biometric.expectedStart),
            "Bio In": fmt(e.biometric.firstIn),
            "Punctuality": punctualityStr(e.biometric.firstIn, e.biometric.expectedStart),
            "App Clock In": e.app?.clockIn ? fmt(e.app.clockIn) : "—",
            "In Diff (Bio vs App)": diffStr(e.biometric.firstIn, e.app?.clockIn ?? null),
            "Bio Out": fmt(e.biometric.lastOut),
            "App Clock Out": e.app?.clockOut ? fmt(e.app.clockOut) : "—",
            "Out Diff (Bio vs App)": diffStr(e.biometric.lastOut, e.app?.clockOut ?? null),
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Biometric")
        XLSX.writeFile(wb, `biometric_${selectedDate}.xlsx`)
    }

    // ── Payroll CSV Export (matches Apps Script format) ──────────────────────
    const exportPayrollCSV = () => {
        const csvRows: string[] = []
        const [y, mo, d] = selectedDate.split("-")
        const datePart = `${mo}/${d}/${y.slice(2)}` // MM/dd/yy

        for (const e of filtered) {
            const empCode = e.biometric.employeeId
            if (!empCode || empCode === "--") continue
            const padded = empCode.padStart(3, "0")

            if (e.biometric.firstIn && e.biometric.firstIn !== "--") {
                const t = toMilitaryTime(e.biometric.firstIn)
                if (t) csvRows.push(`${padded},1,${datePart} ${t}`)
            }
            if (e.biometric.lastOut && e.biometric.lastOut !== "--") {
                const t = toMilitaryTime(e.biometric.lastOut)
                if (t) csvRows.push(`${padded},2,${datePart} ${t}`)
            }
        }

        const content = csvRows.join("\n")
        const blob = new Blob([content], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `payroll_import_${selectedDate.replace(/-/g, "")}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Fingerprint className="w-6 h-6 text-red-600" />
                    Biometric Comparison
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Philippines office · Times in {adminTz} · 5-min grace on punctuality
                </p>
            </div>

            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-1.5 shadow-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="border-none bg-transparent h-8 focus:outline-none text-sm font-medium w-36"
                    />
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchData(selectedDate)} disabled={isLoading} className="h-9">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span className="ml-1.5">Refresh</span>
                </Button>

                {data && (
                    <>
                        <MultiSelect
                            label="Department"
                            options={allDepts}
                            selected={selectedDepts}
                            onChange={setSelectedDepts}
                        />
                        <MultiSelect
                            label="Name"
                            options={allNames}
                            selected={selectedNames}
                            onChange={setSelectedNames}
                        />
                    </>
                )}

                <div className="flex-1" />

                {data && (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={exportXLSX} className="h-9 gap-1.5">
                            <FileSpreadsheet className="w-4 h-4 text-green-600" />
                            Export XLSX
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportPayrollCSV} className="h-9 gap-1.5">
                            <FileText className="w-4 h-4 text-blue-600" />
                            Payroll CSV
                        </Button>
                    </div>
                )}
            </div>

            {setupRequired && <SetupInstructions />}

            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-4 pb-3 px-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-red-700 text-sm">Failed to load biometric data</p>
                            <p className="text-xs text-red-600 mt-0.5">{error}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {data && !isLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: "Total Biometric", count: filtered.length, color: "text-foreground", entries: filtered },
                        { label: "On Time", count: onTime.length, color: "text-green-600", entries: onTime },
                        { label: "Late", count: late.length, color: "text-red-600", entries: late },
                        { label: "Absent", count: absent.length, color: "text-gray-500", entries: absent },
                    ].map(({ label, count, color, entries }) => (
                        <Card
                            key={label}
                            className="border-border shadow-none cursor-pointer hover:shadow-sm hover:border-gray-300 transition-all"
                            onClick={() => setPopup({ title: `${label} (${count})`, entries })}
                        >
                            <CardContent className="pt-4 pb-3 px-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                                <p className={`text-2xl font-bold mt-1 ${color}`}>{count}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Popup dialog */}
            <Dialog open={!!popup} onOpenChange={o => { if (!o) setPopup(null) }}>
                <DialogContent className="max-w-md max-h-[70vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-base">{popup?.title}</DialogTitle>
                    </DialogHeader>
                    <div className="overflow-y-auto flex-1 -mx-6 px-6">
                        {popup?.entries.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">No employees in this category.</p>
                        ) : (
                            <div className="divide-y divide-border">
                                {popup?.entries.map((e, i) => (
                                    <div key={i} className="flex items-center justify-between py-2.5">
                                        <div>
                                            <p className="text-sm font-medium">{e.biometric.name}</p>
                                            <p className="text-xs text-muted-foreground">{e.biometric.department}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-mono text-green-700">{fmt(e.biometric.firstIn)}</p>
                                            <p className="text-[10px] text-muted-foreground">{fmt(e.biometric.expectedStart)} expected</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {!setupRequired && (
                <Card className="border-border shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                            {data ? `${data.tab} — Biometric vs App` : isLoading ? "Loading…" : "No data"}
                        </CardTitle>
                        <CardDescription className="text-xs">
                            In Diff / Out Diff = App time minus Bio time (positive = app recorded later)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                                        <TableHead className="font-bold text-foreground w-[180px]">Name</TableHead>
                                        <TableHead className="font-bold text-foreground">Dept</TableHead>
                                        <TableHead className="font-bold text-foreground text-center">Expected</TableHead>
                                        <TableHead className="font-bold text-foreground text-center">Bio In</TableHead>
                                        <TableHead className="font-bold text-foreground text-center">Punctuality</TableHead>
                                        <TableHead className="font-bold text-foreground text-center">App Clock In</TableHead>
                                        <TableHead className="font-bold text-foreground text-center">In Diff</TableHead>
                                        <TableHead className="font-bold text-foreground text-center">Bio Out</TableHead>
                                        <TableHead className="font-bold text-foreground text-center">App Clock Out</TableHead>
                                        <TableHead className="font-bold text-foreground text-center">Out Diff</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        Array.from({ length: 8 }).map((_, i) => (
                                            <TableRow key={i}>
                                                {Array.from({ length: 10 }).map((_, j) => (
                                                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : filtered.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                                                {data ? "No records match the current filter." : "Select a date to load biometric data."}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filtered.map((entry, i) => {
                                            const inDiff = timeDiffMinutes(entry.biometric.firstIn, entry.app?.clockIn ?? null)
                                            const outDiff = timeDiffMinutes(entry.biometric.lastOut, entry.app?.clockOut ?? null)
                                            const hasDiscrepancy = (inDiff !== null && Math.abs(inDiff) >= 5) || (outDiff !== null && Math.abs(outDiff) >= 5)

                                            return (
                                                <TableRow key={i} className={cn(
                                                    "hover:bg-muted/50",
                                                    hasDiscrepancy && entry.matched && "bg-red-50/40 hover:bg-red-50/60"
                                                )}>
                                                    <TableCell className="font-medium text-sm">
                                                        <div className="flex flex-col">
                                                            <span>{entry.biometric.name}</span>
                                                            {!entry.matched && (
                                                                <span className="text-[10px] text-yellow-600 font-bold">Not in app</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{entry.biometric.department}</TableCell>
                                                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                                        {fmt(entry.biometric.expectedStart)}
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono text-sm text-green-700">
                                                        {fmt(entry.biometric.firstIn)}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <PunctualityBadge firstIn={entry.biometric.firstIn} expectedStart={entry.biometric.expectedStart} />
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono text-sm text-blue-700">
                                                        {entry.app?.clockIn ? fmt(entry.app.clockIn) : <span className="text-muted-foreground">—</span>}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <DiffBadge bioTime={entry.biometric.firstIn} appTime={entry.app?.clockIn ?? null} />
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono text-sm text-orange-700">
                                                        {fmt(entry.biometric.lastOut)}
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono text-sm text-purple-700">
                                                        {entry.app?.clockOut ? fmt(entry.app.clockOut) : <span className="text-muted-foreground">—</span>}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <DiffBadge bioTime={entry.biometric.lastOut} appTime={entry.app?.clockOut ?? null} />
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
