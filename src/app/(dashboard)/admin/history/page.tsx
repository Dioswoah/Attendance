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
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Attendance History</h1>
                    <p className="text-muted-foreground text-sm">Historical Audit & Temporal Analytics</p>
                </div>
                <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full border border-border">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Verified Attendance Records</span>
                </div>
            </div>

            {/* Filters Card */}
            <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Department</Label>
                            <Select value={selectedDept} onValueChange={setSelectedDept}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Nodes" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Departments</SelectItem>
                                    {departments.map(d => (
                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
                        <div className="flex flex-wrap gap-2">
                            {['7days', '30days', 'month'].map(r => (
                                <Button
                                    key={r}
                                    onClick={() => setQuickRange(r as any)}
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs font-medium"
                                >
                                    {r === '7days' ? 'Last 7 Days' : r === '30days' ? 'Last 30 Days' : 'This Month'}
                                </Button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={refreshData} disabled={refreshing} variant="outline" size="sm" className="h-9">
                                <RefreshCcw className={cn("h-3.5 w-3.5 mr-2", refreshing && "animate-spin")} />
                                Refresh
                            </Button>
                            <Button onClick={handleExport} size="sm" className="h-9">
                                <Download className="h-3.5 w-3.5 mr-2" />
                                Export
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* View Selection Tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
                {[
                    { id: 'matrix', label: 'Attendance Matrix', icon: LayoutGrid },
                    { id: 'daily', label: 'Event Log', icon: FileText },
                    { id: 'summary', label: 'Performance Summary', icon: Users },
                ].map(tab => (
                    <Button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                        className={cn(
                            "h-9 px-4 rounded-lg gap-2 transition-all font-medium text-sm",
                            activeTab === tab.id
                                ? "bg-white text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                    >
                        <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-primary" : "text-muted-foreground")} />
                        {tab.label}
                    </Button>
                ))}
            </div>

            {/* Main Content View */}
            <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                <CardContent className="p-0">
                    <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                        <div className="relative max-w-sm w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search identity or department..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 h-9"
                            />
                        </div>
                        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Period:</span>
                            <span>{format(parseISO(startDate), "MMM dd")}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                            <span>{format(parseISO(endDate), "MMM dd, yyyy")}</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto min-h-[400px]">
                        {activeTab === 'matrix' ? (
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="hover:bg-transparent border-border">
                                        <TableHead className="py-3 px-6 font-medium text-muted-foreground sticky left-0 bg-muted/50 z-10 w-[200px]">Personnel</TableHead>
                                        <TableHead className="py-3 px-6 font-medium text-muted-foreground">Department</TableHead>
                                        {dateRange.map(date => (
                                            <TableHead key={date.toISOString()} className="py-3 px-2 text-center font-medium text-muted-foreground min-w-[60px]">
                                                {format(date, "dd MMM")}
                                            </TableHead>
                                        ))}
                                        <TableHead className="py-3 px-6 text-right font-medium text-muted-foreground">Efficiency</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {employees.map(emp => (
                                        <TableRow key={emp.id} className="border-border hover:bg-muted/30 transition-colors group">
                                            <TableCell className="py-3 px-6 sticky left-0 bg-white group-hover:bg-muted/30 z-10 border-r border-border font-medium text-sm text-foreground">
                                                {emp.name}
                                            </TableCell>
                                            <TableCell className="py-3 px-6 text-sm text-muted-foreground">
                                                {emp.dept}
                                            </TableCell>
                                            {dateRange.map(date => {
                                                const record = history.find(h => h.userId === emp.id && h.date === format(date, "yyyy-MM-dd"))
                                                return (
                                                    <TableCell key={date.toISOString()} className="py-3 px-2 text-center p-0">
                                                        {record ? (
                                                            <div className="flex flex-col items-center justify-center h-full w-full py-2 group/mark">
                                                                <div className={cn(
                                                                    "h-2 w-2 rounded-full mb-1",
                                                                    record.status === 'clocked-in' ? "bg-green-500" :
                                                                        record.status === 'on-break' ? "bg-yellow-500" :
                                                                            "bg-slate-300"
                                                                )} />
                                                                <span className="text-[10px] text-muted-foreground font-medium opacity-0 group-hover/mark:opacity-100 transition-opacity absolute -mt-6 bg-popover px-1.5 py-0.5 rounded shadow-sm border border-border">
                                                                    {record.clockIn ? format(parseISO(record.clockIn), "HH:mm") : '--'}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="h-1.5 w-1.5 bg-muted rounded-full mx-auto" />
                                                        )}
                                                    </TableCell>
                                                )
                                            })}
                                            <TableCell className="py-3 px-6 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-sm font-bold text-foreground">
                                                        {Math.round((history.filter(h => h.userId === emp.id).length / dateRange.length) * 100)}%
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">Coverage</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {employees.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={dateRange.length + 3} className="py-12 text-center">
                                                <div className="flex flex-col items-center gap-2 text-muted-foreground opacity-50">
                                                    <Users className="h-8 w-8" />
                                                    <p className="text-sm font-medium">No records matching criteria</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        ) : activeTab === 'daily' ? (
                            <div className="divide-y divide-border">
                                {history.slice(0, 50).map((rec, i) => (
                                    <div key={rec.id || i} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground font-medium text-sm">
                                                {rec.userName?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm text-foreground">{rec.userName}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{rec.department} • {format(parseISO(rec.date), "MMM dd, yyyy")}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right hidden sm:block">
                                                <p className="text-sm font-medium text-foreground">
                                                    {rec.clockIn ? format(parseISO(rec.clockIn), "HH:mm") : '---'}
                                                    <span className="mx-2 text-muted-foreground">-</span>
                                                    {rec.clockOut ? format(parseISO(rec.clockOut), "HH:mm") : '---'}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">Shift Window</p>
                                            </div>
                                            <Badge variant="secondary" className={cn(
                                                "font-medium",
                                                rec.status === 'clocked-in' ? "bg-green-100 text-green-700" :
                                                    rec.status === 'on-break' ? "bg-yellow-100 text-yellow-700" :
                                                        "bg-slate-100 text-slate-700"
                                            )}>
                                                {rec.status.replace('-', ' ')}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {employees.map(emp => {
                                    const empRecs = history.filter(h => h.userId === emp.id)
                                    const presence = Math.round((empRecs.length / dateRange.length) * 100)
                                    return (
                                        <Card key={emp.id} className="shadow-sm hover:shadow-md transition-shadow">
                                            <CardContent className="p-5 flex flex-col gap-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium text-sm">
                                                            {emp.name.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-medium text-sm text-foreground truncate">{emp.name}</span>
                                                            <span className="text-xs text-muted-foreground truncate">{emp.dept}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={cn(
                                                            "text-lg font-bold",
                                                            presence >= 90 ? "text-green-600" :
                                                                presence >= 75 ? "text-yellow-600" : "text-red-600"
                                                        )}>{presence}%</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-xs text-muted-foreground">
                                                        <span>Attendance Rate</span>
                                                        <span>{empRecs.length}/{dateRange.length} Days</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                                        <div className={cn(
                                                            "h-full rounded-full",
                                                            presence >= 90 ? "bg-green-500" :
                                                                presence >= 75 ? "bg-yellow-500" : "bg-red-500"
                                                        )} style={{ width: `${presence}%` }} />
                                                    </div>
                                                </div>
                                            </CardContent>
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
                    { label: 'Present / On-Site', color: 'bg-green-500' },
                    { label: 'On Break / Paused', color: 'bg-yellow-500' },
                    { label: 'Shift Ended', color: 'bg-slate-400' },
                    { label: 'No Record', color: 'bg-slate-200' },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl border border-border shadow-sm">
                        <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                        <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
