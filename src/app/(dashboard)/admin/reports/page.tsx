"use client"

import { toast } from "sonner"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Search,
    Loader2,
    Download,
    Building2,
    Database,
    MapPin,
    UserCog,
    FileSpreadsheet,
    CalendarDays,
    ToggleLeft,
    CalendarOff,
    ChevronRight
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import * as XLSX from 'xlsx'
import { format } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Users, ChevronDown } from "lucide-react"
import { AdminTimezoneSelect } from "@/components/AdminTimezoneSelect"
import { prepareTimeForExport, formatWithTimezone, getBrowserTimezone } from "@/lib/timezone"
import { useSession } from "next-auth/react"

export default function ExportPage() {
    const [selectedReport, setSelectedReport] = useState<'attendance' | 'leave' | null>(null)
    const [generating, setGenerating] = useState(false)
    const [departments, setDepartments] = useState<any[]>([])
    const [allStaff, setAllStaff] = useState<any[]>([])
    const [managers, setManagers] = useState<any[]>([])

    // Filters
    const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([])
    const [deptSearchQuery, setDeptSearchQuery] = useState("")
    const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
    const [staffSearchQuery, setStaffSearchQuery] = useState("")
    const [selectedLocation, setSelectedLocation] = useState("all")
    const [selectedManagerId, setSelectedManagerId] = useState("all")
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
    const [includeWeekends, setIncludeWeekends] = useState(false)
    const [exportSheets, setExportSheets] = useState<string[]>(['ledger', 'summary'])
    const [reportTimezone, setReportTimezone] = useState("Australia/Sydney")
    const { data: session } = useSession()

    // Attendance preview state
    const [attendanceRows, setAttendanceRows] = useState<any[]>([])
    const [attendanceSummary, setAttendanceSummary] = useState<any[]>([])
    const [attendanceLoading, setAttendanceLoading] = useState(false)
    const [attendanceLoaded, setAttendanceLoaded] = useState(false)
    const [attendanceFiltersOpen, setAttendanceFiltersOpen] = useState(true)

    // Leave filters collapsed state
    const [leaveFiltersOpen, setLeaveFiltersOpen] = useState(true)

    // Leave Records state
    const [leaveStartDate, setLeaveStartDate] = useState(format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd"))
    const [leaveEndDate, setLeaveEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [leaveRecords, setLeaveRecords] = useState<any[]>([])
    const [leaveLoading, setLeaveLoading] = useState(false)
    const [leaveExporting, setLeaveExporting] = useState(false)
    const [leaveStatus, setLeaveStatus] = useState("APPROVED")
    const [leaveDeptIds, setLeaveDeptIds] = useState<string[]>([])
    const [leaveDeptSearch, setLeaveDeptSearch] = useState("")
    const [leaveStaffIds, setLeaveStaffIds] = useState<string[]>([])
    const [leaveStaffSearch, setLeaveStaffSearch] = useState("")
    const [leaveLoaded, setLeaveLoaded] = useState(false)

    useEffect(() => {
        if (session?.user) {
            const tz = (session.user as any).useCurrentTimezone
                ? getBrowserTimezone()
                : (session.user as any).selectedTimezone || getBrowserTimezone()
            setReportTimezone(tz)
        }
    }, [session])

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const [deptRes, staffRes] = await Promise.all([
                fetch('/api/departments'),
                fetch('/api/employees')
            ])

            if (deptRes.ok) setDepartments(await deptRes.json())
            if (staffRes.ok) {
                const staffData = await staffRes.json()
                setAllStaff(staffData)
                const mgrs = staffData.filter((e: any) =>
                    e.roles?.includes('MANAGER') || e.roles?.includes('ADMIN') ||
                    staffData.some((sub: any) => sub.managerId === e.id)
                )
                setManagers(Array.from(new Map(mgrs.map((m: any) => [m.id, m])).values())
                    .sort((a: any, b: any) => a.name.localeCompare(b.name)))
            }
        } catch (error) {
            console.error("Fetch data error:", error)
        }
    }

    const filteredStaffForDropdown = allStaff
        .filter(s => {
            const matchesDept = selectedDeptIds.length === 0 ||
                selectedDeptIds.some(deptId => {
                    const deptData = departments.find(d => d.id === deptId)
                    return s.departmentId === deptId ||
                        (deptData?.name && (
                            s.department?.name?.toLowerCase().trim() === deptData.name.toLowerCase().trim() ||
                            s.departmentName?.toLowerCase().trim() === deptData.name.toLowerCase().trim()
                        ))
                })
            const matchesLocation = selectedLocation === 'all' || s.employmentLocation === selectedLocation
            const matchesQuery = s.name.toLowerCase().includes(staffSearchQuery.toLowerCase())
            return matchesDept && matchesLocation && matchesQuery
        })

    const toggleDept = (id: string) => {
        setSelectedDeptIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
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

    const toggleAllArchived = () => {
        const archivedIds = allStaff.filter(s => s.isArchived).map(s => s.id)
        if (archivedIds.every(id => selectedStaffIds.includes(id))) {
            setSelectedStaffIds(prev => prev.filter(id => !archivedIds.includes(id)))
        } else {
            setSelectedStaffIds(prev => [...new Set([...prev, ...archivedIds])])
        }
    }

    const toggleStaffSelection = (id: string) => {
        setSelectedStaffIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const setQuickRange = (range: string) => {
        const today = new Date()
        let start = new Date()
        let end = new Date()

        if (range === 'today') {
            // both today
        } else if (range === '7days') {
            start.setDate(today.getDate() - 7)
        } else if (range === '30days') {
            start.setDate(today.getDate() - 30)
        } else if (range === 'month') {
            start.setDate(1)
        } else if (range === 'lastweek') {
            const day = today.getDay()
            const diffToMon = (day === 0 ? -6 : 1 - day) - 7
            start = new Date(today)
            start.setDate(today.getDate() + diffToMon)
            end = new Date(start)
            end.setDate(start.getDate() + 6)
        } else if (range === 'thismonth') {
            start = new Date(today.getFullYear(), today.getMonth(), 1)
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        } else if (range === 'lastmonth') {
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
            end = new Date(today.getFullYear(), today.getMonth(), 0)
        } else if (range === 'ytd') {
            start = new Date(today.getFullYear(), 0, 1)
        }

        setStartDate(format(start, "yyyy-MM-dd"))
        setEndDate(format(end, "yyyy-MM-dd"))
    }

    const toggleStatus = (status: string) => {
        setSelectedStatuses(prev =>
            prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
        )
    }

    const toggleSheet = (sheet: string) => {
        setExportSheets(prev =>
            prev.includes(sheet)
                ? prev.length > 1 ? prev.filter(s => s !== sheet) : prev
                : [...prev, sheet]
        )
    }

    const calculateDurations = (recs: any[]) => {
        let workMs = 0
        let breakMs = 0
        let leaveMs = 0

        recs.forEach(r => {
            if (r.status === 'on-leave' || r.mode === 'LEAVE' || r.status === 'LEAVE') {
                leaveMs += 8 * 60 * 60 * 1000
            } else if (r.clockIn) {
                const clockIn = new Date(r.clockIn).getTime()
                const clockOut = r.clockOut ? new Date(r.clockOut).getTime() :
                    (new Date(r.date).toDateString() === new Date().toDateString() ? new Date().getTime() : 0)

                if (clockOut > clockIn) {
                    let dayBreakMs = 0
                    r.breaks?.forEach((b: any) => {
                        const start = new Date(b.startTime).getTime()
                        const end = b.endTime ? new Date(b.endTime).getTime() :
                            (new Date(r.date) >= new Date() ? new Date().getTime() : start)
                        dayBreakMs += Math.max(0, end - start)
                    })

                    workMs += (clockOut - clockIn) - dayBreakMs
                    breakMs += dayBreakMs
                }
            }
        })

        return { workMs, breakMs, leaveMs }
    }

    const handleRunAttendance = async () => {
        setAttendanceLoading(true)
        setAttendanceLoaded(true)
        setAttendanceRows([])
        setAttendanceSummary([])
        try {
            const deptParam = selectedDeptIds.length === 1 ? `&departmentId=${selectedDeptIds[0]}` : ''
            const res = await fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}${deptParam}`)
            if (!res.ok) throw new Error("Failed to fetch")
            const rawData = await res.json()

            let targetStaff = allStaff.filter(s => !s.isArchived)
            if (selectedStaffIds.length > 0) {
                targetStaff = allStaff.filter(s => selectedStaffIds.includes(s.id))
            } else {
                if (selectedDeptIds.length > 0) targetStaff = targetStaff.filter(s => selectedDeptIds.some(deptId => s.departmentId === deptId))
                if (selectedLocation !== 'all') targetStaff = targetStaff.filter(s => s.employmentLocation === selectedLocation)
                if (selectedManagerId !== 'all') targetStaff = targetStaff.filter(s => s.managerId === selectedManagerId)
            }
            const targetIds = new Set(targetStaff.map(s => s.id))

            const data = rawData.filter((r: any) => {
                if (!targetIds.has(r.userId)) return false
                if (!includeWeekends) { const day = new Date(r.date + 'T12:00:00Z').getUTCDay(); if (day === 0 || day === 6) return false }
                return true
            })

            const allDates: string[] = []
            const cur = new Date(startDate + 'T12:00:00Z')
            const rangeEnd = new Date(endDate + 'T12:00:00Z')
            while (cur <= rangeEnd) {
                const day = cur.getUTCDay()
                if (includeWeekends || (day !== 0 && day !== 6)) allDates.push(cur.toISOString().split('T')[0])
                cur.setUTCDate(cur.getUTCDate() + 1)
            }

            const presentKeys = new Set(data.map((r: any) => `${r.userId}|${r.date}`))
            const absentRows: any[] = []
            for (const staff of targetStaff) {
                for (const date of allDates) {
                    if (!presentKeys.has(`${staff.id}|${date}`)) {
                        absentRows.push({ userId: staff.id, userName: staff.name, department: staff.department?.name || 'Unassigned', date, clockIn: null, clockOut: null, breaks: [], status: 'ABSENT', mode: null })
                    }
                }
            }

            const allRecords = [...data, ...absentRows].sort((a, b) => {
                if (a.userName < b.userName) return -1
                if (a.userName > b.userName) return 1
                return a.date.localeCompare(b.date)
            })

            const rows = allRecords.map((r: any) => {
                const isAbsent = r.status === 'ABSENT'
                const stats = isAbsent ? { workMs: 0 } : calculateDurations([r])
                const status = isAbsent ? 'ABSENT' : (r.status === 'on-leave' || r.mode === 'LEAVE' ? 'LEAVE' : 'PRESENT')
                return {
                    employee: r.userName,
                    department: r.department,
                    date: r.date,
                    status,
                    clockIn: r.clockIn ? new Date(r.clockIn).toLocaleTimeString('en-US', { timeZone: reportTimezone, hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
                    clockOut: r.clockOut ? new Date(r.clockOut).toLocaleTimeString('en-US', { timeZone: reportTimezone, hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
                    workHours: stats.workMs > 0 ? Number((stats.workMs / 3600000).toFixed(2)) : 0,
                    location: r.mode || '-',
                    _raw: r,
                }
            })

            const filtered = selectedStatuses.length === 0 ? rows : rows.filter(r => selectedStatuses.includes(r.status))

            const summary = targetStaff.map(staff => {
                const empRecs = data.filter((r: any) => r.userId === staff.id)
                const stats = calculateDurations(empRecs)
                return {
                    employee: staff.name,
                    department: staff.department?.name || 'Unassigned',
                    location: staff.employmentLocation || '-',
                    totalDays: allDates.length,
                    daysWorked: empRecs.filter((r: any) => r.clockIn).length,
                    daysAbsent: Math.max(0, allDates.length - empRecs.filter((r: any) => r.clockIn).length - empRecs.filter((r: any) => r.status === 'on-leave' || r.mode === 'LEAVE').length),
                    daysLeave: empRecs.filter((r: any) => r.status === 'on-leave' || r.mode === 'LEAVE').length,
                    totalWorkHours: Number((stats.workMs / 3600000).toFixed(2)),
                }
            }).sort((a, b) => a.employee.localeCompare(b.employee))

            setAttendanceRows(filtered)
            setAttendanceSummary(summary)
            setAttendanceFiltersOpen(false)
        } catch {
            toast.error("Failed to load attendance data")
        } finally {
            setAttendanceLoading(false)
        }
    }

    const handleExport = () => {
        if (attendanceRows.length === 0 && attendanceSummary.length === 0) {
            toast.error("Run the report first before exporting.")
            return
        }
        setGenerating(true)
        try {
            const wb = XLSX.utils.book_new()

            if (exportSheets.includes('ledger') && attendanceRows.length > 0) {
                const ledgerData = attendanceRows.map(r => ({
                    'Employee': r.employee,
                    'Department': r.department,
                    'Date': r.date,
                    'Status': r.status,
                    'Clock In': r.clockIn,
                    'Clock Out': r.clockOut,
                    'Work Hours': r.workHours,
                    'Work Location': r.location,
                }))
                const ws = XLSX.utils.json_to_sheet(ledgerData)
                ws['!cols'] = Object.keys(ledgerData[0] || {}).map(k => ({ wch: Math.max(k.length, 15) }))
                XLSX.utils.book_append_sheet(wb, ws, 'Master Ledger')
            }

            if (exportSheets.includes('summary') && attendanceSummary.length > 0) {
                const summaryData = attendanceSummary.map(r => ({
                    'Employee': r.employee,
                    'Department': r.department,
                    'Employment Location': r.location,
                    'Total Days': r.totalDays,
                    'Days Worked': r.daysWorked,
                    'Days Absent': r.daysAbsent,
                    'Days Leave': r.daysLeave,
                    'Total Work Hours': r.totalWorkHours,
                }))
                const ws = XLSX.utils.json_to_sheet(summaryData)
                ws['!cols'] = Object.keys(summaryData[0] || {}).map(k => ({ wch: Math.max(k.length, 18) }))
                XLSX.utils.book_append_sheet(wb, ws, 'Finance Summary')
            }

            if (wb.SheetNames.length === 0) { toast.error("No data to export."); return }
            XLSX.writeFile(wb, `REDADAIR_ATTENDANCE_${startDate}_${endDate}.xlsx`)
        } catch {
            toast.error("Export failed.")
        } finally {
            setGenerating(false)
        }
    }

    const fetchLeaveRecords = async () => {
        setLeaveLoading(true)
        setLeaveLoaded(true)
        setLeaveFiltersOpen(false)
        try {
            const params = new URLSearchParams({ startDate: leaveStartDate, endDate: leaveEndDate })
            if (leaveStatus !== 'all') params.set('status', leaveStatus)
            if (leaveDeptIds.length === 1) params.set('departmentId', leaveDeptIds[0])
            if (leaveStaffIds.length > 0) params.set('userIds', leaveStaffIds.join(','))
            const res = await fetch(`/api/leaves?${params}`)
            if (!res.ok) throw new Error('Failed to fetch')
            const data = await res.json()
            setLeaveRecords(data.leaves || [])
        } catch {
            toast.error('Failed to load leave records')
        } finally {
            setLeaveLoading(false)
        }
    }

    const handleLeaveExport = async () => {
        if (leaveRecords.length === 0) { toast.error('No records to export'); return }
        setLeaveExporting(true)
        try {
            const rows = leaveRecords.map((r: any) => ({
                'Employee': r.user?.name || '-',
                'Department': r.user?.department?.name || 'Unassigned',
                'Leave Type': r.type || '-',
                'Status': r.status || '-',
                'Start Date': r.startDate ? format(new Date(r.startDate), 'yyyy-MM-dd') : '-',
                'End Date': r.endDate ? format(new Date(r.endDate), 'yyyy-MM-dd') : '-',
                'Duration': r.duration || '-',
                'Reason': r.reason || '-',
            }))
            const wb = XLSX.utils.book_new()
            const ws = XLSX.utils.json_to_sheet(rows)
            ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 16) }))
            XLSX.utils.book_append_sheet(wb, ws, 'Leave Records')
            XLSX.writeFile(wb, `REDADAIR_LEAVE_RECORDS_${leaveStartDate}_${leaveEndDate}.xlsx`)
        } catch {
            toast.error('Export failed')
        } finally {
            setLeaveExporting(false)
        }
    }

    const leaveFilteredStaff = allStaff.filter(s => {
        const matchesDept = leaveDeptIds.length === 0 || leaveDeptIds.includes(s.departmentId)
        const matchesSearch = s.name.toLowerCase().includes(leaveStaffSearch.toLowerCase())
        return matchesDept && matchesSearch && !s.isArchived
    })

    const REPORTS = [
        {
            id: 'attendance' as const,
            icon: FileSpreadsheet,
            name: 'Attendance Report',
            description: 'Daily attendance ledger with clock-in/out times, work hours, work location, and absence records. Includes a Finance Summary sheet for payroll.',
        },
        {
            id: 'leave' as const,
            icon: CalendarOff,
            name: 'Leave Records',
            description: 'View and export leave requests by date range. Filter by status, department, and staff. Supports approved, pending, and declined records.',
        },
    ]

    return (
        <div className="w-full mx-auto animate-in fade-in duration-500 pb-10 px-4 lg:px-8">

            {/* ── Report Index ─────────────────────────────────────── */}
            {!selectedReport && (
                <div className="space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">Reports</h1>
                        <p className="text-muted-foreground text-sm mt-1">Select a report to configure filters and generate an export</p>
                    </div>

                    <div className="rounded-xl border border-border overflow-hidden bg-white shadow-sm">
                        <div className="grid grid-cols-[1fr_2fr_auto] text-xs font-bold uppercase tracking-widest text-muted-foreground bg-muted/30 border-b border-border px-6 py-3 gap-6">
                            <span>Report</span>
                            <span>Description</span>
                            <span></span>
                        </div>
                        {REPORTS.map((report, i) => {
                            const Icon = report.icon
                            return (
                                <div key={report.id} className={`grid grid-cols-[1fr_2fr_auto] items-center gap-6 px-6 py-5 hover:bg-muted/20 transition-colors ${i < REPORTS.length - 1 ? 'border-b border-border' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <Icon className="h-4 w-4 text-primary" />
                                        </div>
                                        <span className="font-semibold text-sm text-foreground">{report.name}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{report.description}</p>
                                    <Button
                                        size="sm"
                                        onClick={() => setSelectedReport(report.id)}
                                        className="bg-primary hover:bg-primary/90 text-white gap-1.5 whitespace-nowrap"
                                    >
                                        <ChevronRight className="h-3.5 w-3.5" />
                                        Run Report
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── Attendance Report ─────────────────────────────────── */}
            {selectedReport === 'attendance' && (
            <div className="space-y-0">
                {/* Page header */}
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setSelectedReport(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                        ← All Reports
                    </button>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-sm font-semibold text-foreground">Attendance Report</span>
                </div>

            <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                <CardHeader className="p-0 border-b border-border">
                    <button
                        onClick={() => setAttendanceFiltersOpen(v => !v)}
                        className="w-full bg-primary px-6 py-4 text-left flex items-center justify-between"
                    >
                        <div>
                            <CardTitle className="text-base font-bold text-white">Report Filters</CardTitle>
                            <CardDescription className="text-white/70 text-xs mt-0.5">
                                {attendanceFiltersOpen ? 'Configure filters then run report' : 'Click to expand filters'}
                            </CardDescription>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-white/80 transition-transform ${attendanceFiltersOpen ? '' : '-rotate-90'}`} />
                    </button>
                </CardHeader>
                {attendanceFiltersOpen && <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => {
                                    if (e.target.value < startDate) {
                                        toast.error("End Data cannot be earlier than Start Date")
                                        return
                                    }
                                    setEndDate(e.target.value)
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Department</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between h-10 font-normal">
                                        <div className="flex items-center gap-2 truncate">
                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                            {selectedDeptIds.length === 0 ? (
                                                <span className="text-muted-foreground">All Departments</span>
                                            ) : selectedDeptIds.length === 1 ? (
                                                <span className="truncate">{departments.find(d => d.id === selectedDeptIds[0])?.name}</span>
                                            ) : (
                                                <span>{selectedDeptIds.length} Departments</span>
                                            )}
                                        </div>
                                        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[260px] p-0" align="start">
                                    <div className="p-2 border-b border-border">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                            <Input
                                                placeholder="Search departments..."
                                                className="pl-8 h-8 text-xs"
                                                value={deptSearchQuery}
                                                onChange={e => setDeptSearchQuery(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-[240px] overflow-y-auto p-1">
                                        {departments
                                            .filter(d => d.name?.toLowerCase().includes(deptSearchQuery.toLowerCase()))
                                            .map(dept => (
                                                <div
                                                    key={dept.id}
                                                    className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors"
                                                    onClick={() => toggleDept(dept.id)}
                                                >
                                                    <Checkbox
                                                        checked={selectedDeptIds.includes(dept.id)}
                                                        onCheckedChange={() => toggleDept(dept.id)}
                                                        className="pointer-events-none"
                                                    />
                                                    <span className="text-sm font-medium truncate">{dept.name}</span>
                                                </div>
                                            ))}
                                    </div>
                                    {selectedDeptIds.length > 0 && (
                                        <div className="p-2 border-t border-border">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-full h-8 text-xs text-primary hover:text-primary"
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
                            <Label>Employment Location</Label>
                            <Select value={selectedLocation} onValueChange={val => {
                                setSelectedLocation(val)
                                setSelectedStaffIds([])
                            }}>
                                <SelectTrigger className="h-10">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                        <SelectValue placeholder="All Locations" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Locations</SelectItem>
                                    <SelectItem value="Philippines">Philippines</SelectItem>
                                    <SelectItem value="Australia">Australia</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <AdminTimezoneSelect
                            value={reportTimezone}
                            onChange={setReportTimezone}
                            label="Report Timezone"
                            className=""
                        />
                        <div className="space-y-2">
                            <Label>Manager</Label>
                            <Select value={selectedManagerId} onValueChange={val => {
                                setSelectedManagerId(val)
                                setSelectedStaffIds([])
                            }}>
                                <SelectTrigger className="h-10">
                                    <div className="flex items-center gap-2">
                                        <UserCog className="h-4 w-4 text-muted-foreground" />
                                        <SelectValue placeholder="All Managers" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Managers</SelectItem>
                                    {managers.map((m: any) => (
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-2">
                        <Label>Attendance Status Filter</Label>
                        <p className="text-xs text-muted-foreground">Select which statuses to include in the Master Ledger. Leave all unchecked to include everything.</p>
                        <div className="flex flex-wrap gap-3 pt-1">
                            {[
                                { id: 'PRESENT', label: 'Present', color: 'text-green-700 bg-green-50 border-green-200' },
                                { id: 'ABSENT', label: 'Absent', color: 'text-red-700 bg-red-50 border-red-200' },
                                { id: 'LEAVE', label: 'On Leave', color: 'text-blue-700 bg-blue-50 border-blue-200' },
                            ].map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => toggleStatus(s.id)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm font-medium select-none ${selectedStatuses.includes(s.id) ? s.color + ' shadow-sm' : 'border-border text-muted-foreground bg-white hover:bg-muted/40'}`}
                                >
                                    <Checkbox
                                        checked={selectedStatuses.includes(s.id)}
                                        onCheckedChange={() => toggleStatus(s.id)}
                                        className="pointer-events-none"
                                    />
                                    {s.label}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Include Weekends + Sheet Selector */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Weekend Rows</Label>
                            <div
                                onClick={() => setIncludeWeekends(p => !p)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all select-none ${includeWeekends ? 'bg-primary/5 border-primary/30 text-primary' : 'bg-white border-border text-muted-foreground hover:bg-muted/40'}`}
                            >
                                <ToggleLeft className="h-4 w-4 shrink-0" />
                                <div>
                                    <p className="text-sm font-medium">{includeWeekends ? 'Weekends included' : 'Weekends excluded'}</p>
                                    <p className="text-xs opacity-70">Click to toggle Sat &amp; Sun rows</p>
                                </div>
                                <Checkbox checked={includeWeekends} onCheckedChange={() => setIncludeWeekends(p => !p)} className="ml-auto pointer-events-none" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Export Sheets</Label>
                            <div className="flex gap-3">
                                {[
                                    { id: 'ledger', label: 'Master Ledger', icon: FileSpreadsheet },
                                    { id: 'summary', label: 'Finance Summary', icon: CalendarDays },
                                ].map(sheet => {
                                    const Icon = sheet.icon
                                    return (
                                        <div
                                            key={sheet.id}
                                            onClick={() => toggleSheet(sheet.id)}
                                            className={`flex items-center gap-2 flex-1 px-3 py-3 rounded-lg border cursor-pointer transition-all select-none text-sm font-medium ${exportSheets.includes(sheet.id) ? 'bg-primary/5 border-primary/30 text-primary shadow-sm' : 'bg-white border-border text-muted-foreground hover:bg-muted/40'}`}
                                        >
                                            <Checkbox checked={exportSheets.includes(sheet.id)} onCheckedChange={() => toggleSheet(sheet.id)} className="pointer-events-none" />
                                            <Icon className="h-4 w-4 shrink-0" />
                                            {sheet.label}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
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




                    <div className="space-y-3">
                        <Label>Quick Presets</Label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'today', label: 'Today' },
                                { id: '7days', label: 'Last 7 Days' },
                                { id: '30days', label: 'Last 30 Days' },
                                { id: 'lastweek', label: 'Last Week' },
                                { id: 'month', label: 'Month to Date' },
                                { id: 'thismonth', label: 'This Month' },
                                { id: 'lastmonth', label: 'Last Month' },
                                { id: 'ytd', label: 'Year to Date' },
                            ].map(range => (
                                <Button
                                    key={range.id}
                                    onClick={() => setQuickRange(range.id)}
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs font-medium"
                                >
                                    {range.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                </CardContent>}

                {/* Run button always visible */}
                <div className="flex items-center gap-3 px-6 py-4 border-t border-border bg-muted/10">
                    <Button
                        onClick={handleRunAttendance}
                        disabled={attendanceLoading}
                        className="bg-primary hover:bg-primary/90 text-white gap-2"
                    >
                        {attendanceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                        {attendanceLoading ? 'Loading...' : 'Run Report'}
                    </Button>
                </div>
            </Card>

            {/* Results table */}
            {attendanceLoaded && !attendanceLoading && (
                <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white mt-6">
                    <CardHeader className="p-4 border-b border-border bg-muted/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-sm font-bold text-foreground">Report Results</CardTitle>
                                <CardDescription className="text-xs mt-0.5">{attendanceRows.length} records · {startDate} to {endDate}</CardDescription>
                            </div>
                            {attendanceRows.length > 0 && (
                                <Button onClick={handleExport} disabled={generating} size="sm" variant="outline" className="gap-1.5">
                                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                    Export to Excel
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {attendanceRows.length === 0 ? (
                            <div className="p-8 text-center text-sm text-muted-foreground">No records found for the selected filters.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/40 border-b border-border">
                                        <tr>
                                            {['Employee', 'Department', 'Date', 'Status', 'Clock In', 'Clock Out', 'Work Hours', 'Location'].map(h => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {attendanceRows.map((r, i) => (
                                            <tr key={i} className="hover:bg-muted/20 transition-colors">
                                                <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{r.employee}</td>
                                                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.department}</td>
                                                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.date}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${r.status === 'PRESENT' ? 'bg-green-50 text-green-700 border-green-200' : r.status === 'ABSENT' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{r.status}</span>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.clockIn}</td>
                                                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.clockOut}</td>
                                                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.workHours > 0 ? `${r.workHours}h` : '-'}</td>
                                                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.location}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            </div>
            )}

            {/* ── Leave Records Report ──────────────────────────────── */}
            {selectedReport === 'leave' && (
            <div className="space-y-0">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setSelectedReport(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                        ← All Reports
                    </button>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-sm font-semibold text-foreground">Leave Records</span>
                </div>

            <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                <CardHeader className="p-0 border-b border-border">
                    <button
                        onClick={() => setLeaveFiltersOpen(v => !v)}
                        className="w-full bg-primary px-6 py-4 text-left flex items-center justify-between"
                    >
                        <div>
                            <CardTitle className="text-base font-bold text-white">Report Filters</CardTitle>
                            <CardDescription className="text-white/70 text-xs mt-0.5">
                                {leaveFiltersOpen ? 'Configure filters then load records' : 'Click to expand filters'}
                            </CardDescription>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-white/80 transition-transform ${leaveFiltersOpen ? '' : '-rotate-90'}`} />
                    </button>
                </CardHeader>
                {leaveFiltersOpen && <CardContent className="p-6 space-y-6">
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input type="date" value={leaveStartDate} onChange={e => setLeaveStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input type="date" value={leaveEndDate} onChange={e => {
                                if (e.target.value < leaveStartDate) { toast.error('End date cannot be before start date'); return }
                                setLeaveEndDate(e.target.value)
                            }} />
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={leaveStatus} onValueChange={setLeaveStatus}>
                                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="APPROVED">Approved</SelectItem>
                                    <SelectItem value="PENDING">Pending</SelectItem>
                                    <SelectItem value="DECLINED">Declined</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Department</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between h-10 font-normal">
                                        <div className="flex items-center gap-2 truncate">
                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                            {leaveDeptIds.length === 0 ? (
                                                <span className="text-muted-foreground">All Departments</span>
                                            ) : leaveDeptIds.length === 1 ? (
                                                <span className="truncate">{departments.find(d => d.id === leaveDeptIds[0])?.name}</span>
                                            ) : (
                                                <span>{leaveDeptIds.length} Departments</span>
                                            )}
                                        </div>
                                        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[260px] p-0" align="start">
                                    <div className="p-2 border-b border-border">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                            <Input
                                                placeholder="Search departments..."
                                                className="pl-8 h-8 text-xs"
                                                value={leaveDeptSearch}
                                                onChange={e => setLeaveDeptSearch(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-[240px] overflow-y-auto p-1">
                                        {departments
                                            .filter(d => d.name?.toLowerCase().includes(leaveDeptSearch.toLowerCase()))
                                            .map(dept => (
                                                <div
                                                    key={dept.id}
                                                    className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors"
                                                    onClick={() => {
                                                        setLeaveDeptIds(prev => prev.includes(dept.id) ? prev.filter(i => i !== dept.id) : [...prev, dept.id])
                                                        setLeaveStaffIds([])
                                                    }}
                                                >
                                                    <Checkbox
                                                        checked={leaveDeptIds.includes(dept.id)}
                                                        onCheckedChange={() => {
                                                            setLeaveDeptIds(prev => prev.includes(dept.id) ? prev.filter(i => i !== dept.id) : [...prev, dept.id])
                                                            setLeaveStaffIds([])
                                                        }}
                                                        className="pointer-events-none"
                                                    />
                                                    <span className="text-sm font-medium truncate">{dept.name}</span>
                                                </div>
                                            ))}
                                    </div>
                                    {leaveDeptIds.length > 0 && (
                                        <div className="p-2 border-t border-border">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-full h-8 text-xs text-primary hover:text-primary"
                                                onClick={() => { setLeaveDeptIds([]); setLeaveStaffIds([]) }}
                                            >
                                                Clear Selection
                                            </Button>
                                        </div>
                                    )}
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Staff filter */}
                    <div className="space-y-2">
                        <Label>Staff Filter</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-between h-10 font-normal">
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        {leaveStaffIds.length === 0 ? <span className="text-muted-foreground">All Staff</span> : <span>{leaveStaffIds.length} Selected</span>}
                                    </div>
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[280px] p-0" align="start">
                                <div className="p-2 border-b">
                                    <div className="relative">
                                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input placeholder="Search staff..." className="pl-8 h-8 text-xs" value={leaveStaffSearch} onChange={e => setLeaveStaffSearch(e.target.value)} />
                                    </div>
                                </div>
                                <div className="max-h-[260px] overflow-y-auto p-1">
                                    {leaveFilteredStaff.map(s => (
                                        <div key={s.id} className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer" onClick={() => setLeaveStaffIds(prev => prev.includes(s.id) ? prev.filter(i => i !== s.id) : [...prev, s.id])}>
                                            <Checkbox checked={leaveStaffIds.includes(s.id)} />
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-medium truncate">{s.name}</span>
                                                <span className="text-[10px] text-muted-foreground truncate">{s.department?.name || 'No Dept'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {leaveStaffIds.length > 0 && (
                                    <div className="p-2 border-t">
                                        <Button variant="ghost" size="sm" className="w-full h-8 text-xs text-primary" onClick={() => setLeaveStaffIds([])}>Clear Selection</Button>
                                    </div>
                                )}
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Quick presets */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'thismonth', label: 'This Month' },
                            { id: 'lastmonth', label: 'Last Month' },
                            { id: 'ytd', label: 'Year to Date' },
                            { id: '30days', label: 'Last 30 Days' },
                        ].map(r => (
                            <Button key={r.id} variant="outline" size="sm" className="h-8 text-xs"
                                onClick={() => {
                                    const today = new Date()
                                    let s = new Date(), e = new Date()
                                    if (r.id === 'thismonth') { s = new Date(today.getFullYear(), today.getMonth(), 1); e = new Date(today.getFullYear(), today.getMonth() + 1, 0) }
                                    else if (r.id === 'lastmonth') { s = new Date(today.getFullYear(), today.getMonth() - 1, 1); e = new Date(today.getFullYear(), today.getMonth(), 0) }
                                    else if (r.id === 'ytd') { s = new Date(today.getFullYear(), 0, 1) }
                                    else if (r.id === '30days') { s.setDate(today.getDate() - 30) }
                                    setLeaveStartDate(format(s, 'yyyy-MM-dd'))
                                    setLeaveEndDate(format(e, 'yyyy-MM-dd'))
                                }}>
                                {r.label}
                            </Button>
                        ))}
                    </div>

                </CardContent>}

                {/* Run button always visible */}
                <div className="flex items-center gap-3 px-6 py-4 border-t border-border bg-muted/10">
                    <Button onClick={fetchLeaveRecords} disabled={leaveLoading} className="bg-primary hover:bg-primary/90 text-white gap-2">
                        {leaveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                        {leaveLoading ? 'Loading...' : 'Run Report'}
                    </Button>
                </div>
            </Card>

            {/* Results table */}
            {leaveLoaded && !leaveLoading && (
                <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white mt-6">
                    <CardHeader className="p-4 border-b border-border bg-muted/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-sm font-bold text-foreground">Report Results</CardTitle>
                                <CardDescription className="text-xs mt-0.5">{leaveRecords.length} records · {leaveStartDate} to {leaveEndDate}</CardDescription>
                            </div>
                            {leaveRecords.length > 0 && (
                                <Button variant="outline" size="sm" onClick={handleLeaveExport} disabled={leaveExporting} className="gap-1.5">
                                    {leaveExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                    Export to Excel
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                    {leaveLoaded && !leaveLoading && (
                        <div className="rounded-lg border border-border overflow-hidden">
                            {leaveRecords.length === 0 ? (
                                <div className="p-8 text-center text-sm text-muted-foreground">No leave records found for the selected filters.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/40 border-b border-border">
                                            <tr>
                                                {['Employee', 'Department', 'Type', 'Status', 'Start Date', 'End Date', 'Duration', 'Reason'].map(h => (
                                                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {leaveRecords.map((r: any) => (
                                                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{r.user?.name || '-'}</td>
                                                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.user?.department?.name || 'Unassigned'}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">{r.type}</span>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${r.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' : r.status === 'DECLINED' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>{r.status}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.startDate ? format(new Date(r.startDate), 'dd MMM yyyy') : '-'}</td>
                                                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.endDate ? format(new Date(r.endDate), 'dd MMM yyyy') : '-'}</td>
                                                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.duration || '-'}</td>
                                                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{r.reason || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                    </CardContent>
                </Card>
            )}
            </div>
            )}
        </div>
    )
}
