"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
    Users, Clock, CalendarOff, TrendingUp, Download,
    Loader2, Building2, MapPin, Timer, Coffee, AlertTriangle,
    CheckCircle2, XCircle, Activity, Home, Briefcase,
    Target, Award, Zap, RefreshCcw, Search, ChevronDown,
    ChevronUp, UserCircle, X, Sparkles, Brain, Send,
    Fingerprint, ChevronRight
} from "lucide-react"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
    AreaChart, Area, ScatterChart, Scatter
} from 'recharts'
import { format, subDays, startOfYear, subMonths } from "date-fns"
import * as XLSX from 'xlsx'
import ReactMarkdown from "react-markdown"
import { cn } from "@/lib/utils"

// ── Constants ─────────────────────────────────────────────────────
const LEAVE_TYPE_LABELS: Record<string, string> = {
    SICK: 'Sick Leave', VACATION: 'Vacation', BIRTHDAY: 'Birthday',
    MATERNITY: 'Maternity / Paternity', OTHER: 'Other'
}
const CHART_COLORS = {
    primary: '#ef4444', green: '#22c55e', blue: '#3b82f6',
    amber: '#f59e0b', purple: '#8b5cf6', slate: '#64748b',
    emerald: '#10b981', rose: '#f43f5e',
}
const PIE_COLORS = [CHART_COLORS.primary, CHART_COLORS.blue, CHART_COLORS.amber, CHART_COLORS.purple, CHART_COLORS.emerald]

const LEVEL_LABELS: Record<number, string> = {
    6: 'On Time', 5: 'Late', 4: 'Absent',
    3: 'Sick Leave', 2: 'Vacation', 1: 'Birthday / Maternity', 0: 'Other Leave',
}
const LEVEL_COLORS: Record<number, string> = {
    6: '#22c55e', 5: '#f59e0b', 4: '#ef4444',
    3: '#f97316', 2: '#3b82f6', 1: '#8b5cf6', 0: '#64748b',
}

function getDayLevel(day: { status: string; leaveType?: string; tardiness: number }): number {
    if (day.status === 'LEAVE') {
        switch (day.leaveType) {
            case 'SICK': return 3
            case 'VACATION': return 2
            case 'BIRTHDAY': case 'MATERNITY': return 1
            default: return 0
        }
    }
    if (day.status === 'ABSENT') return 4
    if (day.status === 'HALF_DAY' || day.status === 'LATE' || day.tardiness > 0) return 5
    return 6
}

