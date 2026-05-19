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
    Users, Clock, CalendarOff, TrendingUp, TrendingDown, Download,
    Loader2, Building2, MapPin, Timer, Coffee, AlertTriangle,
    CheckCircle2, XCircle, Activity, Home, Briefcase,
    Target, Award, Zap, RefreshCcw, Search, ChevronDown,
    ChevronUp, UserCircle, X
} from "lucide-react"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'
import { format, subDays, startOfYear, subMonths } from "date-fns"
import * as XLSX from 'xlsx'
import { cn } from "@/lib/utils"

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

const STATUS_DAY_COLOR: Record<string, string> = {
    PRESENT: 'bg-green-500',
    LATE: 'bg-amber-400',
    ABSENT: 'bg-red-400',
    LEAVE: 'bg-blue-400',
    HALF_DAY: 'bg-purple-400',
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

// ── Stat card ─────────────────────────────────────────────────────
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

// ── Staff KPI card ─────────────────────────────────────────────────
function StaffKPICard({ staff, loading }: { staff: any; loading: boolean }) {
    const [expanded, setExpanded] = useState(false)

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

                {/* Bottom pills */}
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

                {/* Daily dot calendar (toggle) */}
                {staff.dailyTrend?.length > 0 && (
                    <>
                        <button
                            onClick={() => setExpanded(v => !v)}
                            className="w-full flex items-center justify-between px-5 py-2.5 border-t border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted/30 transition-colors"
                        >
                            Daily Attendance Calendar
                            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                        {expanded && (
                            <div className="px-5 py-4 border-t border-border">
                                {/* Legend */}
                                <div className="flex flex-wrap gap-3 mb-3">
                                    {[['PRESENT', 'bg-green-500', 'Present'], ['LATE', 'bg-amber-400', 'Late'], ['ABSENT', 'bg-red-400', 'Absent'], ['LEAVE', 'bg-blue-400', 'Leave']].map(([s, c, l]) => (
                                        <div key={s} className="flex items-center gap-1.5">
                                            <div className={cn("h-2.5 w-2.5 rounded-sm", c)} />
                                            <span className="text-[10px] text-muted-foreground">{l}</span>
                                        </div>
                                    ))}
                                </div>
                                {/* Dots grid */}
                                <div className="flex flex-wrap gap-1">
                                    {staff.dailyTrend.map((day: any) => (
                                        <div
                                            key={day.date}
                                            title={`${day.date} — ${day.status}${day.tardiness > 0 ? ` (${day.tardiness}m late)` : ''}${day.workMin > 0 ? ` · ${Math.round(day.workMin / 60 * 10) / 10}h` : ''}`}
                                            className={cn("h-4 w-4 rounded-sm transition-opacity hover:opacity-70 cursor-default", STATUS_DAY_COLOR[day.status] || 'bg-slate-200')}
                                        />
                                    ))}
                                </div>
                                {/* Mini hours chart */}
                                {staff.dailyTrend.some((d: any) => d.workMin > 0) && (
                                    <div className="mt-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Daily Work Hours</p>
                                        <ResponsiveContainer width="100%" height={100}>
                                            <AreaChart data={staff.dailyTrend} margin={{ top: 2, right: 0, left: -30, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id={`grad-${staff.id}`} x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <XAxis dataKey="date" hide />
                                                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={v => `${Math.round(v / 60)}h`} />
                                                <Tooltip
                                                    contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}
                                                    formatter={(v: any) => [`${Math.round((v / 60) * 10) / 10}h`, 'Hours']}
                                                    labelFormatter={l => l}
                                                />
                                                <Area type="monotone" dataKey="workMin" stroke={CHART_COLORS.primary} strokeWidth={1.5} fill={`url(#grad-${staff.id})`} dot={false} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}

// ── Main page ─────────────────────────────────────────────────────
export default function KPIPage() {
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

    // Persist filters to localStorage
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

    const fetchKPI = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true)
        else setLoading(true)
        try {
            const params = new URLSearchParams({ startDate, endDate, location: selectedLocation })
            if (selectedStaffIds.length > 0) {
                params.set('staffIds', selectedStaffIds.join(','))
            } else if (selectedDeptIds.length > 0) {
                params.set('departmentIds', selectedDeptIds.join(','))
            }
            const res = await fetch(`/api/admin/kpi?${params}`)
            if (res.ok) setData(await res.json())
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [startDate, endDate, selectedDeptIds, selectedLocation, selectedStaffIds])

    useEffect(() => { fetchKPI() }, [fetchKPI])

    const applyPreset = (preset: typeof PRESETS[0]) => {
        const { start, end } = preset.getValue()
        setActivePreset(preset.label)
        setStartDate(start)
        setEndDate(end)
    }
    const handleCustomDate = (field: 'start' | 'end', val: string) => {
        setActivePreset('Custom')
        if (field === 'start') setStartDate(val)
        else setEndDate(val)
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
            // Respect active dept filter
            if (selectedDeptIds.length > 0 && !selectedDeptIds.includes(s.departmentId)) return false
            return s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) ||
                s.department?.name?.toLowerCase().includes(q)
        })
    }, [allStaff, staffSearch, selectedDeptIds])

    const selectedStaffNames = useMemo(() =>
        allStaff.filter(s => selectedStaffIds.includes(s.id)).map(s => s.name)
    , [allStaff, selectedStaffIds])

    const exportToExcel = () => {
        if (!data) return
        const wb = XLSX.utils.book_new()
        const summaryRows = [
            ['KPI Report', `${startDate} to ${endDate}`], [''],
            ['Metric', 'Value'],
            ['Total Active Staff', data.summary.totalActiveStaff],
            ['Attendance Rate (%)', data.summary.attendanceRate],
            ['On-Time Rate (%)', data.summary.onTimeRate],
            ['Absent Rate (%)', data.summary.absentRate],
            ['WFH Rate (%)', data.summary.wfhRate],
            ['Avg Work Hours / Day', data.summary.avgWorkHours],
            ['Avg Break (min)', data.summary.avgBreakMinutes],
            ['Total Leave Days', data.summary.totalLeaveDays],
            ['Working Days in Range', data.summary.workingDaysInRange],
        ]
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary')
        if (data.attendanceTrend?.length) {
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
                ['Date', 'Present', 'On Leave', 'Absent', 'Rate (%)'],
                ...data.attendanceTrend.map((r: any) => [r.date, r.present, r.onLeave, r.absent, r.rate])
            ]), 'Attendance Trend')
        }
        if (data.departmentStats?.length) {
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
                ['Department', 'Headcount', 'Attendance Rate (%)', 'Late Rate (%)', 'Avg Hours', 'Leave Days', 'WFH Rate (%)'],
                ...data.departmentStats.map((d: any) => [d.dept, d.headcount, d.attendanceRate, d.lateRate, d.avgHours, d.leaveDays, d.wfhRate])
            ]), 'Department Stats')
        }
        if (data.staffKPI?.length) {
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
                ['Name', 'Department', 'Location', 'Expected Days', 'Present Days', 'Absent Days', 'Leave Days', 'Late Days', 'WFH Days', 'Attendance Rate (%)', 'On-Time Rate (%)', 'Avg Hours', 'Avg Break (min)', 'Avg Tardiness (min)'],
                ...data.staffKPI.map((s: any) => [s.name, s.dept, s.location, s.expectedDays, s.presentDays, s.absentDays, s.leaveDays, s.lateDays, s.wfhDays, s.attendanceRate, s.onTimeRate, s.avgWorkHours, s.avgBreakMinutes, s.avgTardiness])
            ]), 'Staff KPI')
        }
        if (data.topAbsentStaff?.length) {
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
                ['Name', 'Department', 'Absent Days', 'Attendance Rate (%)'],
                ...data.topAbsentStaff.map((s: any) => [s.name, s.dept, s.absentDays, s.attendanceRate])
            ]), 'Top Absent')
        }
        if (data.topLateStaff?.length) {
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
                ['Name', 'Department', 'Late Days', 'Avg Tardiness (min)'],
                ...data.topLateStaff.map((s: any) => [s.name, s.dept, s.lateDays, s.avgTardiness])
            ]), 'Top Late')
        }
        XLSX.writeFile(wb, `KPI_Report_${startDate}_${endDate}.xlsx`)
    }

    const s = data?.summary
    const isStaffMode = selectedStaffIds.length > 0

    return (
        <div className="w-full mx-auto space-y-8 animate-in fade-in duration-300 pb-12 px-4 lg:px-8">

            {/* ── Header (always visible) ─────────────────────── */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">KPI Dashboard</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {loading ? 'Loading metrics…' : `${s?.workingDaysInRange ?? 0} working days · ${s?.totalActiveStaff ?? 0} ${isStaffMode ? 'selected staff' : 'active staff'}`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => fetchKPI(true)} disabled={refreshing || loading} className="h-9 gap-1.5 text-xs font-semibold">
                            <RefreshCcw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button onClick={exportToExcel} disabled={loading || !data} size="sm" className="h-9 gap-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-semibold">
                            <Download className="h-3.5 w-3.5" />
                            Export Excel
                        </Button>
                    </div>
                </div>

                {/* ── Filter bar (always visible) ─────────────── */}
                <Card className="border border-border shadow-sm bg-white">
                    <CardContent className="p-4 flex flex-col gap-4">
                        {/* Presets */}
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
                            {/* Custom dates */}
                            <div className="flex items-center gap-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">From</Label>
                                <Input type="date" value={startDate} onChange={e => handleCustomDate('start', e.target.value)} className="h-8 text-xs w-36" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">To</Label>
                                <Input type="date" value={endDate} onChange={e => handleCustomDate('end', e.target.value)} className="h-8 text-xs w-36" />
                            </div>

                            {/* Dept multi-select — disabled in staff mode */}
                            <Popover open={deptPopoverOpen} onOpenChange={setDeptPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" disabled={isStaffMode} className={cn(
                                        "h-8 w-auto px-3 min-w-[160px] justify-between text-xs font-semibold border-border bg-white hover:bg-slate-50",
                                        selectedDeptIds.length > 0 && "border-primary text-primary"
                                    )}>
                                        <span className="flex items-center gap-1.5 truncate max-w-[130px]">
                                            <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                            {selectedDeptIds.length === 0
                                                ? 'All Departments'
                                                : selectedDeptIds.length === 1
                                                    ? departments.find(d => d.id === selectedDeptIds[0])?.name
                                                    : `${selectedDeptIds.length} departments`}
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
                                        {filteredDeptDropdown.length === 0
                                            ? <p className="text-xs text-muted-foreground text-center py-4">No departments found</p>
                                            : filteredDeptDropdown.map(dept => (
                                                <div key={dept.id} className="flex items-center gap-2.5 p-2 hover:bg-muted rounded-md cursor-pointer" onClick={() => toggleDept(dept.id)}>
                                                    <Checkbox checked={selectedDeptIds.includes(dept.id)} />
                                                    <span className="text-xs font-medium truncate">{dept.name}</span>
                                                </div>
                                            ))
                                        }
                                    </div>
                                    {selectedDeptIds.length > 0 && (
                                        <div className="p-2 border-t border-border">
                                            <button onClick={clearDepts} className="w-full text-[10px] text-primary font-bold hover:underline py-1">
                                                Clear selection ({selectedDeptIds.length})
                                            </button>
                                        </div>
                                    )}
                                </PopoverContent>
                            </Popover>

                            {/* Location — disabled in staff mode */}
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

                            {/* Staff selector */}
                            <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn(
                                        "h-8 w-auto px-3 min-w-[160px] justify-between text-xs font-semibold border-border bg-white hover:bg-slate-50",
                                        selectedStaffIds.length > 0 && "border-primary text-primary"
                                    )}>
                                        <span className="flex items-center gap-1.5 truncate max-w-[120px]">
                                            <UserCircle className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                            {selectedStaffIds.length === 0
                                                ? 'All Staff'
                                                : selectedStaffIds.length === 1
                                                    ? selectedStaffNames[0]
                                                    : `${selectedStaffIds.length} staff selected`}
                                        </span>
                                        <ChevronDown className="h-3 w-3 ml-2 opacity-50 shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-0" align="start">
                                    <div className="p-3 border-b border-border">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Filter by Staff</p>
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                            <Input
                                                placeholder="Search staff…"
                                                value={staffSearch}
                                                onChange={e => setStaffSearch(e.target.value)}
                                                className="h-8 pl-8 text-xs"
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto p-2">
                                        {filteredStaffDropdown.length === 0 ? (
                                            <p className="text-xs text-muted-foreground text-center py-4">No staff found</p>
                                        ) : filteredStaffDropdown.map(emp => (
                                            <div key={emp.id}
                                                className="flex items-center gap-2.5 p-2 hover:bg-muted rounded-md cursor-pointer"
                                                onClick={() => toggleStaff(emp.id)}>
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
                                            <button onClick={clearStaff} className="w-full text-[10px] text-primary font-bold hover:underline py-1">
                                                Clear selection ({selectedStaffIds.length})
                                            </button>
                                        </div>
                                    )}
                                </PopoverContent>
                            </Popover>

                            {/* Selected staff chips */}
                            {selectedStaffIds.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedStaffNames.slice(0, 3).map((name, i) => (
                                        <span key={i} className="flex items-center gap-1 h-6 px-2 rounded-full bg-primary/10 text-primary text-[10px] font-semibold border border-primary/20">
                                            {name}
                                            <button onClick={() => toggleStaff(selectedStaffIds[i])} className="hover:opacity-70">
                                                <X className="h-2.5 w-2.5" />
                                            </button>
                                        </span>
                                    ))}
                                    {selectedStaffIds.length > 3 && (
                                        <span className="h-6 px-2 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold flex items-center">
                                            +{selectedStaffIds.length - 3} more
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Staff Assessment (shown when staff selected) ─── */}
            {isStaffMode && (
                <div>
                    <SectionHeader
                        title="Staff Assessment"
                        description={`Individual KPI breakdown for ${selectedStaffIds.length} selected staff member${selectedStaffIds.length > 1 ? 's' : ''}`}
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
                                        <TableHead className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Staff</TableHead>
                                        <TableHead className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Attendance</TableHead>
                                        <TableHead className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">On Time</TableHead>
                                        <TableHead className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Avg Hours</TableHead>
                                        <TableHead className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Absent</TableHead>
                                        <TableHead className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Late</TableHead>
                                        <TableHead className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Leave</TableHead>
                                        <TableHead className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">WFH</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading
                                        ? <SkeletonTableRows cols={8} rows={selectedStaffIds.length} />
                                        : data?.staffKPI?.map((st: any) => (
                                            <TableRow key={st.id} className="hover:bg-muted/30">
                                                <TableCell className="px-5 py-3">
                                                    <div>
                                                        <p className="font-semibold text-sm">{st.name}</p>
                                                        <p className="text-[11px] text-muted-foreground">{st.dept}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-center">
                                                    <span className={cn("font-bold text-sm", st.attendanceRate >= 80 ? 'text-green-600' : st.attendanceRate >= 60 ? 'text-amber-600' : 'text-red-600')}>
                                                        {st.attendanceRate}%
                                                    </span>
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-center">
                                                    <span className={cn("font-bold text-sm", st.onTimeRate >= 80 ? 'text-green-600' : st.onTimeRate >= 60 ? 'text-amber-600' : 'text-red-600')}>
                                                        {st.onTimeRate}%
                                                    </span>
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
                                                <TableCell className="px-4 py-3 text-center text-sm text-muted-foreground">{st.leaveDays}d</TableCell>
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
                </div>
            )}

            {/* ── Overview stat cards ─────────────────────────── */}
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

            {/* ── Attendance Trend + Leave Breakdown ─────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border border-border shadow-sm bg-white">
                    <CardHeader className="p-5 border-b border-border bg-muted/20">
                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />Attendance Trend
                        </CardTitle>
                        <CardDescription className="text-xs">Daily attendance rate over the selected period</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                        {loading ? <SkeletonChart height={260} /> : data?.attendanceTrend?.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={data.attendanceTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.15} />
                                            <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        tickFormatter={v => { const d = new Date(v + 'T00:00:00'); return `${d.getDate()}/${d.getMonth() + 1}` }}
                                        interval={data.attendanceTrend.length > 30 ? Math.floor(data.attendanceTrend.length / 10) : 0} />
                                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0/.1)' }}
                                        formatter={(v: any) => [`${v}%`, 'Rate']} labelFormatter={l => `Date: ${l}`} />
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

            {/* ── Department Performance ──────────────────────── */}
            {!isStaffMode && (
                <div>
                    <SectionHeader title="Department Performance" description="Ranked by attendance rate" />
                    <Card className="border border-border shadow-sm bg-white overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/20 hover:bg-muted/20">
                                    {['Department', 'Headcount', 'Attendance', 'Late Rate', 'Avg Hours', 'Leave Days', 'WFH Rate'].map(h => (
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
                                            <TableCell className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Home className="h-3 w-3 text-blue-400" />
                                                    <span className="text-sm tabular-nums">{d.wfhRate}%</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-xs py-10">No department data</TableCell></TableRow>
                                }
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            )}

            {/* ── WFH Trend + Tardiness ───────────────────────── */}
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

            {/* ── Peak Clock-In + Location ────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border border-border shadow-sm bg-white">
                    <CardHeader className="p-5 border-b border-border bg-muted/20">
                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Zap className="h-4 w-4 text-amber-500" />Peak Clock-In Hours
                        </CardTitle>
                        <CardDescription className="text-xs">When staff typically clock in (06:00–17:00)</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                        {loading ? <SkeletonChart height={220} /> : data?.peakClockInHour?.some((h: any) => h.count > 0) ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={data.peakClockInHour} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                                    <Bar dataKey="count" name="Clock-Ins" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="flex items-center justify-center h-56 text-muted-foreground text-xs">No data</div>}
                    </CardContent>
                </Card>

                <Card className="border border-border shadow-sm bg-white">
                    <CardHeader className="p-5 border-b border-border bg-muted/20">
                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />By Employment Location
                        </CardTitle>
                        <CardDescription className="text-xs">Headcount and attendance rate per region</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        {loading ? <SkeletonChart height={150} /> : data?.locationBreakdown?.length > 0 ? data.locationBreakdown.map((loc: any, i: number) => (
                            <div key={loc.location} className="space-y-1.5">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                        <span className="font-semibold text-foreground">{loc.location}</span>
                                        <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0">{loc.count} staff</Badge>
                                    </div>
                                    <span className={cn("font-bold", loc.attendanceRate >= 80 ? 'text-green-600' : loc.attendanceRate >= 60 ? 'text-amber-600' : 'text-red-600')}>
                                        {loc.attendanceRate}%
                                    </span>
                                </div>
                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${loc.attendanceRate}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                </div>
                            </div>
                        )) : <div className="flex items-center justify-center h-48 text-muted-foreground text-xs">No data</div>}
                    </CardContent>
                </Card>
            </div>

            {/* ── Staff Rankings ──────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border border-border shadow-sm bg-white overflow-hidden">
                    <CardHeader className="p-5 border-b border-border bg-muted/20">
                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />Most Absent Staff
                        </CardTitle>
                        <CardDescription className="text-xs">Top 10 by unexcused absence days</CardDescription>
                    </CardHeader>
                    <div className="divide-y divide-border">
                        {loading
                            ? Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3 px-5 py-3">
                                    <Skeleton className="h-4 w-4" /><Skeleton className="h-8 w-8 rounded-full" />
                                    <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-24" /></div>
                                    <Skeleton className="h-8 w-12" />
                                </div>
                            ))
                            : data?.topAbsentStaff?.length > 0 ? data.topAbsentStaff.map((st: any, i: number) => (
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
                            )) : <div className="flex items-center justify-center py-12 text-muted-foreground text-xs">No absences recorded</div>
                        }
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
                        {loading
                            ? Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3 px-5 py-3">
                                    <Skeleton className="h-4 w-4" /><Skeleton className="h-8 w-8 rounded-full" />
                                    <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-24" /></div>
                                    <Skeleton className="h-8 w-16" />
                                </div>
                            ))
                            : data?.topLateStaff?.length > 0 ? data.topLateStaff.map((st: any, i: number) => (
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
                            )) : <div className="flex items-center justify-center py-12 text-muted-foreground text-xs">No late arrivals recorded</div>
                        }
                    </div>
                </Card>
            </div>

            {/* ── Daily Breakdown Chart ───────────────────────── */}
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
