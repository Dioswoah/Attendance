"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Search,
    Calendar as CalendarIcon,
    Filter,
    Download,
    RefreshCcw,
    LayoutGrid,
    FileText,
    Users,
    Clock,
    MapPin,
    ArrowRight,
    Loader2,
    Flame,
    Zap,
    ShieldCheck,
    TrendingUp
} from "lucide-react"
import { format, eachDayOfInterval, parseISO, isSameDay } from "date-fns"
import * as XLSX from 'xlsx'
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export default function HistoryPage() {
    const [activeTab, setActiveTab] = useState<'matrix' | 'daily' | 'summary'>('matrix')
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [history, setHistory] = useState<any[]>([])
    const [departments, setDepartments] = useState<any[]>([])

    // Filters
    const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [selectedDept, setSelectedDept] = useState("all")
    const [searchTerm, setSearchTerm] = useState("")

    useEffect(() => {
        fetchInitialData()
    }, [])

    const fetchInitialData = async () => {
        setLoading(true)
        try {
            const [deptRes, attRes] = await Promise.all([
                fetch('/api/departments'),
                fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}&departmentId=${selectedDept}`)
            ])
            if (deptRes.ok) setDepartments(await deptRes.json())
            if (attRes.ok) setHistory(await attRes.json())
        } catch (error) {
            console.error("Fetch history error:", error)
        } finally {
            setLoading(false)
        }
    }

    const refreshData = async () => {
        setRefreshing(true)
        try {
            const res = await fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}&departmentId=${selectedDept}`)
            if (res.ok) setHistory(await res.json())
        } finally {
            setRefreshing(false)
        }
    }

    const setQuickRange = (range: 'today' | '7days' | '30days' | 'month') => {
        const end = new Date()
        const start = new Date()

        if (range === '7days') start.setDate(end.getDate() - 7)
        else if (range === '30days') start.setDate(end.getDate() - 30)
        else if (range === 'month') start.setDate(1)

        setStartDate(format(start, "yyyy-MM-dd"))
        setEndDate(format(end, "yyyy-MM-dd"))
    }

    // Matrix Transformation
    const dateRange = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate)
    })

    const employees = Array.from(new Set(history.map(h => h.userId))).map(id => {
        const record = history.find(h => h.userId === id)
        return {
            id,
            name: record.userName,
            dept: record.department
        }
    }).filter(emp => emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.dept.toLowerCase().includes(searchTerm.toLowerCase()))

    const handleExport = () => {
        const ws = XLSX.utils.json_to_sheet(history.map(r => ({
            Date: r.date,
            Employee: r.userName,
            Dept: r.department,
            In: r.clockIn ? format(parseISO(r.clockIn), "HH:mm") : '-',
            Out: r.clockOut ? format(parseISO(r.clockOut), "HH:mm") : '-',
            Status: r.status,
            Mode: r.mode
        })))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Attendance History")
        XLSX.writeFile(wb, `REDADAIR_HISTORY_${startDate}_${endDate}.xlsx`)
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="h-10 w-10 rounded-xl bg-red-600 flex items-center justify-center animate-pulse shadow-lg">
                    <Flame className="h-5 w-5 text-white fill-white" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading History terminal...</p>
            </div>
        )
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase leading-none">Attendance History</h1>
                    <p className="text-red-600 font-bold uppercase tracking-[0.2em] text-[10px] ml-1">Historical Audit & Temporal Analytics</p>
                </div>
                <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                    <ShieldCheck className="h-4 w-4 text-red-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verified Attendance Records</span>
                </div>
            </div>

            {/* Filters Card */}
            <Card className="border-none shadow-sm rounded-[2rem] bg-white border border-slate-100 p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Temporal Start</Label>
                        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold text-[10px] uppercase italic text-slate-700" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">End Date</Label>
                        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold text-[10px] uppercase italic text-slate-700" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Department</Label>
                        <Select value={selectedDept} onValueChange={setSelectedDept}>
                            <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold text-[10px] text-slate-600 italic px-5 uppercase tracking-widest">
                                <SelectValue placeholder="All Nodes" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-100">
                                <SelectItem value="all" className="font-bold uppercase italic text-[9px]">Global Overlook</SelectItem>
                                {departments.map(d => (
                                    <SelectItem key={d.id} value={d.id} className="font-bold uppercase italic text-[9px]">{d.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mt-8 pt-6 border-t border-slate-50">
                    <div className="flex flex-wrap gap-2">
                        {['7days', '30days', 'month'].map(r => (
                            <Button
                                key={r}
                                onClick={() => setQuickRange(r as any)}
                                variant="ghost"
                                className="h-9 px-4 rounded-lg bg-slate-50 text-[9px] font-black uppercase tracking-widest italic text-slate-400 hover:bg-slate-900 hover:text-white transition-all"
                            >
                                {r === '7days' ? 'Last 7 Cycles' : r === '30days' ? 'Last 30 Cycles' : 'Current Term'}
                            </Button>
                        ))}
                    </div>
                    <div className="flex gap-3">
                        <Button onClick={refreshData} disabled={refreshing} variant="outline" className="h-12 px-6 border-slate-100 bg-white text-slate-900 font-black rounded-xl gap-2 active:scale-95 italic uppercase tracking-widest">
                            <RefreshCcw className={`h-3.5 w-3.5 text-red-600 ${refreshing ? 'animate-spin' : ''}`} />
                            <span className="text-[9px]">Refresh Data</span>
                        </Button>
                        <Button onClick={handleExport} className="h-12 px-6 bg-slate-900 hover:bg-black text-white font-black rounded-xl gap-2 shadow-lg transition-all active:scale-95 italic uppercase tracking-widest">
                            <Download className="h-3.5 w-3.5 text-red-600" />
                            <span className="text-[9px]">Export Ledger</span>
                        </Button>
                    </div>
                </div>
            </Card>

            {/* View Selection Tabs */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                {[
                    { id: 'matrix', label: 'Attendance Matrix', icon: LayoutGrid },
                    { id: 'daily', label: 'Event Log', icon: FileText },
                    { id: 'summary', label: 'Performance Summary', icon: Users },
                ].map(tab => (
                    <Button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        variant="ghost"
                        className={`h-10 px-6 rounded-lg font-black uppercase italic tracking-widest gap-2 transition-all ${activeTab === tab.id
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <tab.icon className={cn("h-3.5 w-3.5", activeTab === tab.id ? "text-red-600" : "text-slate-300")} />
                        <span className="text-[9px]">{tab.label}</span>
                    </Button>
                ))}
            </div>

            {/* Main Content View */}
            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white border border-slate-100">
                <CardContent className="p-0">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                        <div className="relative max-w-md w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                            <Input
                                placeholder="Search identity or department..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-12 h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic transition-all focus:bg-white"
                            />
                        </div>
                        <div className="text-right hidden md:block">
                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Period Scope</p>
                            <p className="text-[10px] font-black text-slate-500 italic uppercase flex items-center gap-2">
                                {format(parseISO(startDate), "dd MMM")}
                                <ArrowRight className="h-2.5 w-2.5 opacity-20" />
                                {format(parseISO(endDate), "dd MMM yyyy")}
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto min-h-[400px]">
                        {activeTab === 'matrix' ? (
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="hover:bg-transparent border-slate-100">
                                        <TableHead className="py-4 px-8 font-black text-slate-400 uppercase text-[8px] tracking-widest sticky left-0 bg-slate-50 z-10">Personnel Identity</TableHead>
                                        <TableHead className="py-4 px-8 font-black text-slate-400 uppercase text-[8px] tracking-widest">Architecture</TableHead>
                                        {dateRange.map(date => (
                                            <TableHead key={date.toISOString()} className="py-4 px-4 text-center font-black text-slate-800 uppercase text-[8px] tracking-widest">
                                                {format(date, "dd MMM")}
                                            </TableHead>
                                        ))}
                                        <TableHead className="py-4 px-8 text-right font-black text-slate-900 uppercase text-[8px] tracking-widest">Efficiency</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {employees.map(emp => (
                                        <TableRow key={emp.id} className="border-slate-50 hover:bg-slate-50/30 transition-all group">
                                            <TableCell className="py-4 px-8 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-b border-slate-50 font-black text-slate-800 uppercase italic text-[10px] transition-colors leading-none">
                                                {emp.name}
                                            </TableCell>
                                            <TableCell className="py-4 px-8 font-bold text-slate-400 uppercase text-[9px] tracking-tighter">
                                                {emp.dept}
                                            </TableCell>
                                            {dateRange.map(date => {
                                                const record = history.find(h => h.userId === emp.id && h.date === format(date, "yyyy-MM-dd"))
                                                return (
                                                    <TableCell key={date.toISOString()} className="py-4 px-2 text-center">
                                                        {record ? (
                                                            <div className="flex flex-col items-center gap-1 group/mark">
                                                                <div className={`h-1.5 w-1.5 rounded-full ${record.status === 'clocked-in' ? 'bg-red-600' :
                                                                    record.status === 'on-break' ? 'bg-yellow-500' :
                                                                        'bg-slate-200'
                                                                    }`} />
                                                                <span className="text-[8px] font-bold italic text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {record.clockIn ? format(parseISO(record.clockIn), "HH:mm") : '--'}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="h-1 w-1 bg-slate-50 rounded-full mx-auto opacity-20" />
                                                        )}
                                                    </TableCell>
                                                )
                                            })}
                                            <TableCell className="py-4 px-8 text-right">
                                                <div className="flex flex-col items-end leading-none">
                                                    <span className="text-[10px] font-black text-slate-900 italic">
                                                        {Math.round((history.filter(h => h.userId === emp.id).length / dateRange.length) * 100)}%
                                                    </span>
                                                    <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest mt-0.5">Coverage</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {employees.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={dateRange.length + 3} className="py-32 text-center">
                                                <div className="flex flex-col items-center gap-3 opacity-20">
                                                    <Zap className="h-10 w-10 text-slate-900" />
                                                    <p className="text-[9px] font-black uppercase tracking-widest italic leading-tight">No records detected in temporal segment</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        ) : activeTab === 'daily' ? (
                            <div className="divide-y divide-slate-50">
                                {history.slice(0, 50).map((rec, i) => (
                                    <div key={rec.id || i} className="flex items-center justify-between p-5 hover:bg-slate-50/50 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center text-red-600 font-black italic shadow-sm text-xs border border-slate-100">
                                                {rec.userName?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 uppercase italic text-[11px] leading-tight">{rec.userName}</p>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{rec.department} • {format(parseISO(rec.date), "dd MMM yyyy")}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-slate-800 italic uppercase">
                                                    {rec.clockIn ? format(parseISO(rec.clockIn), "HH:mm") : '---'}
                                                    <ArrowRight className="inline h-2 w-2 mx-1.5 opacity-20" />
                                                    {rec.clockOut ? format(parseISO(rec.clockOut), "HH:mm") : '---'}
                                                </p>
                                                <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest mt-1">Operational Window</p>
                                            </div>
                                            <Badge variant="outline" className={`px-2 py-0 border-none rounded-md text-[8px] font-black uppercase tracking-widest ${rec.status === 'clocked-in' ? 'bg-red-50 text-red-600' :
                                                rec.status === 'on-break' ? 'bg-yellow-50 text-yellow-700' : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                {rec.status.replace('-', ' ')}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {employees.map(emp => {
                                    const empRecs = history.filter(h => h.userId === emp.id)
                                    const presence = Math.round((empRecs.length / dateRange.length) * 100)
                                    return (
                                        <Card key={emp.id} className="border-none shadow-sm rounded-2xl bg-slate-50/50 p-6 flex flex-col gap-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 font-black italic text-[10px] shadow-sm">
                                                        {emp.name.charAt(0)}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-black text-slate-800 uppercase italic text-[10px] leading-tight truncate">{emp.name}</span>
                                                        <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest truncate">{emp.dept}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[12px] font-black italic text-red-600">{presence}%</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-[7px] font-black text-slate-400 uppercase tracking-widest">
                                                    <span>Attendance Logic</span>
                                                    <span>{empRecs.length}/{dateRange.length} Cycles</span>
                                                </div>
                                                <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                                                    <div className="h-full bg-red-600 rounded-full" style={{ width: `${presence}%` }} />
                                                </div>
                                            </div>
                                        </Card>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Legend / Metrics Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Operational Session', color: 'bg-red-600' },
                    { label: 'Idle / Session Pause', color: 'bg-yellow-500' },
                    { label: 'Session Conclusion', color: 'bg-slate-300' },
                    { label: 'No Active Trace', color: 'bg-slate-100 opacity-30 shadow-inner' },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl border border-slate-100 shadow-sm">
                        <div className={`h-2 w-2 rounded-full ${item.color}`} />
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 leading-none">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
