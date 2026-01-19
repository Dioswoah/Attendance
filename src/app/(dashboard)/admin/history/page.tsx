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
    UserCircle,
    Clock,
    Check,
    ChevronDown,
    MapPin,
    ArrowRight,
    Loader2,
    Flame,
    Zap,
    ShieldCheck,
    TrendingUp,
    MoreHorizontal,
    ExternalLink,
    Clock3,
    Coffee
} from "lucide-react"
import { format, eachDayOfInterval, parseISO, isSameDay } from "date-fns"
import * as XLSX from 'xlsx'
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

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
    const [allStaff, setAllStaff] = useState<any[]>([])
    const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [staffSearchQuery, setStaffSearchQuery] = useState("")
    const [viewingStaff, setViewingStaff] = useState<any | null>(null)

    // Duration Helpers
    const calculateDurations = (recs: any[]) => {
        let workMs = 0
        let breakMs = 0
        let leaveMs = 0

        recs.forEach(r => {
            if (r.status === 'on-leave' || r.mode === 'LEAVE') {
                leaveMs += 8 * 60 * 60 * 1000 // Assume 8h for a full day leave if not specified
            } else if (r.clockIn) {
                const clockIn = new Date(r.clockIn).getTime()
                const clockOut = r.clockOut ? new Date(r.clockOut).getTime() :
                    (isSameDay(new Date(r.date), new Date()) ? new Date().getTime() : 0)

                if (clockOut > clockIn) {
                    let dayBreakMs = 0
                    r.breaks?.forEach((b: any) => {
                        const start = new Date(b.startTime).getTime()
                        const end = b.endTime ? new Date(b.endTime).getTime() :
                            (isSameDay(new Date(r.date), new Date()) ? new Date().getTime() : start)
                        dayBreakMs += Math.max(0, end - start)
                    })

                    workMs += (clockOut - clockIn) - dayBreakMs
                    breakMs += dayBreakMs
                }
            }
        })

        return {
            workLabel: formatDuration(workMs),
            breakLabel: formatDuration(breakMs),
            leaveLabel: formatDuration(leaveMs),
            workMs,
            breakMs,
            leaveMs
        }
    }

    const formatDuration = (ms: number) => {
        const totalMinutes = Math.floor(ms / (1000 * 60))
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        return `${hours}h ${minutes}m`
    }

    useEffect(() => {
        fetchInitialData()
    }, [])

    const fetchInitialData = async () => {
        setLoading(true)
        try {
            const [deptRes, attRes, staffRes] = await Promise.all([
                fetch('/api/departments'),
                fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}&departmentId=${selectedDept}`),
                fetch('/api/employees')
            ])
            if (deptRes.ok) setDepartments(await deptRes.json())
            if (attRes.ok) setHistory(await attRes.json())
            if (staffRes.ok) setAllStaff(await staffRes.json())
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

        if (range === 'today') {
            start.setHours(0, 0, 0, 0)
            end.setHours(23, 59, 59, 999)
        } else if (range === '7days') start.setDate(end.getDate() - 7)
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

    const employees = (selectedStaffIds.length > 0 || selectedDept !== 'all'
        ? allStaff
            .filter(s => (selectedStaffIds.length === 0 || selectedStaffIds.includes(s.id)))
            .filter(s => (selectedDept === 'all' || s.departmentId === selectedDept))
            .map(s => ({
                id: s.id,
                name: s.name,
                dept: s.department?.name || 'Unassigned'
            }))
        : Array.from(new Set(history.map(h => h.userId))).map(id => {
            const record = history.find(h => h.userId === id)
            return {
                id,
                name: record.userName,
                dept: record.department
            }
        })
    ).filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.dept.toLowerCase().includes(searchTerm.toLowerCase())
        return matchesSearch
    })

    const filteredStaffForDropdown = allStaff.filter(s => {
        const matchesDept = selectedDept === 'all' || s.departmentId === selectedDept
        const matchesQuery = s.name.toLowerCase().includes(staffSearchQuery.toLowerCase())
        return matchesDept && matchesQuery
    })

    const toggleStaffSelection = (id: string) => {
        setSelectedStaffIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const handleExport = () => {
        // Sort history by userName then date
        const sortedHistory = [...history].sort((a, b) => {
            if (a.userName < b.userName) return -1
            if (a.userName > b.userName) return 1
            return a.date.localeCompare(b.date)
        })

        // Sheet 1: Daily Logs
        const logData = sortedHistory.map(r => {
            const stats = calculateDurations([r])
            return {
                Employee: r.userName,
                Dept: r.department,
                Date: r.date,
                'Clock In': r.clockIn ? format(parseISO(r.clockIn), "HH:mm") : '-',
                'Clock Out': r.clockOut ? format(parseISO(r.clockOut), "HH:mm") : '-',
                'Work Hours': Number((stats.workMs / (1000 * 60 * 60)).toFixed(2)),
                'Leave Hours': Number((stats.leaveMs / (1000 * 60 * 60)).toFixed(2)),
                'Work Location': r.mode
            }
        })

        // Sheet 2: Summary (Payroll)
        const summaryData = employees.sort((a, b) => a.name.localeCompare(b.name)).map(emp => {
            const empRecs = history.filter(h => h.userId === emp.id)
            const stats = calculateDurations(empRecs)
            return {
                Employee: emp.name,
                Department: emp.dept,
                'Days Worked': empRecs.filter(r => r.clockIn).length,
                'Total Work Hours': Number((stats.workMs / (1000 * 60 * 60)).toFixed(2)),
                'Days Leave': empRecs.filter(r => r.status === 'on-leave' || r.mode === 'LEAVE').length,
                'Total Leave Hours': Number((stats.leaveMs / (1000 * 60 * 60)).toFixed(2))
            }
        })

        const wb = XLSX.utils.book_new()

        const wsLogs = XLSX.utils.json_to_sheet(logData)
        // Auto-size columns for Sheet 1
        const logCols = Object.keys(logData[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }))
        wsLogs['!cols'] = logCols
        XLSX.utils.book_append_sheet(wb, wsLogs, "Attendance Log")

        const wsSummary = XLSX.utils.json_to_sheet(summaryData)
        // Auto-size columns for Sheet 2
        const summaryCols = Object.keys(summaryData[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }))
        wsSummary['!cols'] = summaryCols
        XLSX.utils.book_append_sheet(wb, wsSummary, "Payroll Summary")

        XLSX.writeFile(wb, `REDADAIR_PAYROLL_EXPORT_${startDate}_${endDate}.xlsx`)
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="h-10 w-10 rounded-xl bg-red-600 flex items-center justify-center animate-pulse shadow-lg">
                    <Flame className="h-5 w-5 text-white fill-white" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Record terminal...</p>
            </div>
        )
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Attendance Record</h1>
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
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                            <Select value={selectedDept} onValueChange={(val) => {
                                setSelectedDept(val)
                                setSelectedStaffIds([]) // Reset staff filter when dept changes
                            }}>
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
                        <div className="space-y-2">
                            <Label>Staff Filter</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between h-10 font-normal">
                                        <div className="flex items-center gap-2 truncate">
                                            <Users className="h-4 w-4 text-muted-foreground" />
                                            {selectedStaffIds.length === 0 ? (
                                                <span className="text-muted-foreground">All Staff</span>
                                            ) : (
                                                <span>{selectedStaffIds.length} Selected</span>
                                            )}
                                        </div>
                                        <ChevronDown className="h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="start">
                                    <div className="p-2 border-b border-border">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                            <Input
                                                placeholder="Search staff..."
                                                className="pl-8 h-8 text-xs"
                                                value={staffSearchQuery}
                                                onChange={e => setStaffSearchQuery(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto p-1">
                                        {filteredStaffForDropdown.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-muted-foreground">
                                                No staff in this department
                                            </div>
                                        ) : (
                                            filteredStaffForDropdown.map(staff => (
                                                <div
                                                    key={staff.id}
                                                    className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors"
                                                    onClick={() => toggleStaffSelection(staff.id)}
                                                >
                                                    <Checkbox
                                                        id={`staff-${staff.id}`}
                                                        checked={selectedStaffIds.includes(staff.id)}
                                                        onCheckedChange={() => toggleStaffSelection(staff.id)}
                                                    />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-medium leading-none truncate">{staff.name}</span>
                                                        <span className="text-[10px] text-muted-foreground truncate">{staff.department?.name || 'No Dept'}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    {selectedStaffIds.length > 0 && (
                                        <div className="p-2 border-t border-border">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-full h-8 text-xs text-primary hover:text-primary transition-colors"
                                                onClick={() => setSelectedStaffIds([])}
                                            >
                                                Clear Selection
                                            </Button>
                                        </div>
                                    )}
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
                        <div className="flex flex-wrap gap-2">
                            {['today', '7days', '30days', 'month'].map(r => (
                                <Button
                                    key={r}
                                    onClick={() => setQuickRange(r as any)}
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs font-medium"
                                >
                                    {r === 'today' ? 'Today' : r === '7days' ? 'Last 7 Days' : r === '30days' ? 'Last 30 Days' : 'This Month'}
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

                    <div className="overflow-x-auto w-full min-h-[400px]">
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
                                        <TableHead className="py-3 px-6 text-right font-medium text-muted-foreground">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {employees.map(emp => {
                                        const empRecs = history.filter(h => h.userId === emp.id)
                                        const stats = calculateDurations(empRecs)
                                        return (
                                            <TableRow key={emp.id} className="border-border hover:bg-muted/30 transition-colors group">
                                                <TableCell
                                                    className="py-3 px-6 sticky left-0 bg-white group-hover:bg-muted/30 z-10 border-r border-border font-medium text-sm text-foreground cursor-pointer hover:text-primary"
                                                    onClick={() => setViewingStaff({ ...emp, stats, records: empRecs })}
                                                >
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
                                                                                record.status === 'on-leave' ? "bg-blue-500" :
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
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <span className="text-[10px] font-bold text-green-600">W: {stats.workLabel}</span>
                                                        <span className="text-[10px] font-bold text-yellow-600">B: {stats.breakLabel}</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
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
                                                        rec.status === 'on-leave' ? "bg-blue-100 text-blue-700" :
                                                            "bg-slate-100 text-slate-700"
                                            )}>
                                                {rec.status.replace('-', ' ')}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-0">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow className="border-border">
                                            <TableHead className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">Staff Member</TableHead>
                                            <TableHead className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">Department</TableHead>
                                            <TableHead className="py-3 px-6 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Days Worked</TableHead>
                                            <TableHead className="py-3 px-6 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Days Leave</TableHead>
                                            <TableHead className="py-3 px-6 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Work Hours</TableHead>
                                            <TableHead className="py-3 px-6 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Break Hours</TableHead>
                                            <TableHead className="py-3 px-6 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Leave Hours</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {employees.map(emp => {
                                            const empRecs = history.filter(h => h.userId === emp.id)
                                            const stats = calculateDurations(empRecs)
                                            const daysWorked = empRecs.filter(r => r.clockIn).length
                                            const daysLeave = empRecs.filter(r => r.status === 'on-leave' || r.mode === 'LEAVE').length

                                            return (
                                                <TableRow key={emp.id} className="border-border hover:bg-muted/30 cursor-pointer group" onClick={() => setViewingStaff({ ...emp, stats, records: empRecs })}>
                                                    <TableCell className="py-4 px-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium border border-border">
                                                                {emp.name.charAt(0)}
                                                            </div>
                                                            <span className="font-semibold text-sm">{emp.name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-4 px-6 text-sm font-medium text-muted-foreground">{emp.dept}</TableCell>
                                                    <TableCell className="py-4 px-6 text-center">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                                            {daysWorked}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-4 px-6 text-center">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                                                            {daysLeave}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-4 px-6 text-right font-mono text-sm">{stats.workLabel}</TableCell>
                                                    <TableCell className="py-4 px-6 text-right font-mono text-sm">{stats.breakLabel}</TableCell>
                                                    <TableCell className="py-4 px-6 text-right font-mono text-sm">{stats.leaveLabel}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Staff Detail Dialog */}
            <Dialog open={!!viewingStaff} onOpenChange={(open) => !open && setViewingStaff(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                                {viewingStaff?.name.charAt(0)}
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold">{viewingStaff?.name}</DialogTitle>
                                <DialogDescription>{viewingStaff?.dept} • Stats for {format(parseISO(startDate), "MMM dd")} - {format(parseISO(endDate), "MMM dd, yyyy")}</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="grid grid-cols-3 gap-4 py-6">
                        <div className="bg-muted/30 p-4 rounded-xl space-y-1">
                            <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                <Clock3 className="h-3.5 w-3.5 text-green-600" />
                                Work Hours
                            </p>
                            <p className="text-2xl font-black text-foreground">{viewingStaff?.stats.workLabel}</p>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-xl space-y-1">
                            <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                <Coffee className="h-3.5 w-3.5 text-yellow-600" />
                                Break Hours
                            </p>
                            <p className="text-2xl font-black text-foreground">{viewingStaff?.stats.breakLabel}</p>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-xl space-y-1">
                            <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                <CalendarIcon className="h-3.5 w-3.5 text-blue-600" />
                                Days Leave
                            </p>
                            <p className="text-2xl font-black text-foreground">{viewingStaff?.records.filter((r: any) => r.status === 'on-leave' || r.mode === 'LEAVE').length}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-sm font-bold uppercase text-muted-foreground tracking-widest">Recent Activity</h4>
                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                            {viewingStaff?.records.slice(0, 10).map((r: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/10">
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-bold">{format(parseISO(r.date), "EEE, MMM dd")}</p>
                                        <p className="text-xs text-muted-foreground">{r.mode} • {r.status}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-mono font-bold">
                                            {r.clockIn ? format(parseISO(r.clockIn), "HH:mm") : '--'} - {r.clockOut ? format(parseISO(r.clockOut), "HH:mm") : '--'}
                                        </p>
                                        <Badge variant="outline" className="h-4 text-[10px] uppercase font-black text-muted-foreground p-0 px-1.5 mt-0.5">
                                            {r.status.replace('-', ' ')}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Legend / Metrics Info */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { label: 'Work Hours', color: 'bg-green-500' },
                    { label: 'Break Hours', color: 'bg-yellow-500' },
                    { label: 'Break > 1h', color: 'bg-red-500' },
                    { label: 'Leave', color: 'bg-blue-500' },
                    { label: 'Office/WFH', color: 'bg-slate-500' },
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
