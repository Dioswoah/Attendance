"use client"

import { useEffect, useState, useRef } from "react"
import { useSSE } from "@/contexts/SSEContext"
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
    ChevronUp,
    ArrowUpDown,
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
    Coffee,
    Building2,
    Home
} from "lucide-react"
import { format, eachDayOfInterval, parseISO, isSameDay } from "date-fns"
import { useSession } from "next-auth/react"
import { getBrowserTimezone } from "@/lib/timezone"
import { getCurrentAuPayrollPeriod } from "@/lib/payroll"
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
    const [approvedLeaves, setApprovedLeaves] = useState<any[]>([])
    const [departments, setDepartments] = useState<any[]>([])

    // Timezone Logic
    const { data: session } = useSession()
    const userTimeZone = (session?.user as any)?.useCurrentTimezone
        ? getBrowserTimezone()
        : (session?.user as any)?.selectedTimezone || "Asia/Manila"

    // Filters
    const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [selectedDept, setSelectedDept] = useState("all")
    const [allStaff, setAllStaff] = useState<any[]>([])
    const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [staffSearchQuery, setStaffSearchQuery] = useState("")
    const [includeArchived, setIncludeArchived] = useState(false)
    const [viewingStaff, setViewingStaff] = useState<any | null>(null)
    const [bulkSelectedStaffIds, setBulkSelectedStaffIds] = useState<string[]>([])
    const [bulkActionLoading, setBulkActionLoading] = useState(false)

    // Daily Event Log column filters/sort
    const [dailyStatusFilter, setDailyStatusFilter] = useState<string[]>([])
    const [dailyAccessFilter, setDailyAccessFilter] = useState<string[]>([])
    const [dailyDeptSort, setDailyDeptSort] = useState<'asc' | 'desc' | null>(null)

    // Refs so SSE handler always reads current filter values (avoids stale closure)
    const startDateRef = useRef(startDate)
    const endDateRef = useRef(endDate)
    const selectedDeptRef = useRef(selectedDept)
    useEffect(() => { startDateRef.current = startDate }, [startDate])
    useEffect(() => { endDateRef.current = endDate }, [endDate])
    useEffect(() => { selectedDeptRef.current = selectedDept }, [selectedDept])

    // Auto-refresh when filters change (skip initial mount — fetchInitialData handles that)
    const isFirstRender = useRef(true)
    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return }
        refreshData(startDate, endDate, selectedDept)
    }, [startDate, endDate, selectedDept])

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

    // Only refresh history on actual attendance or leave changes, not calendar status updates
    useSSE((payload) => {
        if (payload.type === 'attendance' || payload.type === 'leaves') {
            refreshData()
        }
    })

    const fetchInitialData = async () => {
        setLoading(true)
        try {
            const [deptRes, attRes, staffRes, leavesRes] = await Promise.all([
                fetch('/api/departments'),
                fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}&departmentId=${selectedDept}`),
                fetch('/api/employees'),
                fetch(`/api/leaves?startDate=${startDate}&endDate=${endDate}&status=APPROVED`)
            ])
            if (deptRes.ok) setDepartments(await deptRes.json())
            if (attRes.ok) setHistory(await attRes.json())
            if (staffRes.ok) setAllStaff(await staffRes.json())
            if (leavesRes.ok) setApprovedLeaves(await leavesRes.json())
        } catch (error) {
            // Error handled silently for production
        } finally {
            setLoading(false)
        }
    }

    const refreshData = async (overrideStart?: string, overrideEnd?: string, overrideDept?: string) => {
        const sd = overrideStart ?? startDateRef.current
        const ed = overrideEnd ?? endDateRef.current
        const dept = overrideDept ?? selectedDeptRef.current
        setRefreshing(true)
        try {
            const [attRes, leavesRes] = await Promise.all([
                fetch(`/api/attendance?startDate=${sd}&endDate=${ed}&departmentId=${dept}`),
                fetch(`/api/leaves?startDate=${sd}&endDate=${ed}&status=APPROVED`)
            ])
            if (attRes.ok) setHistory(await attRes.json())
            if (leavesRes.ok) setApprovedLeaves(await leavesRes.json())
        } finally {
            setRefreshing(false)
        }
    }

    const [attendanceRecords, setAttendanceRecords] = useState<any[]>([])

    // Live Clock State (for Event Log)
    const [now, setNow] = useState(new Date())
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const calculateLiveDuration = (record: any) => {
        if (!record || !record.clockIn) return "0h 0m 0s"
        const start = new Date(record.clockIn)
        const end = record.clockOut ? new Date(record.clockOut) : now

        let breakDur = 0
        if (record.breakStart) {
            const bStart = new Date(record.breakStart)
            let effectiveEnd = now
            if (record.breakEnd) effectiveEnd = new Date(record.breakEnd)
            else if (record.clockOut) effectiveEnd = new Date(record.clockOut)

            breakDur = effectiveEnd.getTime() - bStart.getTime()
        }

        let total = (end.getTime() - start.getTime()) - breakDur
        if (total < 0) total = 0

        const h = Math.floor(total / (1000 * 60 * 60))
        const m = Math.floor((total / (1000 * 60)) % 60)
        const s = Math.floor((total / 1000) % 60)
        return `${h}h ${m}m ${s}s`
    }

    const setQuickRange = (range: 'today' | '7days' | '30days' | 'month' | 'cutoff1' | 'cutoff2' | 'au-payroll') => {
        let end = new Date()
        let start = new Date()

        if (range === 'today') {
            start.setHours(0, 0, 0, 0)
            end.setHours(23, 59, 59, 999)
        } else if (range === '7days') start.setDate(end.getDate() - 7)
        else if (range === '30days') start.setDate(end.getDate() - 30)
        else if (range === 'month') start.setDate(1)
        else if (range === 'au-payroll') {
            const period = getCurrentAuPayrollPeriod()
            start = period.start
            end = period.end
        }
        else if (range === 'cutoff1') {
            start.setMonth(start.getMonth() - 1)
            start.setDate(26)
            end.setDate(10)
        } else if (range === 'cutoff2') {
            start.setDate(11)
            end.setDate(25)
        }

        const startStr = format(start, "yyyy-MM-dd")
        const endStr = format(end, "yyyy-MM-dd")
        setStartDate(startStr)
        setEndDate(endStr)
        // Fetch immediately with the new dates — don't wait for state to settle
        refreshData(startStr, endStr)
    }

    const toggleBulkStaff = (id: string) => {
        setBulkSelectedStaffIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    }

    const toggleAllBulkStaff = (visibleIds: string[]) => {
        setBulkSelectedStaffIds(prev =>
            visibleIds.every(id => prev.includes(id))
                ? prev.filter(id => !visibleIds.includes(id))
                : [...new Set([...prev, ...visibleIds])]
        )
    }

    const handleBulkSetStatus = async (status: 'VALIDATED' | null) => {
        setBulkActionLoading(true)
        try {
            const recordIds = history
                .filter(h => bulkSelectedStaffIds.includes(h.userId) && h.clockIn)
                .map(h => h.id)
            await Promise.all(recordIds.map(id => fetch(`/api/attendance/${id}/validate`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            })))
            setBulkSelectedStaffIds([])
            refreshData()
        } finally {
            setBulkActionLoading(false)
        }
    }

    // Matrix Transformation
    const dateRange = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate)
    })

    const employees = allStaff
        .filter(s => includeArchived || !s.isArchived)
        .filter(s => selectedStaffIds.length === 0 || selectedStaffIds.includes(s.id))
        .filter(s => selectedDept === 'all' || s.departmentId === selectedDept)
        .map(s => ({
            id: s.id,
            name: s.name,
            dept: s.department?.name || 'Unassigned'
        }))
        .filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.dept.toLowerCase().includes(searchTerm.toLowerCase())
        return matchesSearch
    })

    const filteredStaffForDropdown = allStaff
        .filter(s => {
            const matchesDept = selectedDept === 'all' || s.departmentId === selectedDept
            const matchesQuery = s.name.toLowerCase().includes(staffSearchQuery.toLowerCase())
            return matchesDept && matchesQuery
        })

    const toggleAllArchived = () => {
        const archivedIds = allStaff.filter(s => s.isArchived).map(s => s.id)
        if (archivedIds.every(id => selectedStaffIds.includes(id))) {
            setSelectedStaffIds(prev => prev.filter(id => !archivedIds.includes(id)))
        } else {
            setSelectedStaffIds(prev => [...new Set([...prev, ...archivedIds])])
        }
    }

    const toggleAllStaff = () => {
        const visibleIds = filteredStaffForDropdown.map(s => s.id)
        if (visibleIds.every(id => selectedStaffIds.includes(id))) {
            setSelectedStaffIds(prev => prev.filter(id => !visibleIds.includes(id)))
        } else {
            setSelectedStaffIds(prev => [...new Set([...prev, ...visibleIds])])
        }
    }

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
                'Clock In': r.clockIn ? new Date(r.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userTimeZone }) : '-',
                'Clock Out': r.clockOut ? new Date(r.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userTimeZone }) : '-',
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
                <div className="h-20 w-20 bg-white rounded-2xl flex items-center justify-center shadow-sm overflow-hidden animate-bounce p-2">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Record Terminal...</p>
            </div>
        )
    }

    return (
        <div className="w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-10 px-4 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
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
                        {activeTab === 'daily' ? (
                            <div className="space-y-2 col-span-2 md:col-span-2">
                                <Label>Date</Label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={e => {
                                        setStartDate(e.target.value)
                                        setEndDate(e.target.value)
                                    }}
                                />
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <Label>Start Date</Label>
                                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date</Label>
                                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                                </div>
                            </>
                        )}
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
                                    <div className="p-2 border-b border-border space-y-2">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                            <Input
                                                placeholder="Search staff..."
                                                className="pl-8 h-8 text-xs"
                                                value={staffSearchQuery}
                                                onChange={e => setStaffSearchQuery(e.target.value)}
                                            />
                                        </div>
                                        <div
                                            className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors bg-muted/30"
                                            onClick={toggleAllStaff}
                                        >
                                            <Checkbox
                                                checked={filteredStaffForDropdown.length > 0 && filteredStaffForDropdown.every(s => selectedStaffIds.includes(s.id))}
                                                onCheckedChange={toggleAllStaff}
                                            />
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-bold text-foreground leading-none truncate">Select All Staff</span>
                                            </div>
                                        </div>
                                        <div
                                            className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors bg-amber-50/50"
                                            onClick={toggleAllArchived}
                                        >
                                            <Checkbox
                                                checked={allStaff.filter(s => s.isArchived).length > 0 && allStaff.filter(s => s.isArchived).every(s => selectedStaffIds.includes(s.id))}
                                                onCheckedChange={toggleAllArchived}
                                            />
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-bold text-amber-700 leading-none truncate">All Archived Staff</span>
                                                <span className="text-[10px] text-amber-600/70 truncate">Quick Select</span>
                                            </div>
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
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-t border-border mt-4 pt-4">
                        <div className="flex flex-wrap gap-2">
                            {activeTab !== 'daily' && ['today', '7days', '30days', 'month'].map(r => (
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
                            {activeTab !== 'daily' && (
                                <Button
                                    onClick={() => setQuickRange('au-payroll')}
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs font-black bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 transition-all"
                                >
                                    AU Payroll Period
                                </Button>
                            )}
                            {activeTab === 'summary' && (
                                <>
                                    <div className="w-px h-6 bg-border mx-1 hidden md:block self-center" />
                                    <Button
                                        onClick={() => setQuickRange('cutoff1')}
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs font-black bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 transition-all gap-1.5"
                                    >
                                        <Zap className="h-3 w-3" />
                                        1st Cutoff (26th-10th)
                                    </Button>
                                    <Button
                                        onClick={() => setQuickRange('cutoff2')}
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs font-black bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-all gap-1.5"
                                    >
                                        <ShieldCheck className="h-3 w-3" />
                                        2nd Cutoff (11th-25th)
                                    </Button>
                                </>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={() => refreshData()} disabled={refreshing} variant="outline" size="sm" className="h-9">
                                <RefreshCcw className={cn("h-3.5 w-3.5 mr-2", refreshing && "animate-spin")} />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* View Selection Tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
                {[
                    { id: 'matrix', label: 'Attendance Matrix', icon: LayoutGrid },
                    { id: 'daily', label: 'Daily Event Log', icon: FileText },
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
                            {activeTab === 'daily' || startDate === endDate ? (
                                <span>{format(parseISO(endDate), "MMM dd, yyyy")}</span>
                            ) : (
                                <>
                                    <span>{format(parseISO(startDate), "MMM dd")}</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                    <span>{format(parseISO(endDate), "MMM dd, yyyy")}</span>
                                </>
                            )}
                        </div>
                    </div>

                    {activeTab === 'matrix' && bulkSelectedStaffIds.length > 0 && (
                        <div className="px-4 py-2.5 border-b border-border bg-teal-50/50 flex items-center justify-between gap-3">
                            <span className="text-xs font-bold text-teal-700">{bulkSelectedStaffIds.length} staff selected</span>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    disabled={bulkActionLoading}
                                    className="h-8 text-xs bg-teal-600 hover:bg-teal-700"
                                    onClick={() => handleBulkSetStatus('VALIDATED')}
                                >
                                    Validate Selected
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={bulkActionLoading}
                                    className="h-8 text-xs"
                                    onClick={() => handleBulkSetStatus(null)}
                                >
                                    Clear Status
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={bulkActionLoading}
                                    className="h-8 text-xs text-muted-foreground"
                                    onClick={() => setBulkSelectedStaffIds([])}
                                >
                                    Deselect All
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto w-full min-h-[400px]">
                        {activeTab === 'matrix' ? (
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="hover:bg-transparent border-border">
                                        <TableHead className="py-3 px-3 font-medium text-muted-foreground sticky left-0 bg-muted/50 z-10 w-[36px]">
                                            <Checkbox
                                                checked={employees.length > 0 && employees.every(e => bulkSelectedStaffIds.includes(e.id))}
                                                onCheckedChange={() => toggleAllBulkStaff(employees.map(e => e.id))}
                                            />
                                        </TableHead>
                                        <TableHead className="py-3 px-6 font-medium text-muted-foreground sticky left-9 bg-muted/50 z-10 w-[200px]">Staff</TableHead>
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
                                                <TableCell className="py-3 px-3 sticky left-0 bg-white group-hover:bg-muted/30 z-10 w-[36px]">
                                                    <Checkbox
                                                        checked={bulkSelectedStaffIds.includes(emp.id)}
                                                        onCheckedChange={() => toggleBulkStaff(emp.id)}
                                                    />
                                                </TableCell>
                                                <TableCell
                                                    className="py-3 px-6 sticky left-9 bg-white group-hover:bg-muted/30 z-10 border-r border-border font-medium text-sm text-foreground cursor-pointer hover:text-primary"
                                                    onClick={() => setViewingStaff({ ...emp, stats, records: empRecs })}
                                                >
                                                    {emp.name}
                                                </TableCell>
                                                <TableCell className="py-3 px-6 text-sm text-muted-foreground">
                                                    {emp.dept}
                                                </TableCell>
                                                {dateRange.map(date => {
                                                    const dateStr = format(date, "yyyy-MM-dd")
                                                    const record = history.find(h => h.userId === emp.id && h.date === dateStr)
                                                    const isOnLeave = !record && approvedLeaves.some(l =>
                                                        l.userId === emp.id &&
                                                        dateStr >= l.startDate.slice(0, 10) &&
                                                        dateStr <= l.endDate.slice(0, 10)
                                                    )

                                                    // Break duration from breaks array
                                                    const totalBreakMs = (record?.breaks || []).reduce((acc: number, b: any) => {
                                                        if (!b.startTime) return acc
                                                        const s = new Date(b.startTime).getTime()
                                                        const e = b.endTime ? new Date(b.endTime).getTime() : Date.now()
                                                        return acc + Math.max(0, e - s)
                                                    }, 0)
                                                    const hasPendingRequest = (record?.pendingRequests || []).length > 0
                                                    const isLeaveRecord = record && (record.status === 'on-leave' || record.mode === 'LEAVE')
                                                    const hasWork = record && record.clockIn && !isLeaveRecord
                                                    const hasOverBreak = hasWork && totalBreakMs > 3600000
                                                    const dayStats = record?.clockIn ? calculateDurations([record]) : null

                                                    return (
                                                        <TableCell key={date.toISOString()} className="py-3 px-2 text-center p-0">
                                                            {record ? (
                                                                <div className="flex flex-col items-center justify-center gap-0.5 py-1 group/mark">
                                                                    {hasOverBreak && <div className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                                                                    <div className={`h-2 w-2 rounded-full ${isLeaveRecord ? 'bg-blue-500' : 'bg-green-500'}`} />
                                                                    {record.validationStatus === 'VALIDATED' && <div className="h-1.5 w-1.5 rounded-full bg-teal-500" />}
                                                                    {record.validationStatus === 'NEEDS_CORRECTION' && <div className="h-1.5 w-1.5 rounded-full bg-fuchsia-500" />}
                                                                    {hasPendingRequest && <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                                                                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover/mark:opacity-100 transition-opacity z-20 pointer-events-none">
                                                                        <div className="bg-popover border border-border rounded shadow-sm px-2 py-1.5 text-[10px] text-muted-foreground font-medium whitespace-nowrap text-left space-y-0.5 max-w-[220px]">
                                                                            {record.clockIn ? (
                                                                                <>
                                                                                    <div>In: {new Date(record.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userTimeZone })}</div>
                                                                                    <div>Out: {record.clockOut ? new Date(record.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userTimeZone }) : 'Still clocked in'}</div>
                                                                                    <div className="font-bold text-foreground">Total: {dayStats?.workLabel}</div>
                                                                                </>
                                                                            ) : (
                                                                                <div className="font-bold text-foreground">On Leave</div>
                                                                            )}
                                                                            {record.validationStatus === 'NEEDS_CORRECTION' && (
                                                                                <div className="text-fuchsia-600 font-bold whitespace-normal border-t border-border pt-1 mt-1">
                                                                                    {allStaff.find(s => s.id === emp.id)?.correctionNote || 'Needs correction'}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : isOnLeave ? (
                                                                <div className="h-2 w-2 rounded-full bg-blue-500 mx-auto" />
                                                            ) : (
                                                                <div className="h-1.5 w-1.5 bg-muted rounded-full mx-auto" />
                                                            )}
                                                        </TableCell>
                                                    )
                                                })}
                                                <TableCell className="py-3 px-6 text-right">
                                                    <span className="text-[10px] font-bold text-green-600">W: {stats.workLabel}</span>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                    {employees.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={dateRange.length + 4} className="py-12 text-center">
                                                <div className="flex flex-col items-center gap-2 text-muted-foreground opacity-50">
                                                    <Users className="h-8 w-8" />
                                                    <p className="text-sm font-medium">No records</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        ) : activeTab === 'daily' ? (() => {
                            const dailyRows = employees
                                .map(emp => {
                                    const record = history.find(h => h.userId === emp.id && isSameDay(parseISO(h.date), parseISO(endDate)))
                                    const status = record?.status || "absent"
                                    const accessKey = record?.mode && status !== 'on-leave'
                                        ? (record.mode === 'OFFICE' ? 'office' : 'wfh')
                                        : 'offline'
                                    return { emp, record, status, accessKey }
                                })
                                .filter(({ status, accessKey }) => {
                                    if (dailyStatusFilter.length > 0 && !dailyStatusFilter.includes(status)) return false
                                    if (dailyAccessFilter.length > 0 && !dailyAccessFilter.includes(accessKey)) return false
                                    return true
                                })
                                .sort((a, b) => {
                                    if (dailyDeptSort === 'asc') return a.emp.dept.localeCompare(b.emp.dept)
                                    if (dailyDeptSort === 'desc') return b.emp.dept.localeCompare(a.emp.dept)
                                    return 0
                                })

                            const statusOptions = [
                                { value: 'clocked-in', label: 'Clocked In' },
                                { value: 'on-break', label: 'On Break' },
                                { value: 'on-leave', label: 'On Leave' },
                                { value: 'clocked-out', label: 'Clocked Out' },
                                { value: 'absent', label: 'Absent' },
                            ]
                            const accessOptions = [
                                { value: 'office', label: 'In Office' },
                                { value: 'wfh', label: 'WFH' },
                                { value: 'offline', label: 'Offline' },
                            ]
                            const toggleFilter = (arr: string[], val: string, set: (v: string[]) => void) =>
                                set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])

                            return (
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="py-4 px-6 font-medium text-muted-foreground">Personnel</TableHead>

                                        <TableHead className="py-4 px-6">
                                            <button onClick={() => setDailyDeptSort(s => s === null ? 'asc' : s === 'asc' ? 'desc' : null)}
                                                className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors">
                                                Department
                                                {dailyDeptSort === 'asc' ? <ChevronUp className="h-3 w-3" /> : dailyDeptSort === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                                            </button>
                                        </TableHead>

                                        <TableHead className="py-4 px-6 text-center">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <button className={cn("flex items-center gap-1 font-medium transition-colors mx-auto", dailyStatusFilter.length > 0 ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                                                        Status <Filter className="h-3 w-3" />
                                                        {dailyStatusFilter.length > 0 && <span className="text-[10px] bg-primary text-white rounded-full px-1.5 leading-4">{dailyStatusFilter.length}</span>}
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-44 p-2" align="center">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Filter Status</p>
                                                    {statusOptions.map(opt => (
                                                        <div key={opt.value} className="flex items-center gap-2 p-1.5 hover:bg-muted rounded-md cursor-pointer"
                                                            onClick={() => toggleFilter(dailyStatusFilter, opt.value, setDailyStatusFilter)}>
                                                            <Checkbox checked={dailyStatusFilter.includes(opt.value)} />
                                                            <span className="text-xs">{opt.label}</span>
                                                        </div>
                                                    ))}
                                                    {dailyStatusFilter.length > 0 && <button onClick={() => setDailyStatusFilter([])} className="w-full text-[10px] text-primary font-bold mt-2 pt-1 border-t hover:underline">Clear all</button>}
                                                </PopoverContent>
                                            </Popover>
                                        </TableHead>

                                        <TableHead className="py-4 px-6 font-medium text-muted-foreground">Metrics</TableHead>

                                        <TableHead className="py-4 px-6 text-right">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <button className={cn("flex items-center gap-1 font-medium transition-colors ml-auto", dailyAccessFilter.length > 0 ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                                                        Access <Filter className="h-3 w-3" />
                                                        {dailyAccessFilter.length > 0 && <span className="text-[10px] bg-primary text-white rounded-full px-1.5 leading-4">{dailyAccessFilter.length}</span>}
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-36 p-2" align="end">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Filter Access</p>
                                                    {accessOptions.map(opt => (
                                                        <div key={opt.value} className="flex items-center gap-2 p-1.5 hover:bg-muted rounded-md cursor-pointer"
                                                            onClick={() => toggleFilter(dailyAccessFilter, opt.value, setDailyAccessFilter)}>
                                                            <Checkbox checked={dailyAccessFilter.includes(opt.value)} />
                                                            <span className="text-xs">{opt.label}</span>
                                                        </div>
                                                    ))}
                                                    {dailyAccessFilter.length > 0 && <button onClick={() => setDailyAccessFilter([])} className="w-full text-[10px] text-primary font-bold mt-2 pt-1 border-t hover:underline">Clear all</button>}
                                                </PopoverContent>
                                            </Popover>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {dailyRows.map(({ emp, record, status }) => {

                                        return (
                                            <TableRow key={emp.id} className="hover:bg-muted/50 transition-all duration-200">
                                                <TableCell className="py-4 px-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground font-medium relative overflow-hidden text-sm">
                                                            {emp.name?.charAt(0) || "U"}
                                                            <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 border-2 border-white rounded-full ${status === 'clocked-in' ? 'bg-green-500' :
                                                                status === 'on-break' ? 'bg-yellow-500' : 'bg-slate-300'
                                                                }`} />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-foreground text-sm leading-tight">{emp.name || "Unknown Identity"}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-4 px-6">
                                                    <span className="text-sm text-foreground">
                                                        {emp.dept || "Unassigned"}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-4 px-6 text-center">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        <Badge variant="outline" className={`font-normal ${status === 'clocked-in' ? 'bg-green-50 text-green-700 border-green-200' :
                                                            status === 'on-break' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                status === 'on-leave' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                    status === 'clocked-out' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                                                        'bg-red-50 text-red-600 border-red-100'
                                                            }`}>
                                                            {status.replace('-', ' ')}
                                                        </Badge>
                                                        {status === 'on-leave' && record?.returnDate && (
                                                            <span className="text-[10px] font-semibold text-muted-foreground">
                                                                Returns {new Date(record.returnDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: userTimeZone })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-4 px-6">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                                            <span>{record?.clockIn ? new Date(record.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userTimeZone }) : '---'}</span>
                                                        </div>
                                                        {/* For historical records, we can't show "Live" duration if it's not today. If it is today, we can. */}
                                                        {isSameDay(parseISO(endDate), new Date()) ? (
                                                            <span className="text-xs text-muted-foreground font-mono tabular-nums">{calculateLiveDuration(record)}</span>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground font-mono tabular-nums">
                                                                {record && record.clockOut && record.clockIn
                                                                    ? formatDuration(calculateDurations([record]).workMs)
                                                                    : '---'}
                                                            </span>
                                                        )}

                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-4 px-6 text-right">
                                                    {record?.mode && status !== 'on-leave' ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            {record.mode === 'OFFICE' ? (
                                                                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                                                                    <Building2 className="h-3 w-3" />
                                                                    In Office
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                                                                    <Home className="h-3 w-3" />
                                                                    WFH
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-end">
                                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2.5 py-1">Offline</span>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                            )
                        })() : (
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
                                            {r.clockIn ? new Date(r.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userTimeZone }) : '--'} - {r.clockOut ? new Date(r.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userTimeZone }) : '--'}
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Work Hours', color: 'bg-green-500' },
                    { label: 'Break > 1h', color: 'bg-red-500' },
                    { label: 'Leave', color: 'bg-blue-500' },
                    { label: 'Pending Request', color: 'bg-amber-500' },
                    { label: 'Validated', color: 'bg-teal-500' },
                    { label: 'Needs Correction', color: 'bg-fuchsia-500' },
                    { label: 'No Log', color: 'bg-muted border border-border' },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl border border-border shadow-sm">
                        <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                        <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                    </div>
                ))}
            </div>
        </div >
    )
}