const PRESETS = [
    { label: 'Today', getValue: () => ({ start: format(new Date(), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') }) },
    { label: 'This Week', getValue: () => { const d = new Date(); const mon = new Date(d); mon.setDate(d.getDate() - (d.getDay() || 7) + 1); return { start: format(mon, 'yyyy-MM-dd'), end: format(d, 'yyyy-MM-dd') } } },
    { label: 'This Month', getValue: () => ({ start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') }) },
    { label: 'Last 30 Days', getValue: () => ({ start: format(subDays(new Date(), 30), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') }) },
    { label: 'Last 3 Months', getValue: () => ({ start: format(subMonths(new Date(), 3), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') }) },
    { label: 'Last 6 Months', getValue: () => ({ start: format(subMonths(new Date(), 6), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') }) },
    { label: 'YTD', getValue: () => ({ start: format(startOfYear(new Date()), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') }) },
]

// ── Skeleton helpers ──────────────────────────────────────────────
function SkeletonCard() {
    return (
        <Card className="border border-border shadow-sm bg-white">
            <CardContent className="p-5 space-y-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-7 w-24 mt-3" />
                <Skeleton className="h-3 w-32" />
            </CardContent>
        </Card>
    )
}
function SkeletonChart({ height = 260 }: { height?: number }) {
    return <Skeleton className="w-full rounded-lg" style={{ height }} />
}
function SkeletonTableRows({ cols = 7, rows = 5 }: { cols?: number; rows?: number }) {
    return <>{Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
            {Array.from({ length: cols }).map((_, j) => (
                <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
            ))}
        </TableRow>
    ))}</>
}

function StatCard({ icon: Icon, label, value, sub, color = 'primary' }: {
    icon: any; label: string; value: string | number; sub?: string
    color?: 'primary' | 'green' | 'amber' | 'blue' | 'purple'
}) {
    const colorMap = {
        primary: 'bg-red-50 text-red-600 border-red-100',
        green: 'bg-green-50 text-green-600 border-green-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
    }
    return (
        <Card className="border border-border shadow-sm bg-white">
            <CardContent className="p-5">
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center border shrink-0", colorMap[color])}>
                    <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3">
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mt-0.5">{label}</p>
                    {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
                </div>
            </CardContent>
        </Card>
    )
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
    return (
        <div className="mb-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">{title}</h2>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
    )
}

// ── Status Dot Chart ──────────────────────────────────────────────
function StatusDotChart({ dailyTrend }: { dailyTrend: any[] }) {
    const chartData = dailyTrend.map((day, i) => ({
        x: i, y: getDayLevel(day),
        date: day.date, status: day.status, leaveType: day.leaveType,
        tardiness: day.tardiness, clockIn: day.clockIn,
    }))
    const xStep = Math.max(1, Math.ceil(dailyTrend.length / 12))
    const xTicks = dailyTrend.map((_, i) => i).filter(i => i % xStep === 0)

    return (
        <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 10, right: 16, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" dataKey="x"
                    domain={[-0.5, dailyTrend.length - 0.5]} ticks={xTicks}
                    tickFormatter={i => { const d = dailyTrend[i]?.date; return d ? format(new Date(d + 'T12:00:00'), 'MMM d') : '' }}
                    tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="number" dataKey="y"
                    domain={[-0.5, 6.5]} ticks={[0, 1, 2, 3, 4, 5, 6]}
                    tickFormatter={v => LEVEL_LABELS[v] ?? ''}
                    tick={{ fontSize: 9, fill: '#94a3b8' }} width={110} axisLine={false} tickLine={false} />
                <Tooltip cursor={false} content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                        <div className="bg-white border border-border rounded-lg p-2.5 shadow-md text-xs">
                            <p className="font-semibold">{d.date}</p>
                            <p className="text-muted-foreground mt-0.5">{LEVEL_LABELS[d.y]}</p>
                            {d.tardiness > 0 && <p className="text-amber-600">{d.tardiness}min late</p>}
                            {d.clockIn && <p className="text-muted-foreground">In: {format(new Date(d.clockIn), 'h:mm a')}</p>}
                        </div>
                    )
                }} />
                <Scatter data={chartData} shape={(props: any) => {
                    const { cx, cy, payload } = props
                    return <circle cx={cx} cy={cy} r={5.5} fill={LEVEL_COLORS[payload.y] ?? '#64748b'} stroke="white" strokeWidth={1.5} />
                }} />
            </ScatterChart>
        </ResponsiveContainer>
    )
}

// ── Enhanced Staff KPI Card ───────────────────────────────────────
function StaffKPICard({ staff, loading }: { staff: any; loading: boolean }) {
    const [expanded, setExpanded] = useState(true)

    if (loading) {
        return (
            <Card className="border border-border shadow-sm bg-white">
                <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2 flex-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
                    </div>
                    <Skeleton className="h-20 w-full rounded-lg" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                </CardContent>
            </Card>
        )
    }

    const attColor = staff.attendanceRate >= 80 ? 'text-green-600' : staff.attendanceRate >= 60 ? 'text-amber-600' : 'text-red-600'
    const onTimeColor = staff.onTimeRate >= 80 ? 'text-green-600' : staff.onTimeRate >= 60 ? 'text-amber-600' : 'text-red-600'
    const leaveTypes = [
        { label: 'Sick', days: staff.sickLeaveDays, color: 'bg-orange-100 text-orange-700' },
        { label: 'Vacation', days: staff.vacationDays, color: 'bg-blue-100 text-blue-700' },
        { label: 'Birthday', days: staff.birthdayDays, color: 'bg-pink-100 text-pink-700' },
        { label: 'Maternity', days: staff.maternityDays, color: 'bg-purple-100 text-purple-700' },
        { label: 'Other', days: staff.otherLeaveDays, color: 'bg-slate-100 text-slate-700' },
    ].filter(l => l.days > 0)

    return (
        <Card className="border border-border shadow-sm bg-white overflow-hidden">
            <CardContent className="p-0">
                {/* Header */}
                <div className="flex items-start gap-3 p-5 pb-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {staff.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground truncate">{staff.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{staff.dept}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold">
                                <MapPin className="h-2.5 w-2.5 mr-1" />{staff.location || 'Unknown'}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold">
                                <Clock className="h-2.5 w-2.5 mr-1" />{staff.shiftStart}–{staff.shiftEnd}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 border-t border-border divide-x divide-border">
                    {[
                        { label: 'Attendance', value: `${staff.attendanceRate}%`, color: attColor },
                        { label: 'On Time', value: `${staff.onTimeRate}%`, color: onTimeColor },
                        { label: 'Avg Hours', value: `${staff.avgWorkHours}h`, color: 'text-foreground' },
                    ].map(s => (
                        <div key={s.label} className="flex flex-col items-center py-3 px-2">
                            <span className={cn("text-lg font-bold tabular-nums", s.color)}>{s.value}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">{s.label}</span>
                        </div>
                    ))}
                </div>

                {/* Metric pills */}
                <div className="flex flex-wrap gap-2 px-5 py-3 border-t border-border bg-muted/20">
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
                        <XCircle className="h-3 w-3" />{staff.absentDays}d absent
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
                        <Timer className="h-3 w-3" />{staff.lateDays}x late {staff.lateDays > 0 && `(avg ${staff.avgTardiness}m)`}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                        <CalendarOff className="h-3 w-3" />{staff.leaveDays}d leave
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                        <Home className="h-3 w-3" />{staff.wfhDays}d WFH
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-purple-600 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5">
                        <Coffee className="h-3 w-3" />avg {staff.avgBreakMinutes}m break
                    </span>
                </div>

                {/* Leave type breakdown */}
                {leaveTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-5 pb-3">
                        {leaveTypes.map(lt => (
                            <span key={lt.label} className={cn("h-5 px-2 rounded-full text-[10px] font-semibold flex items-center border border-transparent", lt.color)}>
                                {lt.label}: {lt.days}d
                            </span>
                        ))}
                    </div>
                )}

                {/* Daily status timeline (Y-axis dot chart) */}
                {staff.dailyTrend?.length > 0 && (
                    <>
                        <button
                            onClick={() => setExpanded(v => !v)}
                            className="w-full flex items-center justify-between px-5 py-2.5 border-t border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted/30 transition-colors"
                        >
                            Daily Status Timeline
                            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                        {expanded && (
                            <div className="px-2 pb-3 border-t border-border">
                                <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 pt-2 mb-1">
                                    {Object.entries(LEVEL_LABELS).reverse().map(([level, label]) => (
                                        <div key={level} className="flex items-center gap-1">
                                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLORS[Number(level)] }} />
                                            <span className="text-[9px] text-muted-foreground">{label}</span>
                                        </div>
                                    ))}
                                </div>
                                <StatusDotChart dailyTrend={staff.dailyTrend} />
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}

// ── Biometric Comparison ──────────────────────────────────────────
function BiometricComparison({ staffKPI, startDate, endDate }: { staffKPI: any[]; startDate: string; endDate: string }) {
    const [loading, setLoading] = useState(false)
    const [rows, setRows] = useState<any[]>([])
    const [loaded, setLoaded] = useState(false)
    const [error, setError] = useState('')
    const staffIds = staffKPI.map(s => s.id)
    const staffNames: Record<string, string> = Object.fromEntries(staffKPI.map(s => [s.id, s.name]))

    function parseTimeToMs(date: string, timeStr: string): number {
        if (!timeStr) return 0
        const [h, m] = timeStr.split(':').map(Number)
        const d = new Date(date + 'T00:00:00')
        d.setHours(h || 0, m || 0, 0, 0)
        return d.getTime()
    }

    async function load() {
        setLoading(true); setError('')
        try {
            const workingDays: string[] = []
            const s = new Date(startDate), e = new Date(endDate)
            for (const d = new Date(s); d <= e && workingDays.length < 14; d.setDate(d.getDate() + 1)) {
                const day = d.getDay()
                if (day !== 0 && day !== 6) workingDays.push(d.toISOString().split('T')[0])
            }
            workingDays.reverse()
            const results: any[] = []
            for (const date of workingDays) {
                try {
                    const res = await fetch(`/api/biometric?date=${date}`)
                    if (!res.ok) continue
                    const json = await res.json()
                    for (const entry of json.entries || []) {
                        if (!entry.matched || !entry.app?.userId) continue
                        if (staffIds.length > 0 && !staffIds.includes(entry.app.userId)) continue
                        const bioTime = entry.biometric?.firstIn
                        const appTime = entry.app?.clockIn
                        let match: 'match' | 'discrepancy' | 'missing' = 'missing'
                        let diffMin = 0
                        if (bioTime && appTime) {
                            diffMin = Math.abs(new Date(appTime).getTime() - parseTimeToMs(date, bioTime)) / 60000
                            match = diffMin <= 15 ? 'match' : 'discrepancy'
                        }
                        results.push({
                            date, staffId: entry.app.userId,
                            staffName: staffNames[entry.app.userId] || entry.biometric?.name || 'Unknown',
                            bioTime, appTime: appTime ? format(new Date(appTime), 'h:mm a') : null,
                            match, diffMin: Math.round(diffMin),
                        })
                    }
                } catch { }
            }
            setRows(results); setLoaded(true)
        } catch { setError('Failed to load biometric data') }
        finally { setLoading(false) }
    }

    return (
        <Card className="border border-border shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-4 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-bold">Biometric vs App Comparison</CardTitle>
                    <span className="text-[10px] text-muted-foreground ml-1">— most recent 14 working days</span>
                </div>
                <Button size="sm" variant={loaded ? "ghost" : "outline"} onClick={load} disabled={loading} className="h-7 text-xs">
                    {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Fingerprint className="h-3.5 w-3.5 mr-1.5" />}
                    {loading ? 'Loading…' : loaded ? 'Refresh' : 'Load Biometric Data'}
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                {!loaded && !loading && (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                        <Fingerprint className="h-7 w-7 mx-auto mb-2 text-muted-foreground/30" />
                        <p>Click "Load Biometric Data" to compare app clock-in times against biometric records.</p>
                    </div>
                )}
                {error && <p className="p-4 text-xs text-red-600">{error}</p>}
                {loaded && rows.length === 0 && (
                    <p className="p-6 text-xs text-center text-muted-foreground">No matched biometric records found for the selected staff and date range.</p>
                )}
                {loaded && rows.length > 0 && (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                                {['Date', 'Staff', 'Biometric In', 'App Clock-in', 'Match'].map(h => (
                                    <TableHead key={h} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{h}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row, i) => (
                                <TableRow key={i} className="hover:bg-muted/20">
                                    <TableCell className="px-4 py-2.5 text-sm text-muted-foreground">{row.date}</TableCell>
                                    <TableCell className="px-4 py-2.5 text-sm font-medium">{row.staffName}</TableCell>
                                    <TableCell className="px-4 py-2.5 text-sm text-center font-mono">{row.bioTime || '—'}</TableCell>
                                    <TableCell className="px-4 py-2.5 text-sm text-center font-mono">{row.appTime || '—'}</TableCell>
                                    <TableCell className="px-4 py-2.5 text-center">
                                        {row.match === 'match' && <span className="inline-flex items-center gap-1 text-green-600 text-xs font-semibold"><CheckCircle2 className="h-4 w-4" /> Match</span>}
                                        {row.match === 'discrepancy' && <span className="inline-flex items-center gap-1 text-red-600 text-xs font-semibold"><XCircle className="h-4 w-4" /> {row.diffMin}m diff</span>}
                                        {row.match === 'missing' && <span className="inline-flex items-center gap-1 text-muted-foreground text-xs"><AlertTriangle className="h-4 w-4" /> Missing</span>}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}

// ── RISA AI Panel ─────────────────────────────────────────────────
function RISAPanel({ staffKPI, dateRange, hasData }: { staffKPI: any[]; dateRange: { start: string; end: string }; hasData: boolean }) {
    const [insight, setInsight] = useState('')
    const [generating, setGenerating] = useState(false)
    const [question, setQuestion] = useState('')
    const [error, setError] = useState('')
    const [collapsed, setCollapsed] = useState(false)

    async function generate(customQ?: string) {
        if (!hasData) return
        setGenerating(true); setError(''); setInsight(''); setCollapsed(false)
        try {
            const res = await fetch('/api/admin/ai-insights/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staffData: staffKPI, dateRange, question: customQ }),
            })
            if (!res.ok) throw new Error()
            const json = await res.json()
            setInsight(json.insight || '')
            if (json.error) setError(json.error)
        } catch { setError('Failed to generate insights. Please try again.') }
        finally { setGenerating(false) }
    }

    return (
        <Card className="border border-border shadow-sm overflow-hidden bg-gradient-to-r from-violet-50/60 to-blue-50/60">
            <CardHeader className="p-4 border-b border-violet-100/60">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-sm">
                            <Brain className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-foreground">RISA — AI Insights</p>
                            <p className="text-[10px] text-muted-foreground">Redadair Intelligent Staff Assistant</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!generating && !insight && (
                            <Button
                                size="sm"
                                disabled={!hasData || generating}
                                onClick={() => generate()}
                                className="h-8 gap-1.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-xs"
                            >
                                <Sparkles className="h-3.5 w-3.5" />
                                {hasData ? 'Generate Insights' : 'Select data first'}
                            </Button>
                        )}
                        {insight && !generating && (
                            <Button size="sm" variant="ghost" onClick={() => generate()} className="h-7 text-xs text-muted-foreground">
                                <RefreshCcw className="h-3 w-3 mr-1" /> Regenerate
                            </Button>
                        )}
                        {(insight || generating) && (
                            <button onClick={() => setCollapsed(v => !v)} className="text-muted-foreground hover:text-foreground p-1">
                                {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                            </button>
                        )}
                    </div>
                </div>
            </CardHeader>

            {!collapsed && (
                <CardContent className="p-4">
                    {!insight && !generating && (
                        <p className="text-xs text-muted-foreground">
                            {hasData
                                ? `Ready to analyse ${staffKPI.length} staff member${staffKPI.length !== 1 ? 's' : ''} · ${dateRange.start} to ${dateRange.end}. Click Generate Insights to begin.`
                                : 'Load data using the filters below, then generate AI insights.'}
                        </p>
                    )}
                    {generating && (
                        <div className="flex items-center gap-2 py-2">
                            <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                            <span className="text-xs text-muted-foreground">Analysing data…</span>
                        </div>
                    )}
                    {error && !generating && (
                        <div className="rounded-lg bg-red-50 border border-red-100 p-3 mb-3">
                            <p className="text-xs text-red-600">{error}</p>
                        </div>
                    )}
                    {insight && !generating && (
                        <div>
                            <div className="prose prose-sm max-w-none text-sm leading-relaxed
                                [&>h1]:text-base [&>h1]:font-bold [&>h1]:mt-4 [&>h1]:mb-2
                                [&>h2]:text-sm [&>h2]:font-bold [&>h2]:mt-3 [&>h2]:mb-1.5
                                [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mt-3 [&>h3]:mb-1
                                [&>p]:mb-3 [&>p]:text-[13px]
                                [&>ul]:mb-3 [&>ul]:pl-4 [&>li]:text-[13px] [&>li]:mb-1
                                [&>ol]:mb-3 [&>ol]:pl-4">
                                <ReactMarkdown>{insight}</ReactMarkdown>
                            </div>
                            <div className="mt-3 pt-3 border-t border-violet-100">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Ask a follow-up</p>
                                <div className="flex gap-2">
                                    <Input value={question} onChange={e => setQuestion(e.target.value)}
                                        placeholder="e.g. Who has the most sick leave? Any patterns of concern?"
                                        className="text-xs h-8 bg-white"
                                        onKeyDown={e => { if (e.key === 'Enter' && question.trim()) { generate(question); setQuestion('') } }}
                                    />
                                    <Button size="sm" className="h-8 px-3" disabled={!question.trim() || generating}
                                        onClick={() => { generate(question); setQuestion('') }}>
                                        <Send className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    )
}

// ── Main Page ─────────────────────────────────────────────────────
export default function AIInsightsPage() {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [departments, setDepartments] = useState<any[]>([])
    const [allStaff, setAllStaff] = useState<any[]>([])
    const [staffSearch, setStaffSearch] = useState('')
    const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
    const [staffPopoverOpen, setStaffPopoverOpen] = useState(false)
    const [deptPopoverOpen, setDeptPopoverOpen] = useState(false)
    const [deptSearch, setDeptSearch] = useState('')
    const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>(() => {
        if (typeof window === 'undefined') return []
        try { return JSON.parse(localStorage.getItem('kpi_deptIds') || '[]') } catch { return [] }
    })
    const [activePreset, setActivePreset] = useState(() =>
        typeof window !== 'undefined' ? localStorage.getItem('kpi_preset') || 'Last 30 Days' : 'Last 30 Days'
    )
    const [startDate, setStartDate] = useState(() =>
        typeof window !== 'undefined' ? localStorage.getItem('kpi_startDate') || format(subDays(new Date(), 30), 'yyyy-MM-dd') : format(subDays(new Date(), 30), 'yyyy-MM-dd')
    )
    const [endDate, setEndDate] = useState(() =>
        typeof window !== 'undefined' ? localStorage.getItem('kpi_endDate') || format(new Date(), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
    )
    const [selectedLocation, setSelectedLocation] = useState(() =>
        typeof window !== 'undefined' ? localStorage.getItem('kpi_location') || 'all' : 'all'
    )
    const [includeLeavesInTrend, setIncludeLeavesInTrend] = useState(false)
    const [showPendingInTrend, setShowPendingInTrend] = useState(false)

    useEffect(() => { localStorage.setItem('kpi_preset', activePreset) }, [activePreset])
    useEffect(() => { localStorage.setItem('kpi_startDate', startDate) }, [startDate])
    useEffect(() => { localStorage.setItem('kpi_endDate', endDate) }, [endDate])
    useEffect(() => { localStorage.setItem('kpi_deptIds', JSON.stringify(selectedDeptIds)) }, [selectedDeptIds])
    useEffect(() => { localStorage.setItem('kpi_location', selectedLocation) }, [selectedLocation])

    useEffect(() => {
        Promise.all([
            fetch('/api/departments').then(r => r.ok ? r.json() : []),
            fetch('/api/employees').then(r => r.ok ? r.json() : []),
        ]).then(([depts, emps]) => {
            setDepartments(depts)
            setAllStaff(emps.filter((e: any) => !e.isArchived))
        }).catch(() => { })
    }, [])

    const fetchData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true)
        else setLoading(true)
        try {
            const params = new URLSearchParams({ startDate, endDate, location: selectedLocation })
            if (selectedStaffIds.length > 0) params.set('staffIds', selectedStaffIds.join(','))
            else if (selectedDeptIds.length > 0) params.set('departmentIds', selectedDeptIds.join(','))
            const res = await fetch(`/api/admin/kpi?${params}`)
            if (res.ok) setData(await res.json())
        } finally { setLoading(false); setRefreshing(false) }
    }, [startDate, endDate, selectedDeptIds, selectedLocation, selectedStaffIds])

    useEffect(() => { fetchData() }, [fetchData])

    const applyPreset = (preset: typeof PRESETS[0]) => {
        const { start, end } = preset.getValue()
        setActivePreset(preset.label); setStartDate(start); setEndDate(end)
    }
    const handleCustomDate = (field: 'start' | 'end', val: string) => {
        setActivePreset('Custom')
        if (field === 'start') setStartDate(val); else setEndDate(val)
    }
    const toggleStaff = (id: string) => setSelectedStaffIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    const clearStaff = () => setSelectedStaffIds([])
    const toggleDept = (id: string) => setSelectedDeptIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    const clearDepts = () => setSelectedDeptIds([])

    const filteredDeptDropdown = useMemo(() => {
        const q = deptSearch.toLowerCase()
        return departments.filter(d => d.name?.toLowerCase().includes(q))
    }, [departments, deptSearch])

    const filteredStaffDropdown = useMemo(() => {
        const q = staffSearch.toLowerCase()
        return allStaff.filter(s => {
            if (selectedDeptIds.length > 0 && !selectedDeptIds.includes(s.departmentId)) return false
            return s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.department?.name?.toLowerCase().includes(q)
        })
    }, [allStaff, staffSearch, selectedDeptIds])

    const selectedStaffNames = useMemo(() =>
        allStaff.filter(s => selectedStaffIds.includes(s.id)).map(s => s.name)
    , [allStaff, selectedStaffIds])

    const trendData = useMemo(() => {
        if (!data?.attendanceTrend) return []
        return data.attendanceTrend.map((d: any) => {
            const present = d.present ?? 0
            const paidLeave = d.paidLeave ?? 0
            const unpaidOrSick = d.unpaidOrSickLeave ?? 0
            const pending = d.pendingLeave ?? 0
            const absent = d.absent ?? 0

            // Base denominator excludes paid leave (they're not expected at work)
            // When showPending is ON, also exclude pending from absent count
            const effectiveAbsent = showPendingInTrend ? Math.max(0, absent - pending) : absent

            if (includeLeavesInTrend) {
                // All leaves included — paid leave back in denominator
                const denominator = present + paidLeave + unpaidOrSick + (showPendingInTrend ? 0 : pending) + effectiveAbsent
                return { ...d, rate: denominator > 0 ? Math.round((present / denominator) * 100) : 0 }
            }

            // Default — paid leave excluded from denominator
            const denominator = present + unpaidOrSick + (showPendingInTrend ? 0 : pending) + effectiveAbsent
            return { ...d, rate: denominator > 0 ? Math.round((present / denominator) * 100) : 0 }
        })
    }, [data?.attendanceTrend, includeLeavesInTrend, showPendingInTrend])

    const exportToExcel = () => {
        if (!data) return
        const wb = XLSX.utils.book_new()
        const summaryRows = [
            ['AI Insights Report', `${startDate} to ${endDate}`], [''],
            ['Metric', 'Value'],
            ['Total Active Staff', data.summary.totalActiveStaff],
            ['Attendance Rate (%)', data.summary.attendanceRate],
            ['On-Time Rate (%)', data.summary.onTimeRate],
            ['Absent Rate (%)', data.summary.absentRate],
            ['WFH Rate (%)', data.summary.wfhRate],
            ['Avg Work Hours / Day', data.summary.avgWorkHours],
            ['Total Leave Days', data.summary.totalLeaveDays],
            ['Working Days in Range', data.summary.workingDaysInRange],
        ]
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary')
        if (data.staffKPI?.length) {
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
                ['Name', 'Dept', 'Location', 'Expected', 'Present', 'Absent', 'Leave', 'Late', 'WFH', 'Attend %', 'OnTime %', 'Avg Hrs', 'Sick Leave', 'Vacation', 'Birthday', 'Maternity', 'Other Leave'],
                ...data.staffKPI.map((s: any) => [s.name, s.dept, s.location, s.expectedDays, s.presentDays, s.absentDays, s.leaveDays, s.lateDays, s.wfhDays, s.attendanceRate, s.onTimeRate, s.avgWorkHours, s.sickLeaveDays ?? 0, s.vacationDays ?? 0, s.birthdayDays ?? 0, s.maternityDays ?? 0, s.otherLeaveDays ?? 0])
            ]), 'Staff KPI')
        }
        if (data.departmentStats?.length) {
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
                ['Department', 'Headcount', 'Attendance %', 'Late Rate %', 'Avg Hours', 'Leave Days', 'WFH %'],
                ...data.departmentStats.map((d: any) => [d.dept, d.headcount, d.attendanceRate, d.lateRate, d.avgHours, d.leaveDays, d.wfhRate])
            ]), 'Department Stats')
        }
        XLSX.writeFile(wb, `AI_Insights_${startDate}_${endDate}.xlsx`)
    }

    const s = data?.summary
    const isStaffMode = selectedStaffIds.length > 0

    return (
        <div className="w-full mx-auto space-y-8 animate-in fade-in duration-300 pb-12 px-4 lg:px-8">

            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-sm">
                        <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Insights</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {loading ? 'Loading metrics…' : `${s?.workingDaysInRange ?? 0} working days · ${s?.totalActiveStaff ?? 0} ${isStaffMode ? 'selected staff' : 'active staff'}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={refreshing || loading} className="h-9 gap-1.5 text-xs font-semibold">
                        <RefreshCcw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Refresh
                    </Button>
                    <Button onClick={exportToExcel} disabled={loading || !data} size="sm" className="h-9 gap-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-semibold">
                        <Download className="h-3.5 w-3.5" /> Export Excel
                    </Button>
                </div>
            </div>

            {/* ── RISA AI Panel (top) ─────────────────────────────── */}
            <RISAPanel
                staffKPI={data?.staffKPI || []}
                dateRange={{ start: startDate, end: endDate }}
                hasData={!!data && (data.staffKPI?.length ?? 0) > 0}
            />

            {/* ── Filters ────────────────────────────────────────── */}
            <Card className="border border-border shadow-sm bg-white">
                <CardContent className="p-4 flex flex-col gap-4">
                    <div className="flex flex-wrap gap-1.5">
                        {PRESETS.map(p => (
                            <button key={p.label} onClick={() => applyPreset(p)}
                                className={cn(
                                    "h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                                    activePreset === p.label
                                        ? "bg-primary text-white border-primary"
                                        : "bg-white text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                                )}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">From</Label>
                            <Input type="date" value={startDate} onChange={e => handleCustomDate('start', e.target.value)} className="h-8 text-xs w-36" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">To</Label>
                            <Input type="date" value={endDate} onChange={e => handleCustomDate('end', e.target.value)} className="h-8 text-xs w-36" />
                        </div>

                        {/* Department */}
                        <Popover open={deptPopoverOpen} onOpenChange={setDeptPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" disabled={isStaffMode} className={cn(
                                    "h-8 w-auto px-3 min-w-[160px] justify-between text-xs font-semibold border-border bg-white hover:bg-slate-50",
                                    selectedDeptIds.length > 0 && "border-primary text-primary"
                                )}>
                                    <span className="flex items-center gap-1.5 truncate max-w-[130px]">
                                        <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                        {selectedDeptIds.length === 0 ? 'All Departments' : selectedDeptIds.length === 1 ? departments.find(d => d.id === selectedDeptIds[0])?.name : `${selectedDeptIds.length} departments`}
                                    </span>
                                    <ChevronDown className="h-3 w-3 ml-2 opacity-50 shrink-0" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-0" align="start">
                                <div className="p-3 border-b border-border">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Filter by Department</p>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input placeholder="Search departments…" value={deptSearch} onChange={e => setDeptSearch(e.target.value)} className="h-8 pl-8 text-xs" />
                                    </div>
                                </div>
                                <div className="max-h-52 overflow-y-auto p-2">
                                    {filteredDeptDropdown.map(dept => (
                                        <div key={dept.id} className="flex items-center gap-2.5 p-2 hover:bg-muted rounded-md cursor-pointer" onClick={() => toggleDept(dept.id)}>
                                            <Checkbox checked={selectedDeptIds.includes(dept.id)} />
                                            <span className="text-xs font-medium truncate">{dept.name}</span>
                                        </div>
                                    ))}
                                </div>
                                {selectedDeptIds.length > 0 && (
                                    <div className="p-2 border-t border-border">
                                        <button onClick={clearDepts} className="w-full text-[10px] text-primary font-bold hover:underline py-1">Clear selection ({selectedDeptIds.length})</button>
                                    </div>
                                )}
                            </PopoverContent>
                        </Popover>

                        {/* Location */}
                        <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={isStaffMode}>
                            <SelectTrigger className="h-8 w-36 text-xs font-semibold border-border">
                                <MapPin className="h-3 w-3 mr-1 opacity-50" />
                                <SelectValue placeholder="All Locations" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Locations</SelectItem>
                                <SelectItem value="Philippines">Philippines</SelectItem>
                                <SelectItem value="Australia">Australia</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Staff */}
                        <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn(
                                    "h-8 w-auto px-3 min-w-[160px] justify-between text-xs font-semibold border-border bg-white hover:bg-slate-50",
                                    selectedStaffIds.length > 0 && "border-primary text-primary"
                                )}>
                                    <span className="flex items-center gap-1.5 truncate max-w-[120px]">
                                        <UserCircle className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                        {selectedStaffIds.length === 0 ? 'All Staff' : selectedStaffIds.length === 1 ? selectedStaffNames[0] : `${selectedStaffIds.length} staff selected`}
                                    </span>
                                    <ChevronDown className="h-3 w-3 ml-2 opacity-50 shrink-0" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-0" align="start">
                                <div className="p-3 border-b border-border">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Filter by Staff</p>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input placeholder="Search staff…" value={staffSearch} onChange={e => setStaffSearch(e.target.value)} className="h-8 pl-8 text-xs" />
                                    </div>
                                </div>
                                <div className="max-h-60 overflow-y-auto p-2">
                                    {filteredStaffDropdown.length === 0
                                        ? <p className="text-xs text-muted-foreground text-center py-4">No staff found</p>
                                        : filteredStaffDropdown.map(emp => (
                                            <div key={emp.id} className="flex items-center gap-2.5 p-2 hover:bg-muted rounded-md cursor-pointer" onClick={() => toggleStaff(emp.id)}>
                                                <Checkbox checked={selectedStaffIds.includes(emp.id)} />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium truncate">{emp.name}</p>
                                                    <p className="text-[10px] text-muted-foreground truncate">{emp.department?.name || 'Unassigned'}</p>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                                {selectedStaffIds.length > 0 && (
                                    <div className="p-2 border-t border-border">
                                        <button onClick={clearStaff} className="w-full text-[10px] text-primary font-bold hover:underline py-1">Clear selection ({selectedStaffIds.length})</button>
                                    </div>
                                )}
                            </PopoverContent>
                        </Popover>

                        {/* Active chips */}
                        {selectedStaffIds.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {selectedStaffNames.slice(0, 3).map((name, i) => (
                                    <span key={i} className="flex items-center gap-1 h-6 px-2 rounded-full bg-primary/10 text-primary text-[10px] font-semibold border border-primary/20">
                                        {name}
                                        <button onClick={() => toggleStaff(selectedStaffIds[i])}><X className="h-2.5 w-2.5" /></button>
                                    </span>
                                ))}
                                {selectedStaffIds.length > 3 && (
                                    <span className="h-6 px-2 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold flex items-center">+{selectedStaffIds.length - 3} more</span>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ── Staff Assessment (when staff selected) ──────────── */}
            {isStaffMode && (
                <div>
                    <SectionHeader
                        title="Staff Assessment"
                        description={`Individual breakdown for ${selectedStaffIds.length} selected staff member${selectedStaffIds.length > 1 ? 's' : ''}`}
                    />

                    {/* Comparison table */}
                    {selectedStaffIds.length > 1 && (
                        <Card className="border border-border shadow-sm bg-white overflow-hidden mb-6">
                            <CardHeader className="p-4 border-b border-border bg-muted/20">
                                <CardTitle className="text-sm font-bold">Side-by-Side Comparison</CardTitle>
                            </CardHeader>
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                                        {['Staff', 'Attendance', 'On Time', 'Avg Hours', 'Absent', 'Late', 'Sick Leave', 'Vacation', 'WFH'].map(h => (
                                            <TableHead key={h} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center first:text-left">{h}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading
                                        ? <SkeletonTableRows cols={9} rows={selectedStaffIds.length} />
                                        : data?.staffKPI?.map((st: any) => (
                                            <TableRow key={st.id} className="hover:bg-muted/30">
                                                <TableCell className="px-5 py-3">
                                                    <p className="font-semibold text-sm">{st.name}</p>
                                                    <p className="text-[11px] text-muted-foreground">{st.dept}</p>
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-center">
                                                    <span className={cn("font-bold text-sm", st.attendanceRate >= 80 ? 'text-green-600' : st.attendanceRate >= 60 ? 'text-amber-600' : 'text-red-600')}>{st.attendanceRate}%</span>
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-center">
                                                    <span className={cn("font-bold text-sm", st.onTimeRate >= 80 ? 'text-green-600' : st.onTimeRate >= 60 ? 'text-amber-600' : 'text-red-600')}>{st.onTimeRate}%</span>
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-center text-sm font-medium">{st.avgWorkHours}h</TableCell>
                                                <TableCell className="px-4 py-3 text-center">
                                                    <span className={cn("text-sm font-medium", st.absentDays > 3 ? 'text-red-600 font-bold' : 'text-muted-foreground')}>{st.absentDays}d</span>
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-center">
                                                    <span className={cn("text-sm font-medium", st.lateDays > 3 ? 'text-amber-600 font-bold' : 'text-muted-foreground')}>
                                                        {st.lateDays}x {st.lateDays > 0 && <span className="text-[10px]">({st.avgTardiness}m)</span>}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-center text-sm text-orange-600 font-medium">{st.sickLeaveDays ?? 0}d</TableCell>
                                                <TableCell className="px-4 py-3 text-center text-sm text-blue-600 font-medium">{st.vacationDays ?? 0}d</TableCell>
                                                <TableCell className="px-4 py-3 text-center text-sm text-muted-foreground">{st.wfhDays}d</TableCell>
                                            </TableRow>
                                        ))
                                    }
                                </TableBody>
                            </Table>
                        </Card>
                    )}

                    {/* Individual cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {loading
                            ? selectedStaffIds.map(id => <StaffKPICard key={id} staff={null} loading />)
                            : data?.staffKPI?.map((st: any) => <StaffKPICard key={st.id} staff={st} loading={false} />)
                        }
                    </div>

                    {/* Biometric comparison */}
                    {!loading && data?.staffKPI?.length > 0 && (
                        <div className="mt-6">
                            <BiometricComparison staffKPI={data.staffKPI} startDate={startDate} endDate={endDate} />
                        </div>
                    )}
                </div>
            )}

            {/* ── Overview Stats ──────────────────────────────────── */}
            <div>
                <SectionHeader
                    title={isStaffMode ? 'Aggregate — Selected Staff' : 'Overview'}
                    description={loading ? undefined : `${s?.workingDaysInRange} working days · ${s?.totalActiveStaff} ${isStaffMode ? 'selected staff' : 'active staff'}`}
                />
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
                    {loading ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="col-span-2"><SkeletonCard /></div>) : (
                        <>
                            <div className="col-span-2"><StatCard icon={Users} label="Active Staff" value={s?.totalActiveStaff ?? 0} sub="Non-archived employees" color="blue" /></div>
                            <div className="col-span-2"><StatCard icon={CheckCircle2} label="Attendance Rate" value={`${s?.attendanceRate ?? 0}%`} sub="Days clocked in vs expected" color="green" /></div>
                            <div className="col-span-2"><StatCard icon={Target} label="On-Time Rate" value={`${s?.onTimeRate ?? 0}%`} sub="Within shift start + grace" color="green" /></div>
                            <div className="col-span-2"><StatCard icon={XCircle} label="Absent Rate" value={`${s?.absentRate ?? 0}%`} sub="Unexcused absences" color="primary" /></div>
                            <div className="col-span-2"><StatCard icon={Clock} label="Avg Work Hours" value={`${s?.avgWorkHours ?? 0}h`} sub="Per clocked-in day" color="purple" /></div>
                            <div className="col-span-2"><StatCard icon={Coffee} label="Avg Break" value={`${s?.avgBreakMinutes ?? 0}m`} sub="Per clocked-in day" color="amber" /></div>
                            <div className="col-span-2"><StatCard icon={Home} label="WFH Rate" value={`${s?.wfhRate ?? 0}%`} sub="Of all clocked-in days" color="blue" /></div>
                            <div className="col-span-2"><StatCard icon={CalendarOff} label="Leave Days" value={s?.totalLeaveDays ?? 0} sub="Approved leave in range" color="amber" /></div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Attendance Trend + Leave Breakdown ──────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border border-border shadow-sm bg-white">
                    <CardHeader className="p-5 border-b border-border bg-muted/20">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-primary" />Attendance Trend
                                </CardTitle>
                                <CardDescription className="text-xs mt-0.5">
                                    {includeLeavesInTrend
                                        ? 'Rate includes all leave types in the calculation'
                                        : 'Rate excludes paid leave (vacation, birthday, maternity)'}
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowPendingInTrend(v => !v)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                                        showPendingInTrend
                                            ? 'bg-amber-500 text-white border-amber-500'
                                            : 'bg-white text-muted-foreground border-border hover:border-amber-400 hover:text-amber-600'
                                    }`}
                                >
                                    <span>{showPendingInTrend ? 'Pending On' : 'Pending Off'}</span>
                                </button>
                                <button
                                    onClick={() => setIncludeLeavesInTrend(v => !v)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                                        includeLeavesInTrend
                                            ? 'bg-primary text-white border-primary'
                                            : 'bg-white text-muted-foreground border-border hover:border-primary/40 hover:text-primary'
                                    }`}
                                >
                                    <span>{includeLeavesInTrend ? 'All Leaves On' : 'All Leaves Off'}</span>
                                </button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4">
                        {loading ? <SkeletonChart height={260} /> : trendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.15} />
                                            <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        tickFormatter={v => { const d = new Date(v + 'T00:00:00'); return `${d.getDate()}/${d.getMonth() + 1}` }}
                                        interval={trendData.length > 30 ? Math.floor(trendData.length / 10) : 0} />
                                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                                        formatter={(v: any) => [`${v}%`, 'Rate']}
                                        labelFormatter={l => `Date: ${l}`} />
                                    <Area type="monotone" dataKey="rate" stroke={CHART_COLORS.primary} strokeWidth={2} fill="url(#rateGrad)" dot={false} name="Attendance %" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : <div className="flex items-center justify-center h-64 text-muted-foreground text-xs">No attendance data for this period</div>}
                    </CardContent>
                </Card>

                <Card className="border border-border shadow-sm bg-white">
                    <CardHeader className="p-5 border-b border-border bg-muted/20">
                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                            <CalendarOff className="h-4 w-4 text-amber-500" />Leave by Type
                        </CardTitle>
                        <CardDescription className="text-xs">Approved leave distribution</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                        {loading ? <SkeletonChart height={200} /> : data?.leaveBreakdown?.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height={180}>
                                    <PieChart>
                                        <Pie data={data.leaveBreakdown} dataKey="days" nameKey="type" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={3}>
                                            {data.leaveBreakdown.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                                            formatter={(v: any, n: any) => [v, LEAVE_TYPE_LABELS[n] || n]} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="space-y-2 mt-2">
                                    {data.leaveBreakdown.map((l: any, i: number) => (
                                        <div key={l.type} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                                <span className="text-muted-foreground">{LEAVE_TYPE_LABELS[l.type] || l.type}</span>
                                            </div>
                                            <span className="font-semibold tabular-nums">{l.days}d ({l.count})</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : <div className="flex items-center justify-center h-48 text-muted-foreground text-xs">No leave data</div>}
                        {!loading && data?.leaveStatusBreakdown && (data.leaveStatusBreakdown.approved + data.leaveStatusBreakdown.pending + data.leaveStatusBreakdown.declined) > 0 && (
                            <div className="border-t mt-4 pt-4 space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Leave Requests</p>
                                <div className="flex gap-2 flex-wrap">
                                    <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] font-bold">✓ {data.leaveStatusBreakdown.approved} Approved</Badge>
                                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-bold">⏳ {data.leaveStatusBreakdown.pending} Pending</Badge>
                                    <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-bold">✗ {data.leaveStatusBreakdown.declined} Declined</Badge>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Department Performance ───────────────────────────── */}
            {!isStaffMode && (
                <div>
                    <SectionHeader title="Department Performance" description="Ranked by attendance rate" />
                    <Card className="border border-border shadow-sm bg-white overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/20 hover:bg-muted/20">
                                    {['Department', 'Headcount', 'Attendance', 'Late Rate', 'Avg Hours', 'Leave Days'].map(h => (
                                        <TableHead key={h} className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{h}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? <SkeletonTableRows cols={7} rows={5} /> :
                                    data?.departmentStats?.length > 0 ? data.departmentStats.map((d: any, i: number) => (
                                        <TableRow key={d.deptId} className="hover:bg-muted/30">
                                            <TableCell className="px-5 py-3">
                                                <div className="flex items-center gap-2">
                                                    {i === 0 && <Award className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                                    <span className="font-semibold text-sm">{d.dept}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-sm font-medium tabular-nums">{d.headcount}</TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={cn("text-sm font-bold tabular-nums", d.attendanceRate >= 80 ? 'text-green-600' : d.attendanceRate >= 60 ? 'text-amber-600' : 'text-red-600')}>{d.attendanceRate}%</span>
                                                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                                        <div className={cn("h-full rounded-full", d.attendanceRate >= 80 ? 'bg-green-500' : d.attendanceRate >= 60 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${d.attendanceRate}%` }} />
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-center">
                                                <span className={cn("text-sm font-medium tabular-nums", d.lateRate > 20 ? 'text-red-600' : d.lateRate > 10 ? 'text-amber-600' : 'text-muted-foreground')}>{d.lateRate}%</span>
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-center text-sm font-medium">{d.avgHours}h</TableCell>
                                            <TableCell className="px-4 py-3 text-center text-sm text-muted-foreground">{d.leaveDays}</TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-10">No department data</TableCell></TableRow>
                                }
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            )}

            {/* ── WFH Trend + Tardiness ───────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border border-border shadow-sm bg-white">
                    <CardHeader className="p-5 border-b border-border bg-muted/20">
                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-blue-500" />Office vs WFH
                        </CardTitle>
                        <CardDescription className="text-xs">Weekly breakdown of work mode</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                        {loading ? <SkeletonChart height={240} /> : data?.wfhVsOfficeTrend?.length > 0 ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={data.wfhVsOfficeTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        tickFormatter={v => { const d = new Date(v + 'T00:00:00'); return `W${d.getDate()}/${d.getMonth() + 1}` }} />
                                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                                    <Bar dataKey="office" name="Office" fill={CHART_COLORS.blue} radius={[3, 3, 0, 0]} stackId="a" />
                                    <Bar dataKey="wfh" name="WFH" fill={CHART_COLORS.emerald} radius={[3, 3, 0, 0]} stackId="a" />
                                    {data.wfhVsOfficeTrend.some((w: any) => w.other > 0) && (
                                        <Bar dataKey="other" name="Other" fill={CHART_COLORS.slate} radius={[3, 3, 0, 0]} stackId="a" />
                                    )}
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="flex items-center justify-center h-60 text-muted-foreground text-xs">No data</div>}
                    </CardContent>
                </Card>

                <Card className="border border-border shadow-sm bg-white">
                    <CardHeader className="p-5 border-b border-border bg-muted/20">
                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Timer className="h-4 w-4 text-amber-500" />Tardiness
                        </CardTitle>
                        <CardDescription className="text-xs">Clock-in lateness distribution</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                        {loading ? <SkeletonChart height={200} /> : data?.tardinessBuckets?.some((b: any) => b.count > 0) ? (
                            <div className="space-y-3 pt-2">
                                {data.tardinessBuckets.map((b: any) => {
                                    const total = data.tardinessBuckets.reduce((s: number, x: any) => s + x.count, 0)
                                    const pct = total > 0 ? Math.round((b.count / total) * 100) : 0
                                    const isOnTime = b.bucket === 'On Time'
                                    return (
                                        <div key={b.bucket}>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className={cn("font-medium", isOnTime ? 'text-green-600' : 'text-muted-foreground')}>{b.bucket}</span>
                                                <span className="font-bold tabular-nums text-foreground">{b.count} <span className="text-muted-foreground font-normal">({pct}%)</span></span>
                                            </div>
                                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                                                <div className={cn("h-full rounded-full", isOnTime ? 'bg-green-500' : b.bucket === '1–15 min' ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : <div className="flex items-center justify-center h-48 text-muted-foreground text-xs">No data</div>}
                    </CardContent>
                </Card>
            </div>

            {/* ── Staff Rankings ───────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border border-border shadow-sm bg-white overflow-hidden">
                    <CardHeader className="p-5 border-b border-border bg-muted/20">
                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />Most Absent Staff
                        </CardTitle>
                        <CardDescription className="text-xs">Top 10 by unexcused absence days</CardDescription>
                    </CardHeader>
                    <div className="divide-y divide-border">
                        {loading ? Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-3">
                                <Skeleton className="h-4 w-4" /><Skeleton className="h-8 w-8 rounded-full" />
                                <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-24" /></div>
                                <Skeleton className="h-8 w-12" />
                            </div>
                        )) : data?.topAbsentStaff?.length > 0 ? data.topAbsentStaff.map((st: any, i: number) => (
                            <div key={st.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30">
                                <span className={cn("text-xs font-black w-5 tabular-nums", i === 0 ? 'text-red-500' : 'text-muted-foreground')}>{i + 1}</span>
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                                    {st.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{st.name}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">{st.dept}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-bold text-red-600">{st.absentDays}d</p>
                                    <p className="text-[11px] text-muted-foreground">{st.attendanceRate}% att.</p>
                                </div>
                            </div>
                        )) : <div className="flex items-center justify-center py-12 text-muted-foreground text-xs">No absences recorded</div>}
                    </div>
                </Card>

                <Card className="border border-border shadow-sm bg-white overflow-hidden">
                    <CardHeader className="p-5 border-b border-border bg-muted/20">
                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-500" />Most Late Arrivals
                        </CardTitle>
                        <CardDescription className="text-xs">Top 10 by number of late clock-ins</CardDescription>
                    </CardHeader>
                    <div className="divide-y divide-border">
                        {loading ? Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-3">
                                <Skeleton className="h-4 w-4" /><Skeleton className="h-8 w-8 rounded-full" />
                                <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-24" /></div>
                                <Skeleton className="h-8 w-16" />
                            </div>
                        )) : data?.topLateStaff?.length > 0 ? data.topLateStaff.map((st: any, i: number) => (
                            <div key={st.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30">
                                <span className={cn("text-xs font-black w-5 tabular-nums", i === 0 ? 'text-amber-500' : 'text-muted-foreground')}>{i + 1}</span>
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                                    {st.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{st.name}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">{st.dept}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-bold text-amber-600">{st.lateDays}x late</p>
                                    <p className="text-[11px] text-muted-foreground">avg {st.avgTardiness}m</p>
                                </div>
                            </div>
                        )) : <div className="flex items-center justify-center py-12 text-muted-foreground text-xs">No late arrivals recorded</div>}
                    </div>
                </Card>
            </div>

            {/* ── Daily Breakdown ──────────────────────────────────── */}
            {!loading && data?.attendanceTrend?.length > 0 && (
                <div>
                    <SectionHeader title="Daily Attendance Breakdown" description="Present vs On Leave vs Absent (absolute counts)" />
                    <Card className="border border-border shadow-sm bg-white">
                        <CardContent className="p-4">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={data.attendanceTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        tickFormatter={v => { const d = new Date(v + 'T00:00:00'); return `${d.getDate()}/${d.getMonth() + 1}` }}
                                        interval={data.attendanceTrend.length > 30 ? Math.floor(data.attendanceTrend.length / 10) : 0} />
                                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                                    <Bar dataKey="present" name="Present" fill={CHART_COLORS.green} radius={[2, 2, 0, 0]} stackId="b" />
                                    <Bar dataKey="onLeave" name="On Leave" fill={CHART_COLORS.amber} radius={[2, 2, 0, 0]} stackId="b" />
                                    <Bar dataKey="absent" name="Absent" fill={CHART_COLORS.primary} radius={[2, 2, 0, 0]} stackId="b" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
