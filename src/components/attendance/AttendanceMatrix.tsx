"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Search,
    RefreshCcw,
    Users,
    ChevronDown,
    ArrowRight,
    ShieldCheck,
    Clock3,
    Coffee,
    Calendar as CalendarIcon
} from "lucide-react"
import { format, eachDayOfInterval, parseISO } from "date-fns"
import { getBrowserTimezone } from "@/lib/timezone"
import { getCurrentAuPayrollPeriod } from "@/lib/payroll"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useSession } from "next-auth/react"
import { useSSE } from "@/contexts/SSEContext"

interface AttendanceMatrixProps {
    // When provided, restricts staff/departments/attendance/leaves to this manager's team.
    // Omit for the admin (unscoped) view.
    scopeToManagerId?: string
}

export function AttendanceMatrix({ scopeToManagerId }: AttendanceMatrixProps) {
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [history, setHistory] = useState<any[]>([])
    const [approvedLeaves, setApprovedLeaves] = useState<any[]>([])
    const [departments, setDepartments] = useState<any[]>([])

    const { data: session } = useSession()
    const userTimeZone = (session?.user as any)?.useCurrentTimezone
        ? getBrowserTimezone()
        : (session?.user as any)?.selectedTimezone || "Asia/Manila"

    const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([])
    const [deptSearchQuery, setDeptSearchQuery] = useState("")
    const [allStaff, setAllStaff] = useState<any[]>([])
    const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [staffSearchQuery, setStaffSearchQuery] = useState("")
    const [viewingStaff, setViewingStaff] = useState<any | null>(null)

    const startDateRef = useRef(startDate)
    const endDateRef = useRef(endDate)
    const selectedDeptIdsRef = useRef(selectedDeptIds)
    useEffect(() => { startDateRef.current = startDate }, [startDate])
    useEffect(() => { endDateRef.current = endDate }, [endDate])
    useEffect(() => { selectedDeptIdsRef.current = selectedDeptIds }, [selectedDeptIds])

    const isFirstRender = useRef(true)
    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return }
        refreshData(startDate, endDate, selectedDeptIds)
    }, [startDate, endDate, selectedDeptIds])

    const calculateDurations = (recs: any[]) => {
        let workMs = 0
        let breakMs = 0
        let leaveMs = 0

        recs.forEach(r => {
            if (r.status === 'on-leave' || r.mode === 'LEAVE') {
                leaveMs += 8 * 60 * 60 * 1000
            } else if (r.clockIn) {
                const clockIn = new Date(r.clockIn).getTime()
                const clockOut = r.clockOut ? new Date(r.clockOut).getTime() :
                    (format(new Date(r.date), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? new Date().getTime() : 0)

                if (clockOut > clockIn) {
                    let dayBreakMs = 0
                    r.breaks?.forEach((b: any) => {
                        const start = new Date(b.startTime).getTime()
                        const end = b.endTime ? new Date(b.endTime).getTime() :
                            (format(new Date(r.date), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? new Date().getTime() : start)
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
        if (scopeToManagerId === '') return // scoped mode, but manager id not resolved yet
        fetchInitialData()
    }, [scopeToManagerId])

    // Only refresh on actual attendance or leave changes, not calendar status updates
    useSSE((payload) => {
        if (payload.type === 'attendance' || payload.type === 'leaves') {
            refreshData()
        }
    })

    const fetchInitialData = async () => {
        setLoading(true)
        try {
            const managerParam = scopeToManagerId ? `&managerId=${scopeToManagerId}` : ''
            const deptParam = selectedDeptIds.length === 1 ? `&departmentId=${selectedDeptIds[0]}` : ''
            const [deptRes, attRes, staffRes, leavesRes] = await Promise.all([
                fetch('/api/departments'),
                fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}${deptParam}${managerParam}`),
                fetch('/api/employees'),
                fetch(`/api/leaves?startDate=${startDate}&endDate=${endDate}&status=APPROVED${managerParam}`)
            ])

            let deptList = deptRes.ok ? await deptRes.json() : []
            let staffList = staffRes.ok ? await staffRes.json() : []

            if (scopeToManagerId) {
                const ownedDeptIds = deptList.filter((d: any) => d.managerId === scopeToManagerId).map((d: any) => d.id)
                staffList = staffList.filter((s: any) =>
                    s.managerId === scopeToManagerId || (s.departmentId && ownedDeptIds.includes(s.departmentId))
                )
                const relevantDeptIds = new Set([...ownedDeptIds, ...staffList.map((s: any) => s.departmentId).filter(Boolean)])
                deptList = deptList.filter((d: any) => relevantDeptIds.has(d.id))
            }

            setDepartments(deptList)
            setAllStaff(staffList)
            if (attRes.ok) setHistory(await attRes.json())
            if (leavesRes.ok) setApprovedLeaves(await leavesRes.json())
        } catch (error) {
            // Error handled silently for production
        } finally {
            setLoading(false)
        }
    }

    const refreshData = async (overrideStart?: string, overrideEnd?: string, overrideDeptIds?: string[]) => {
        const sd = overrideStart ?? startDateRef.current
        const ed = overrideEnd ?? endDateRef.current
        const deptIds = overrideDeptIds ?? selectedDeptIdsRef.current
        setRefreshing(true)
        try {
            const managerParam = scopeToManagerId ? `&managerId=${scopeToManagerId}` : ''
            const deptParam = deptIds.length === 1 ? `&departmentId=${deptIds[0]}` : ''
            const [attRes, leavesRes] = await Promise.all([
                fetch(`/api/attendance?startDate=${sd}&endDate=${ed}${deptParam}${managerParam}`),
                fetch(`/api/leaves?startDate=${sd}&endDate=${ed}&status=APPROVED${managerParam}`)
            ])
            if (attRes.ok) setHistory(await attRes.json())
            if (leavesRes.ok) setApprovedLeaves(await leavesRes.json())
        } finally {
            setRefreshing(false)
        }
    }

    const handleValidate = async (recordId: string) => {
        await fetch(`/api/attendance/${recordId}/validate`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'VALIDATED' })
        })
        refreshData()
    }

    const handleClearValidation = async (recordId: string) => {
        await fetch(`/api/attendance/${recordId}/validate`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: null })
        })
        refreshData()
    }

    const handleFlagCorrection = async (recordId: string, empId: string, note: string) => {
        await Promise.all([
            fetch(`/api/attendance/${recordId}/validate`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'NEEDS_CORRECTION' })
            }),
            fetch(`/api/employees/${empId}/correction-note`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note })
            })
        ])
        setAllStaff(prev => prev.map(s => s.id === empId ? { ...s, correctionNote: note } : s))
        refreshData()
    }

    const setQuickRange = (range: 'today' | '7days' | '30days' | 'month' | 'au-payroll') => {
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

        const startStr = format(start, "yyyy-MM-dd")
        const endStr = format(end, "yyyy-MM-dd")
        setStartDate(startStr)
        setEndDate(endStr)
        refreshData(startStr, endStr)
    }

    const dateRange = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate)
    })

    const employees = allStaff
        .filter(s => !s.isArchived)
        .filter(s => selectedStaffIds.length === 0 || selectedStaffIds.includes(s.id))
        .filter(s => selectedDeptIds.length === 0 || selectedDeptIds.includes(s.departmentId))
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
        .filter(s => !s.isArchived)
        .filter(s => {
            const matchesDept = selectedDeptIds.length === 0 || selectedDeptIds.includes(s.departmentId)
            const matchesQuery = s.name.toLowerCase().includes(staffSearchQuery.toLowerCase())
            return matchesDept && matchesQuery
        })

    const filteredDeptsForDropdown = departments.filter(d =>
        d.name.toLowerCase().includes(deptSearchQuery.toLowerCase())
    )

    const toggleAllDepts = () => {
        const visibleIds = filteredDeptsForDropdown.map(d => d.id)
        if (visibleIds.every(id => selectedDeptIds.includes(id))) {
            setSelectedDeptIds(prev => prev.filter(id => !visibleIds.includes(id)))
        } else {
            setSelectedDeptIds(prev => [...new Set([...prev, ...visibleIds])])
        }
        setSelectedStaffIds([])
    }

    const toggleDeptSelection = (id: string) => {
        setSelectedDeptIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
        setSelectedStaffIds([])
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
        <div className="w-full mx-auto space-y-6 animate-in fade-in duration-500">
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
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between h-10 font-normal">
                                        <div className="flex items-center gap-2 truncate">
                                            <Users className="h-4 w-4 text-muted-foreground" />
                                            {selectedDeptIds.length === 0 ? (
                                                <span className="text-muted-foreground">All Departments</span>
                                            ) : selectedDeptIds.length === 1 ? (
                                                <span className="truncate">{departments.find(d => d.id === selectedDeptIds[0])?.name || '1 Selected'}</span>
                                            ) : (
                                                <span>{selectedDeptIds.length} Selected</span>
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
                                                placeholder="Search departments..."
                                                className="pl-8 h-8 text-xs"
                                                value={deptSearchQuery}
                                                onChange={e => setDeptSearchQuery(e.target.value)}
                                            />
                                        </div>
                                        <div
                                            className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors bg-muted/30"
                                            onClick={toggleAllDepts}
                                        >
                                            <Checkbox
                                                checked={filteredDeptsForDropdown.length > 0 && filteredDeptsForDropdown.every(d => selectedDeptIds.includes(d.id))}
                                                onCheckedChange={toggleAllDepts}
                                            />
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-bold text-foreground leading-none truncate">Select All Departments</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto p-1">
                                        {filteredDeptsForDropdown.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-muted-foreground">
                                                No departments found
                                            </div>
                                        ) : (
                                            filteredDeptsForDropdown.map(dept => (
                                                <div
                                                    key={dept.id}
                                                    className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors"
                                                    onClick={() => toggleDeptSelection(dept.id)}
                                                >
                                                    <Checkbox
                                                        id={`dept-${dept.id}`}
                                                        checked={selectedDeptIds.includes(dept.id)}
                                                        onCheckedChange={() => toggleDeptSelection(dept.id)}
                                                    />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-medium leading-none truncate">{dept.name}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    {selectedDeptIds.length > 0 && (
                                        <div className="p-2 border-t border-border">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-full h-8 text-xs text-primary hover:text-primary transition-colors"
                                                onClick={() => { setSelectedDeptIds([]); setSelectedStaffIds([]) }}
                                            >
                                                Clear Selection
                                            </Button>
                                        </div>
                                    )}
                                </PopoverContent>
                            </Popover>
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
                            <Button
                                onClick={() => setQuickRange('au-payroll')}
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-black bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 transition-all"
                            >
                                AU Payroll Period
                            </Button>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={() => refreshData()} disabled={refreshing} variant="outline" size="sm" className="h-9">
                                <RefreshCcw className={`h-3.5 w-3.5 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Matrix */}
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
                            {startDate === endDate ? (
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

                    <div className="overflow-x-auto w-full min-h-[400px]">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="hover:bg-transparent border-border">
                                    <TableHead className="py-3 px-6 font-medium text-muted-foreground sticky left-0 bg-muted/50 z-10 w-[200px]">Staff</TableHead>
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
                                                const dateStr = format(date, "yyyy-MM-dd")
                                                const record = history.find(h => h.userId === emp.id && h.date === dateStr)
                                                const isOnLeave = !record && approvedLeaves.some(l =>
                                                    l.userId === emp.id &&
                                                    dateStr >= l.startDate.slice(0, 10) &&
                                                    dateStr <= l.endDate.slice(0, 10)
                                                )

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
                                                const dayStats = hasWork ? calculateDurations([record]) : null

                                                return (
                                                    <TableCell key={date.toISOString()} className="py-3 px-2 text-center p-0">
                                                        {isLeaveRecord || isOnLeave ? (
                                                            <div className="h-2 w-2 rounded-full bg-blue-500 mx-auto" />
                                                        ) : hasWork ? (
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <div className="flex flex-col items-center justify-center gap-0.5 py-1 group/mark cursor-pointer">
                                                                        {hasOverBreak && <div className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                                                                        <div className="h-2 w-2 rounded-full bg-green-500" />
                                                                        {record.validationStatus === 'VALIDATED' && <div className="h-1.5 w-1.5 rounded-full bg-teal-500" />}
                                                                        {record.validationStatus === 'NEEDS_CORRECTION' && <div className="h-1.5 w-1.5 rounded-full bg-fuchsia-500" />}
                                                                        {hasPendingRequest && <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                                                                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover/mark:opacity-100 transition-opacity z-20 pointer-events-none">
                                                                            <div className="bg-popover border border-border rounded shadow-sm px-2 py-1.5 text-[10px] text-muted-foreground font-medium whitespace-nowrap text-left space-y-0.5">
                                                                                <div>In: {new Date(record.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userTimeZone })}</div>
                                                                                <div>Out: {record.clockOut ? new Date(record.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userTimeZone }) : 'Still clocked in'}</div>
                                                                                <div className="font-bold text-foreground">Total: {dayStats?.workLabel}</div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </PopoverTrigger>
                                                                <ValidationPopoverContent
                                                                    record={record}
                                                                    staffNote={allStaff.find(s => s.id === emp.id)?.correctionNote || ''}
                                                                    onValidate={() => handleValidate(record.id)}
                                                                    onFlag={(note) => handleFlagCorrection(record.id, emp.id, note)}
                                                                    onClear={() => handleClearValidation(record.id)}
                                                                />
                                                            </Popover>
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
                                        <TableCell colSpan={dateRange.length + 3} className="py-12 text-center">
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground opacity-50">
                                                <Users className="h-8 w-8" />
                                                <p className="text-sm font-medium">No records</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
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
                                        <span className="inline-block h-4 text-[10px] uppercase font-black text-muted-foreground border border-border rounded px-1.5 mt-0.5">
                                            {r.status.replace('-', ' ')}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Legend */}
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
            <p className="text-xs text-muted-foreground">Click a work-hours dot to validate a record or flag it for correction.</p>
        </div>
    )
}

function ValidationPopoverContent({ record, staffNote, onValidate, onFlag, onClear }: {
    record: any
    staffNote: string
    onValidate: () => Promise<void>
    onFlag: (note: string) => Promise<void>
    onClear: () => Promise<void>
}) {
    const [mode, setMode] = useState<'idle' | 'flagging'>('idle')
    const [note, setNote] = useState(staffNote)
    const [saving, setSaving] = useState(false)
    const status = record.validationStatus

    const runAction = async (action: () => Promise<void>) => {
        setSaving(true)
        try {
            await action()
            setMode('idle')
        } finally {
            setSaving(false)
        }
    }

    return (
        <PopoverContent className="w-72 p-3" align="center">
            {mode === 'idle' ? (
                <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Review this record</p>
                    {status === 'VALIDATED' && (
                        <p className="text-xs text-teal-600 font-medium">Marked as validated.</p>
                    )}
                    {status === 'NEEDS_CORRECTION' && staffNote && (
                        <p className="text-xs text-fuchsia-600 font-medium">Flagged: {staffNote}</p>
                    )}
                    <div className="flex flex-col gap-1.5 pt-1">
                        <Button size="sm" disabled={saving} className="h-8 text-xs bg-teal-600 hover:bg-teal-700" onClick={() => runAction(onValidate)}>
                            Validate
                        </Button>
                        <Button size="sm" disabled={saving} variant="outline" className="h-8 text-xs border-fuchsia-300 text-fuchsia-700 hover:bg-fuchsia-50" onClick={() => setMode('flagging')}>
                            Needs Correction
                        </Button>
                        {status && (
                            <Button size="sm" disabled={saving} variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={() => runAction(onClear)}>
                                Clear Status
                            </Button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">What needs to be corrected?</p>
                    <Textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Describe the issue for this staff member..."
                        className="text-xs min-h-[80px]"
                    />
                    <div className="flex gap-2">
                        <Button size="sm" disabled={saving} className="h-8 text-xs bg-fuchsia-600 hover:bg-fuchsia-700 flex-1" onClick={() => runAction(() => onFlag(note))}>
                            Save
                        </Button>
                        <Button size="sm" disabled={saving} variant="ghost" className="h-8 text-xs" onClick={() => setMode('idle')}>
                            Back
                        </Button>
                    </div>
                </div>
            )}
        </PopoverContent>
    )
}
