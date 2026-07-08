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
    Calendar as CalendarIcon,
    Globe
} from "lucide-react"
import { format, eachDayOfInterval, parseISO } from "date-fns"
import { getBrowserTimezone } from "@/lib/timezone"
import { getCurrentAuPayrollPeriod } from "@/lib/payroll"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useSession } from "next-auth/react"
import { useSSE } from "@/contexts/SSEContext"
import { toast } from "sonner"
import { ValidationPopoverContent } from "@/components/attendance/ValidationPopoverContent"

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
    // The range actually reflected in `history`/`dateRange` below. Only updated once a fetch for
    // that range completes — kept separate from startDate/endDate (which update immediately as the
    // user types/clicks) so the table never renders new date columns against still-stale data.
    const [appliedStartDate, setAppliedStartDate] = useState(startDate)
    const [appliedEndDate, setAppliedEndDate] = useState(endDate)
    const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([])
    const [deptSearchQuery, setDeptSearchQuery] = useState("")
    const [allStaff, setAllStaff] = useState<any[]>([])
    const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
    const [selectedLocations, setSelectedLocations] = useState<string[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [staffSearchQuery, setStaffSearchQuery] = useState("")
    const [viewingStaff, setViewingStaff] = useState<any | null>(null)
    const [bulkSelectedStaffIds, setBulkSelectedStaffIds] = useState<string[]>([])
    const [bulkActionLoading, setBulkActionLoading] = useState(false)
    // Validation mode is off by default — managers can view records read-only until they
    // opt in, since the checklist/validate actions are a review workflow, not the default view.
    const [showValidation, setShowValidation] = useState(false)

    const EMPLOYMENT_LOCATIONS = ['Philippines', 'Australia']

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

    // Only refresh on actual attendance/leave/validation changes, not calendar status updates
    useSSE((payload) => {
        if (payload.type === 'attendance' || payload.type === 'leaves' || payload.type === 'validation') {
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
            if (attRes.ok) {
                setHistory(await attRes.json())
                setAppliedStartDate(startDate)
                setAppliedEndDate(endDate)
            }
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
            // Apply the fetched data and the range it belongs to together — never let the table's
            // date columns (driven by appliedStartDate/appliedEndDate) update ahead of the records
            // backing them, which is what caused the Total column to flash a stale value.
            if (attRes.ok) {
                setHistory(await attRes.json())
                setAppliedStartDate(sd)
                setAppliedEndDate(ed)
            }
            if (leavesRes.ok) setApprovedLeaves(await leavesRes.json())
        } finally {
            setRefreshing(false)
        }
    }

    const setValidationStatus = async (recordId: string | undefined, userId: string, dateStr: string, status: 'VALIDATED' | 'NEEDS_CORRECTION' | null) => {
        const res = recordId
            ? await fetch(`/api/attendance/${recordId}/validate`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            })
            // No attendance record exists yet for this day (e.g. an absence) — create one to attach the status to.
            : await fetch(`/api/attendance/validate-day`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, date: dateStr, status })
            })
        return res.ok
    }

    const handleValidate = async (recordId: string | undefined, userId: string, dateStr: string) => {
        const ok = await setValidationStatus(recordId, userId, dateStr, 'VALIDATED')
        if (ok) toast.success("Marked as validated")
        else toast.error("Failed to validate record")
        refreshData()
    }

    const handleClearValidation = async (recordId: string | undefined, userId: string, dateStr: string) => {
        const ok = await setValidationStatus(recordId, userId, dateStr, null)
        if (ok) toast.success("Validation status cleared")
        else toast.error("Failed to clear validation status")
        refreshData()
    }

    const handleFlagCorrection = async (recordId: string | undefined, empId: string, dateStr: string, note: string) => {
        const [statusOk, noteRes] = await Promise.all([
            setValidationStatus(recordId, empId, dateStr, 'NEEDS_CORRECTION'),
            fetch(`/api/employees/${empId}/correction-note`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note })
            })
        ])
        if (statusOk && noteRes.ok) {
            toast.success("Flagged for correction")
        } else {
            toast.error("Failed to flag record for correction")
        }
        setAllStaff(prev => prev.map(s => s.id === empId ? { ...s, correctionNote: note } : s))
        refreshData()
    }

    // Aggregates one staff member's day-by-day validation status across the currently selected
    // date range into a single symbol. Leave days are excluded — there's no validate/flag action
    // for a leave day, so requiring them to be "validated" would make full-✓ unreachable for
    // anyone who took leave during the period.
    const getValidationSummary = (empId: string): 'VALIDATED' | 'NEEDS_CORRECTION' | 'NOT_VALIDATED' => {
        let hasNeedsCorrection = false
        let hasUnvalidated = false
        dateRange.forEach(date => {
            const dateStr = format(date, "yyyy-MM-dd")
            const record = history.find(h => h.userId === empId && h.date === dateStr)
            const isOnLeave = !record && approvedLeaves.some(l =>
                l.userId === empId &&
                dateStr >= l.startDate.slice(0, 10) &&
                dateStr <= l.endDate.slice(0, 10)
            )
            if (isOnLeave) return
            if (record?.validationStatus === 'NEEDS_CORRECTION') hasNeedsCorrection = true
            else if (record?.validationStatus !== 'VALIDATED') hasUnvalidated = true
        })
        if (hasNeedsCorrection) return 'NEEDS_CORRECTION'
        if (hasUnvalidated) return 'NOT_VALIDATED'
        return 'VALIDATED'
    }

    const toggleLocationSelection = (loc: string) => {
        setSelectedLocations(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc])
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
            const staffCount = bulkSelectedStaffIds.length
            // Single batched request instead of one HTTP call per staff x date — firing
            // hundreds of parallel requests competed with regular clock-in/out traffic for
            // the same Cloud Run instances and DB connections, occasionally stalling them.
            const res = await fetch('/api/attendance/validate-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staffIds: bulkSelectedStaffIds, startDate: appliedStartDate, endDate: appliedEndDate, status })
            })
            if (res.ok) {
                const { updated, created } = await res.json()
                toast.success(status === 'VALIDATED' ? `Validated ${updated + created} day(s) for ${staffCount} staff` : `Cleared validation for ${staffCount} staff`)
            } else {
                toast.error("Failed to update validation status")
            }
            setBulkSelectedStaffIds([])
            refreshData()
        } finally {
            setBulkActionLoading(false)
        }
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
        // Don't also call refreshData here — the useEffect watching [startDate, endDate,
        // selectedDeptIds] already fires on this state change. Calling both fired two
        // overlapping fetches for the same range, which is exactly the kind of race that
        // caused the table to visibly flicker/double-render.
        setStartDate(startStr)
        setEndDate(endStr)
    }

    const dateRange = eachDayOfInterval({
        start: parseISO(appliedStartDate),
        end: parseISO(appliedEndDate)
    })

    const employees = allStaff
        .filter(s => !s.isArchived)
        .filter(s => selectedStaffIds.length === 0 || selectedStaffIds.includes(s.id))
        .filter(s => selectedDeptIds.length === 0 || selectedDeptIds.includes(s.departmentId))
        .filter(s => selectedLocations.length === 0 || selectedLocations.includes(s.employmentLocation))
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
            const matchesLocation = selectedLocations.length === 0 || selectedLocations.includes(s.employmentLocation)
            const matchesQuery = s.name.toLowerCase().includes(staffSearchQuery.toLowerCase())
            return matchesDept && matchesLocation && matchesQuery
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
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
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
                        <div className="space-y-2">
                            <Label>Location</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between h-10 font-normal">
                                        <div className="flex items-center gap-2 truncate">
                                            <Globe className="h-4 w-4 text-muted-foreground" />
                                            {selectedLocations.length === 0 ? (
                                                <span className="text-muted-foreground">All Locations</span>
                                            ) : selectedLocations.length === 1 ? (
                                                <span className="truncate">{selectedLocations[0]}</span>
                                            ) : (
                                                <span>{selectedLocations.length} Selected</span>
                                            )}
                                        </div>
                                        <ChevronDown className="h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[220px] p-1" align="start">
                                    {EMPLOYMENT_LOCATIONS.map(loc => (
                                        <div
                                            key={loc}
                                            className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors"
                                            onClick={() => toggleLocationSelection(loc)}
                                        >
                                            <Checkbox
                                                id={`loc-${loc}`}
                                                checked={selectedLocations.includes(loc)}
                                                onCheckedChange={() => toggleLocationSelection(loc)}
                                            />
                                            <span className="text-sm font-medium leading-none truncate">{loc}</span>
                                        </div>
                                    ))}
                                    {selectedLocations.length > 0 && (
                                        <div className="p-1 border-t border-border mt-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-full h-8 text-xs text-primary hover:text-primary transition-colors"
                                                onClick={() => setSelectedLocations([])}
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
                            <Button
                                onClick={() => { setShowValidation(v => !v); setBulkSelectedStaffIds([]) }}
                                variant={showValidation ? "default" : "outline"}
                                size="sm"
                                className={`h-9 ${showValidation ? "bg-teal-600 hover:bg-teal-700 text-white" : ""}`}
                            >
                                <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                                Validation
                            </Button>
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
                            {appliedStartDate === appliedEndDate ? (
                                <span>{format(parseISO(appliedEndDate), "MMM dd, yyyy")}</span>
                            ) : (
                                <>
                                    <span>{format(parseISO(appliedStartDate), "MMM dd")}</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                    <span>{format(parseISO(appliedEndDate), "MMM dd, yyyy")}</span>
                                </>
                            )}
                        </div>
                    </div>

                    {showValidation && bulkSelectedStaffIds.length > 0 && (
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
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="hover:bg-transparent border-border">
                                    {showValidation && (
                                        <TableHead className="py-3 px-3 font-medium text-muted-foreground sticky left-0 bg-muted/50 z-10 w-[36px]">
                                            <Checkbox
                                                checked={employees.length > 0 && employees.every(e => bulkSelectedStaffIds.includes(e.id))}
                                                onCheckedChange={() => toggleAllBulkStaff(employees.map(e => e.id))}
                                            />
                                        </TableHead>
                                    )}
                                    <TableHead className={`py-3 px-6 font-medium text-muted-foreground sticky ${showValidation ? "left-9" : "left-0"} bg-muted/50 z-10 w-[200px]`}>Staff</TableHead>
                                    <TableHead className="py-3 px-6 font-medium text-muted-foreground">Department</TableHead>
                                    {showValidation && (
                                        <TableHead className="py-3 px-4 text-center font-medium text-muted-foreground w-[90px]">Validation</TableHead>
                                    )}
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
                                            {showValidation && (
                                                <TableCell className="py-3 px-3 sticky left-0 bg-white group-hover:bg-muted/30 z-10 w-[36px]">
                                                    <Checkbox
                                                        checked={bulkSelectedStaffIds.includes(emp.id)}
                                                        onCheckedChange={() => toggleBulkStaff(emp.id)}
                                                    />
                                                </TableCell>
                                            )}
                                            <TableCell
                                                className={`py-3 px-6 sticky ${showValidation ? "left-9" : "left-0"} bg-white group-hover:bg-muted/30 z-10 border-r border-border font-medium text-sm text-foreground cursor-pointer hover:text-primary`}
                                                onClick={() => setViewingStaff({ ...emp, stats, records: empRecs })}
                                            >
                                                {emp.name}
                                            </TableCell>
                                            <TableCell className="py-3 px-6 text-sm text-muted-foreground">
                                                {emp.dept}
                                            </TableCell>
                                            {showValidation && (() => {
                                                const summary = getValidationSummary(emp.id)
                                                const display = summary === 'NEEDS_CORRECTION'
                                                    ? { symbol: '!', className: 'text-fuchsia-600', title: 'Needs correction on at least one day' }
                                                    : summary === 'VALIDATED'
                                                    ? { symbol: '✓', className: 'text-teal-600', title: 'All days validated' }
                                                    : { symbol: '✗', className: 'text-slate-400', title: 'Not fully validated' }
                                                return (
                                                    <TableCell className="py-3 px-4 text-center">
                                                        <span className={`font-black text-base ${display.className}`} title={display.title}>{display.symbol}</span>
                                                    </TableCell>
                                                )
                                            })()}
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
                                                const dayStats = record?.clockIn ? calculateDurations([record]) : null

                                                const dotColor = isLeaveRecord ? 'bg-blue-500' : hasWork ? 'bg-green-500' : 'bg-slate-300'
                                                const dotSize = (isLeaveRecord || hasWork) ? 'h-2 w-2' : 'h-1.5 w-1.5'

                                                // Validation status now lives in the row-level Validation column — cells
                                                // only show work/break/leave/pending markers, not per-day validation dots.
                                                const cellMarker = (
                                                    <div className={`relative flex flex-col items-center justify-center gap-0.5 py-1 group/mark ${showValidation ? "cursor-pointer" : ""}`}>
                                                        {hasOverBreak && <div className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                                                        <div className={`${dotSize} rounded-full ${dotColor}`} />
                                                        {record?.validationStatus === 'NEEDS_CORRECTION' && <div className="h-1.5 w-1.5 rounded-full bg-fuchsia-500" />}
                                                        {hasPendingRequest && <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                                                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover/mark:opacity-100 transition-opacity z-20 pointer-events-none">
                                                            <div className="bg-popover border border-border rounded shadow-sm px-2 py-1.5 text-[10px] text-muted-foreground font-medium whitespace-nowrap text-left space-y-0.5 max-w-[220px]">
                                                                {record?.clockIn ? (
                                                                    <>
                                                                        <div>In: {new Date(record.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userTimeZone })}</div>
                                                                        <div>Out: {record.clockOut ? new Date(record.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userTimeZone }) : 'Still clocked in'}</div>
                                                                        <div className="font-bold text-foreground">Total: {dayStats?.workLabel}</div>
                                                                    </>
                                                                ) : isLeaveRecord ? (
                                                                    <div className="font-bold text-foreground">On Leave</div>
                                                                ) : (
                                                                    <div className="font-bold text-foreground">{showValidation ? 'No record — click to review' : 'No record'}</div>
                                                                )}
                                                                {record?.validationStatus === 'NEEDS_CORRECTION' && (
                                                                    <div className="text-fuchsia-600 font-bold whitespace-normal border-t border-border pt-1 mt-1">
                                                                        {allStaff.find(s => s.id === emp.id)?.correctionNote || 'Needs correction'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )

                                                return (
                                                    <TableCell key={date.toISOString()} className="py-3 px-2 text-center p-0">
                                                        {!isOnLeave ? (
                                                            showValidation ? (
                                                                <Popover>
                                                                    <PopoverTrigger asChild>{cellMarker}</PopoverTrigger>
                                                                    <ValidationPopoverContent
                                                                        record={record}
                                                                        staffNote={allStaff.find(s => s.id === emp.id)?.correctionNote || ''}
                                                                        onValidate={() => handleValidate(record?.id, emp.id, dateStr)}
                                                                        onFlag={(note) => handleFlagCorrection(record?.id, emp.id, dateStr, note)}
                                                                        onClear={() => handleClearValidation(record?.id, emp.id, dateStr)}
                                                                    />
                                                                </Popover>
                                                            ) : cellMarker
                                                        ) : (
                                                            <div className="h-2 w-2 rounded-full bg-blue-500 mx-auto" />
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
                                        <TableCell colSpan={dateRange.length + (showValidation ? 5 : 3)} className="py-12 text-center">
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
                                <DialogDescription>{viewingStaff?.dept} • Stats for {format(parseISO(appliedStartDate), "MMM dd")} - {format(parseISO(appliedEndDate), "MMM dd, yyyy")}</DialogDescription>
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
                    { label: showValidation ? 'No Log (click to review)' : 'No Log', color: 'bg-slate-300' },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl border border-border shadow-sm">
                        <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                        <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                    </div>
                ))}
            </div>
            {showValidation && (
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { symbol: '✓', label: 'All Validated', className: 'text-teal-600' },
                        { symbol: '!', label: 'Needs Correction', className: 'text-fuchsia-600' },
                        { symbol: '✗', label: 'Not Validated', className: 'text-slate-400' },
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl border border-border shadow-sm">
                            <span className={`font-black text-base ${item.className}`}>{item.symbol}</span>
                            <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                        </div>
                    ))}
                </div>
            )}
            <p className="text-xs text-muted-foreground">
                {showValidation
                    ? "Click a day cell to validate a record or flag it for correction. The Validation column summarizes the whole selected date range per staff member."
                    : "Read-only view — hover a day cell for clock in/out and total hours. Click \"Validation\" above to review and validate records."}
            </p>
        </div>
    )
}
