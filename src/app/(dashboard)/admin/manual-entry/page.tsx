"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Clock,
    Calendar as CalendarIcon,
    User,
    MapPin,
    FileText,
    Coffee,
    Plus,
    Search,
    Trash2,
    Edit2,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Building,
    ArrowRight,
    Flame,
    Zap,
    ShieldCheck,
    MoreHorizontal,
    Check,
    X
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { format, parseISO } from "date-fns"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { getBrowserTimezone } from "@/lib/timezone"

type TabType = 'attendance' | 'leaves' | 'breaks'
type ModeType = 'create' | 'list'

export default function ManualEntryPage() {
    const [activeTab, setActiveTab] = useState<TabType>('attendance')
    const [activeMode, setActiveMode] = useState<ModeType>('create')
    const { data: session } = useSession()

    // Timezone Logic
    const userTimeZone = (session?.user as any)?.useCurrentTimezone
        ? getBrowserTimezone()
        : (session?.user as any)?.selectedTimezone || "Asia/Manila"

    // Core Data
    const [employees, setEmployees] = useState<any[]>([])
    const [departments, setDepartments] = useState<any[]>([])
    const [records, setRecords] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')

    // Filter States for Lists
    const [filterDept, setFilterDept] = useState("all")
    const [filterEmp, setFilterEmp] = useState("all")
    const [filterQuery, setFilterQuery] = useState("")
    const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"))

    // Form States - Attendance
    const [attEmpId, setAttEmpId] = useState("")
    const [attDate, setAttDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [attIn, setAttIn] = useState("09:00")
    const [attOut, setAttOut] = useState("18:00")
    const [attMode, setAttMode] = useState("OFFICE")

    // Form States - Leave
    const [lvEmpId, setLvEmpId] = useState("")
    const [lvStart, setLvStart] = useState(format(new Date(), "yyyy-MM-dd"))
    const [lvEnd, setLvEnd] = useState(format(new Date(), "yyyy-MM-dd"))
    const [lvType, setLvType] = useState("SICK")
    const [lvDuration, setLvDuration] = useState("Full Day")
    const [lvStartTime, setLvStartTime] = useState("09:00")
    const [lvEndTime, setLvEndTime] = useState("13:00")
    const [lvReason, setLvReason] = useState("")

    // Form States - Breaks
    const [brEmpId, setBrEmpId] = useState("")
    const [brDate, setBrDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [brIn, setBrIn] = useState("12:00")
    const [brOut, setBrOut] = useState("13:00")

    // Form Filter States
    const [formDeptId, setFormDeptId] = useState("all")

    // Editing States
    const [editingRecord, setEditingRecord] = useState<any | null>(null)
    const [editForm, setEditForm] = useState<any>({})
    const [editingBreakId, setEditingBreakId] = useState<string | null>(null)
    const [breakEditForm, setBreakEditForm] = useState<any>(null)

    useEffect(() => {
        fetchInitialData()
    }, [])

    useEffect(() => {
        if (activeMode === 'list') {
            fetchRecords()
        }
    }, [activeMode, activeTab, filterDept, filterEmp, startDate, endDate])

    const fetchInitialData = async () => {
        setLoading(true)
        try {
            const [empRes, deptRes] = await Promise.all([
                fetch('/api/employees'),
                fetch('/api/departments')
            ])
            if (empRes.ok) setEmployees(await empRes.json())
            if (deptRes.ok) setDepartments(await deptRes.json())
        } finally {
            setLoading(false)
        }
    }

    const fetchRecords = async () => {
        setLoading(true)
        try {
            let url = `/api/${activeTab}?`
            if (activeTab === 'attendance') {
                url += `startDate=${startDate}&endDate=${endDate}&departmentId=${filterDept}&userId=${filterEmp === 'all' ? '' : filterEmp}`
            } else if (activeTab === 'leaves') {
                url += `startDate=${startDate}&endDate=${endDate}&departmentId=${filterDept}`
            } else if (activeTab === 'breaks') {
                url += `startDate=${startDate}&endDate=${endDate}&userId=${filterEmp === 'all' ? '' : filterEmp}`
            }

            const res = await fetch(url)
            if (res.ok) setRecords(await res.json())
        } finally {
            setLoading(false)
        }
    }

    // Unified Time Formatting Helpers
    const formatTime = (dateStr: string | null | undefined, options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false }) => {
        if (!dateStr) return '---'
        try {
            return new Date(dateStr).toLocaleTimeString('en-US', { ...options, timeZone: userTimeZone })
        } catch (e) { return '---' }
    }

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '---'
        try {
            // Check if string is just a date like YYYY-MM-DD
            if (dateStr.length === 10 && dateStr.includes('-')) {
                // Return just the date string as is for display if straightforward, or format it
                return new Date(dateStr).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
            }
            return new Date(dateStr).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: userTimeZone })
        } catch (e) { return '---' }
    }

    const handleAttendanceSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (attOut && attOut < attIn) {
            alert("Clock Out time cannot be earlier than Clock In time.")
            return
        }

        setProcessing(true)
        try {
            // Use standard Date construction which uses system/browser timezone
            // This assumes the admin inputs time in their local system time
            const clockIn = new Date(`${attDate}T${attIn}:00`)
            const clockOut = attOut ? new Date(`${attDate}T${attOut}:00`) : null
            const dateObj = new Date(attDate)

            const res = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: attEmpId,
                    date: dateObj.toISOString(),
                    clockIn: clockIn.toISOString(),
                    clockOut: clockOut?.toISOString(),
                    mode: attMode
                })
            })
            if (res.ok) showStatus('success')
            else showStatus('error')
        } catch { showStatus('error') }
        finally { setProcessing(false) }
    }

    const showStatus = (s: 'success' | 'error') => {
        setStatus(s)
        setTimeout(() => setStatus('idle'), 3000)
    }

    const handleLeaveSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!lvEmpId) {
            toast.error("Please select a staff member first")
            return
        }

        if (lvStart && lvEnd && new Date(lvEnd) < new Date(lvStart)) {
            toast.error("End date cannot be earlier than start date.")
            return
        }

        setProcessing(true)
        try {
            const res = await fetch('/api/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: lvEmpId,
                    startDate: lvStart,
                    endDate: lvEnd,
                    type: lvType,
                    reason: lvReason,
                    duration: lvDuration,
                    status: 'APPROVED',
                    startTime: lvDuration !== 'Full Day' ? new Date(`${lvStart}T${lvStartTime}:00`).toISOString() : null,
                    endTime: lvDuration !== 'Full Day' ? new Date(`${lvStart}T${lvEndTime}:00`).toISOString() : null
                })
            })
            if (res.ok) showStatus('success')
            else showStatus('error')
        } catch { showStatus('error') }
        finally { setProcessing(false) }
    }

    const handleBreakSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (brOut && brOut < brIn) {
            alert("Session End time cannot be earlier than Session Start time.")
            return
        }

        setProcessing(true)
        try {
            // Use standard Date construction
            const startTime = new Date(`${brDate}T${brIn}:00`)
            const endTime = brOut ? new Date(`${brDate}T${brOut}:00`) : null

            const res = await fetch('/api/breaks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: brEmpId,
                    date: new Date(brDate).toISOString(),
                    startTime: startTime.toISOString(),
                    endTime: endTime?.toISOString()
                })
            })
            if (res.ok) showStatus('success')
            else showStatus('error')
        } catch { showStatus('error') }
        finally { setProcessing(false) }
    }

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setProcessing(true)
        try {
            // Validate break sessions for attendance edits
            if (activeTab === 'attendance' && editForm.breaks && editForm.breaks.length > 0) {
                const clockInTime = editForm.clockIn ? new Date(editForm.clockIn).getTime() : null
                const clockOutTime = editForm.clockOut ? new Date(editForm.clockOut).getTime() : null

                // Check if any break sessions fall outside the new clock in/out timeframe
                const invalidBreaks = editForm.breaks.filter((breakSession: any) => {
                    const breakStart = new Date(breakSession.startTime).getTime()
                    const breakEnd = breakSession.endTime ? new Date(breakSession.endTime).getTime() : null

                    if (clockInTime && breakStart < clockInTime) return true
                    if (clockOutTime && breakEnd && breakEnd > clockOutTime) return true
                    if (clockOutTime && !breakEnd && breakStart > clockOutTime) return true

                    return false
                })

                if (invalidBreaks.length > 0) {
                    const proceed = confirm(
                        `⚠️ WARNING: ${invalidBreaks.length} break session(s) fall outside the new clock in/out timeframe.\n\n` +
                        `These break sessions may become invalid after this change.\n\n` +
                        `Do you want to proceed? You may need to manually adjust or remove these break sessions.`
                    )

                    if (!proceed) {
                        setProcessing(false)
                        return
                    }

                    toast.warning(`${invalidBreaks.length} break session(s) may need adjustment`, {
                        position: 'top-right',
                        duration: 5000
                    })
                }
            }

            const endpoint = `/api/${activeTab}/${editingRecord.id}`
            const res = await fetch(endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            })

            if (res.ok) {
                toast.success('Record updated successfully', {
                    position: 'top-right'
                })
                setEditingRecord(null)
                fetchRecords()
            } else {
                const error = await res.json()
                toast.error(error.message || 'Failed to update record', {
                    position: 'top-right'
                })
            }
        } catch (error) {
            console.error('Edit error:', error)
            toast.error('An error occurred while updating the record', {
                position: 'top-right'
            })
        } finally {
            setProcessing(false)
        }
    }

    const startEditing = async (rec: any) => {
        setProcessing(true)
        try {
            if (activeTab === 'attendance') {
                // Fetch detailed attendance data including all breaks
                const res = await fetch(`/api/attendance/${rec.id}`)
                if (res.ok) {
                    const detailedData = await res.json()
                    setEditingRecord(detailedData)
                    setEditForm({
                        clockIn: detailedData.clockIn,
                        clockOut: detailedData.clockOut,
                        mode: detailedData.mode,
                        date: detailedData.date,
                        status: detailedData.status,
                        breaks: detailedData.breaks || [],
                        allSessions: detailedData.allSessions || []
                    })
                } else {
                    setEditingRecord(rec)
                    setEditForm({
                        clockIn: rec.clockIn,
                        clockOut: rec.clockOut,
                        mode: rec.mode,
                        date: rec.date,
                        status: rec.status,
                        breaks: []
                    })
                }
            } else if (activeTab === 'leaves') {
                setEditingRecord(rec)
                setEditForm({
                    startDate: rec.startDate,
                    endDate: rec.endDate,
                    type: rec.type,
                    duration: rec.duration,
                    reason: rec.reason,
                    status: rec.status
                })
            } else if (activeTab === 'breaks') {
                // Fetch all breaks for this attendance record
                const res = await fetch(`/api/breaks/${rec.id}`)
                if (res.ok) {
                    const detailedData = await res.json()
                    setEditingRecord(detailedData)
                    setEditForm({
                        startTime: detailedData.startTime,
                        endTime: detailedData.endTime,
                        date: detailedData.date,
                        attendanceId: detailedData.attendanceId
                    })
                } else {
                    setEditingRecord(rec)
                    setEditForm({
                        startTime: rec.startTime,
                        endTime: rec.endTime,
                        date: rec.date
                    })
                }
            }
        } catch (error) {
            console.error('Error fetching detailed record:', error)
            setEditingRecord(rec)
        } finally {
            setProcessing(false)
        }
    }

    const deleteRecord = async (id: string) => {
        setProcessing(true)
        try {
            // For attendance records, check if there are break sessions
            if (activeTab === 'attendance') {
                const res = await fetch(`/api/attendance/${id}`)
                if (res.ok) {
                    const record = await res.json()

                    // Check if there are breaks associated with this attendance
                    if (record.breaks && record.breaks.length > 0) {
                        const breakCount = record.breaks.length
                        const confirmMsg = `⚠️ WARNING: This attendance record has ${breakCount} break session(s) associated with it.\n\nDeleting this record will also delete all associated break sessions.\n\nAre you sure you want to proceed?`

                        if (!confirm(confirmMsg)) {
                            setProcessing(false)
                            return
                        }

                        // Notify user about the breaks that will be deleted
                        toast.warning(`Deleting ${breakCount} break session(s) along with attendance record`, {
                            duration: 5000,
                            position: 'top-right'
                        })
                    } else {
                        // Standard confirmation for records without breaks
                        if (!confirm("Are you sure you want to delete this attendance record?")) {
                            setProcessing(false)
                            return
                        }
                    }
                }
            } else if (activeTab === 'breaks') {
                // For break sessions, check if deleting would affect attendance computation
                const res = await fetch(`/api/breaks/${id}`)
                if (res.ok) {
                    const breakRecord = await res.json()

                    if (!confirm(`Are you sure you want to delete this break session?\n\nThis will affect the total hours computation for this day.`)) {
                        setProcessing(false)
                        return
                    }

                    toast.info('Break session deleted. Attendance hours have been recalculated.', {
                        position: 'top-right',
                        duration: 4000
                    })
                }
            } else {
                // Standard confirmation for other record types
                if (!confirm("Are you sure you want to delete this record?")) {
                    setProcessing(false)
                    return
                }
            }

            // Proceed with deletion
            const deleteRes = await fetch(`/api/${activeTab}/${id}`, { method: 'DELETE' })

            if (deleteRes.ok) {
                toast.success('Record deleted successfully', {
                    position: 'top-right'
                })
                fetchRecords()
            } else {
                const error = await deleteRes.json()
                toast.error(error.message || 'Failed to delete record', {
                    position: 'top-right'
                })
            }
        } catch (error) {
            console.error('Delete error:', error)
            toast.error('An error occurred while deleting the record', {
                position: 'top-right'
            })
        } finally {
            setProcessing(false)
        }
    }

    const deleteBreakInline = async (breakId: string) => {
        if (!confirm("Are you sure you want to delete this break session?")) return
        setProcessing(true)
        try {
            const res = await fetch(`/api/breaks/${breakId}`, { method: 'DELETE' })
            if (res.ok) {
                toast.success('Break session deleted')
                // Refetch detailed attendance to update the list
                const attRes = await fetch(`/api/attendance/${editingRecord.id}`)
                if (attRes.ok) {
                    const detailedData = await attRes.json()
                    setEditForm((prev: any) => ({
                        ...prev,
                        breaks: detailedData.breaks || [],
                        allSessions: detailedData.allSessions || []
                    }))
                }
            } else {
                toast.error('Failed to delete break')
            }
        } catch (error) {
            toast.error('An error occurred')
        } finally {
            setProcessing(false)
        }
    }

    const startEditingBreak = (br: any) => {
        setEditingBreakId(br.id)
        setBreakEditForm({
            startTime: br.startTime,
            endTime: br.endTime,
            date: br.date
        })
    }

    const cancelEditingBreak = () => {
        setEditingBreakId(null)
        setBreakEditForm(null)
    }

    const saveBreakInline = async (breakId: string) => {
        setProcessing(true)
        try {
            const res = await fetch(`/api/breaks/${breakId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(breakEditForm)
            })
            if (res.ok) {
                toast.success('Break session updated')
                setEditingBreakId(null)
                setBreakEditForm(null)
                // Refetch
                const attRes = await fetch(`/api/attendance/${editingRecord.id}`)
                if (attRes.ok) {
                    const detailedData = await attRes.json()
                    setEditForm((prev: any) => ({
                        ...prev,
                        breaks: detailedData.breaks || [],
                        allSessions: detailedData.allSessions || []
                    }))
                }
            } else {
                toast.error('Failed to update break')
            }
        } catch (error) {
            toast.error('An error occurred')
        } finally {
            setProcessing(false)
        }
    }

    const filteredRecords = records.filter(r =>
        r.userName?.toLowerCase().includes(filterQuery.toLowerCase()) ||
        r.department?.toLowerCase().includes(filterQuery.toLowerCase())
    )

    if (loading && records.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
                <div className="h-20 w-20 bg-white rounded-2xl flex items-center justify-center shadow-sm overflow-hidden animate-bounce p-2">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Portal...</p>
            </div>
        )
    }

    return (
        <div className="w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-10 px-4 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Manual Entry</h1>
                    <p className="text-muted-foreground text-sm">Admin Override Tools</p>
                </div>
                <div className="flex items-center gap-2 bg-destructive/10 px-3 py-1.5 rounded-full border border-destructive/20">
                    <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                    <span className="text-xs font-medium text-destructive">Override Mode Active</span>
                </div>
            </div>

            {/* Category Toggle */}
            <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
                {[
                    { id: 'attendance', label: 'Attendance', icon: Clock },
                    { id: 'leaves', label: 'Authorized Leave', icon: FileText },
                    { id: 'breaks', label: 'Break Sessions', icon: Coffee }
                ].map(tab => (
                    <Button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id as any); setActiveMode('create'); }}
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

            {/* Mode Switcher */}
            <div className="flex gap-6 border-b border-border pb-0">
                {[
                    { id: 'create', label: 'Create New record' },
                    { id: 'list', label: 'Review Existing Record' }
                ].map(mode => (
                    <button
                        key={mode.id}
                        onClick={() => setActiveMode(mode.id as any)}
                        className={cn(
                            "pb-3 px-1 text-sm font-medium transition-all relative",
                            activeMode === mode.id ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {mode.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            {activeMode === 'create' ? (
                <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                    <CardHeader className="border-b border-border p-5 bg-muted/20">
                        <CardTitle className="text-lg font-semibold text-foreground">
                            Manual {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Record
                        </CardTitle>
                        <CardDescription className="text-sm text-muted-foreground">
                            Create a new attendance record for a staff member.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        {activeTab === 'attendance' && (
                            <form onSubmit={handleAttendanceSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label>Filter by Department</Label>
                                        <Select value={formDeptId} onValueChange={setFormDeptId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="All Departments" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Departments</SelectItem>
                                                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Staff Name</Label>
                                        <Select value={attEmpId} onValueChange={setAttEmpId} required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Staff..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {employees.filter(e => formDeptId === 'all' || e.departmentId === formDeptId).map(e => (
                                                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Work Location</Label>
                                        <Select value={attMode} onValueChange={setAttMode}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="OFFICE">In-Office</SelectItem>
                                                <SelectItem value="WFH">WFH</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Date</Label>
                                        <Input type="date" value={attDate} onChange={e => setAttDate(e.target.value)} required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Clock In</Label>
                                            <Input type="time" value={attIn} onChange={e => setAttIn(e.target.value)} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Clock Out</Label>
                                            <Input type="time" value={attOut} onChange={e => {
                                                const val = e.target.value
                                                if (attIn && val < attIn) {
                                                    alert("Clock Out time cannot be earlier than Clock In time.")
                                                    return
                                                }
                                                setAttOut(val)
                                            }} />
                                        </div>
                                    </div>
                                </div>
                                <Button type="submit" disabled={processing} className="w-full">
                                    {processing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                                    {status === 'success' ? "Successfully Recorded" : "Authorize Final Entry"}
                                </Button>
                            </form>
                        )}

                        {activeTab === 'leaves' && (
                            <form onSubmit={handleLeaveSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label>Department</Label>
                                        <Select value={formDeptId} onValueChange={setFormDeptId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="All Departments" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Departments</SelectItem>
                                                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Staff Name</Label>
                                        <Select value={lvEmpId} onValueChange={setLvEmpId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Staff..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {employees.filter(e => formDeptId === 'all' || e.departmentId === formDeptId).map(e => (
                                                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Leave Type</Label>
                                        <Select value={lvType} onValueChange={setLvType}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="SICK">Sick Leave</SelectItem>
                                                <SelectItem value="VACATION">Vacation Leave</SelectItem>
                                                <SelectItem value="BIRTHDAY">Birthday Leave</SelectItem>
                                                <SelectItem value="MATERNITY">Maternity/Paternity</SelectItem>
                                                <SelectItem value="OTHER">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Start Date</Label>
                                        <Input type="date" value={lvStart} onChange={e => setLvStart(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>End Date</Label>
                                        <Input type="date" value={lvEnd} onChange={e => {
                                            const newEnd = e.target.value
                                            if (lvStart && newEnd < lvStart) {
                                                alert("End date cannot be before start date")
                                                return
                                            }
                                            setLvEnd(newEnd)
                                        }} required />
                                    </div>
                                    <div className="space-y-3 md:col-span-2">
                                        <Label className="block text-center mb-2">Work Duration</Label>
                                        <div className="flex justify-center gap-2">
                                            {['Full Day', 'Part Day'].map(d => (
                                                <Button
                                                    key={d}
                                                    type="button"
                                                    onClick={() => setLvDuration(d)}
                                                    variant={lvDuration === d ? 'default' : 'outline'}
                                                    className="h-9 px-4 text-sm font-medium"
                                                >
                                                    {d}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {lvDuration !== 'Full Day' && (
                                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 md:col-span-2">
                                            <div className="space-y-2">
                                                <Label>Start Time</Label>
                                                <Input type="time" value={lvStartTime} onChange={e => setLvStartTime(e.target.value)} required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>End Time</Label>
                                                <Input type="time" value={lvEndTime} onChange={e => setLvEndTime(e.target.value)} required />
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Additional Details</Label>
                                        <Input placeholder="Enter audit remarks..." value={lvReason} onChange={e => setLvReason(e.target.value)} />
                                    </div>
                                </div>
                                <Button type="submit" disabled={processing} className="w-full">
                                    {processing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                                    {status === 'success' ? "Successfully Recorded" : "Grant Manual Leave"}
                                </Button>
                            </form>
                        )}

                        {activeTab === 'breaks' && (
                            <form onSubmit={handleBreakSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label>Department</Label>
                                        <Select value={formDeptId} onValueChange={setFormDeptId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="All Departments" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Departments</SelectItem>
                                                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Staff Name</Label>
                                        <Select value={brEmpId} onValueChange={setBrEmpId} required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Staff..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {employees.filter(e => formDeptId === 'all' || e.departmentId === formDeptId).map(e => (
                                                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Date</Label>
                                        <Input type="date" value={brDate} onChange={e => setBrDate(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Session Start</Label>
                                        <Input type="time" value={brIn} onChange={e => setBrIn(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Session End</Label>
                                        <Input type="time" value={brOut} onChange={e => {
                                            const val = e.target.value
                                            if (brIn && val < brIn) {
                                                alert("Session End time cannot be earlier than Session Start time.")
                                                return
                                            }
                                            setBrOut(val)
                                        }} />
                                    </div>
                                </div>
                                <Button type="submit" disabled={processing} className="w-full">
                                    {processing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                                    {status === 'success' ? "Successfully Recorded" : "Register Manual Break"}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {/* Filters for Lists */}
                    <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white p-5">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="space-y-2">
                                <Label>Department</Label>
                                <Select value={filterDept} onValueChange={setFilterDept}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Departments</SelectItem>
                                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Date From</Label>
                                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Date To</Label>
                                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Filter identity..."
                                    value={filterQuery}
                                    onChange={e => setFilterQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </Card>

                    <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                        <div className="p-0 overflow-x-auto min-h-[400px]">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="py-4 px-6 font-medium text-muted-foreground">Staff Name</TableHead>
                                        <TableHead className="py-4 px-6 font-medium text-muted-foreground">Department</TableHead>
                                        <TableHead className="py-4 px-6 font-medium text-muted-foreground">Date</TableHead>
                                        {activeTab === 'attendance' ? (
                                            <>
                                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Clock In</TableHead>
                                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Clock Out</TableHead>
                                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Total Hours</TableHead>
                                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Status</TableHead>
                                            </>
                                        ) : (
                                            <TableHead className="py-4 px-6 font-medium text-muted-foreground">{activeTab === 'leaves' ? 'Leave Type' : 'Work Time'}</TableHead>
                                        )}
                                        {activeTab === 'leaves' && <TableHead className="py-4 px-6 font-medium text-muted-foreground">Status</TableHead>}
                                        <TableHead className="py-4 px-6 font-medium text-muted-foreground text-right">Admin</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRecords.map(rec => (
                                        <TableRow key={rec.id} className="border-border hover:bg-muted/30 transition-colors group">
                                            <TableCell className="py-4 px-6">
                                                <span className="font-medium text-foreground text-sm">{rec.userName}</span>
                                            </TableCell>
                                            <TableCell className="py-4 px-6 text-sm text-muted-foreground">{rec.department}</TableCell>
                                            <TableCell className="py-4 px-6 text-sm text-muted-foreground whitespace-nowrap">
                                                {activeTab === 'leaves'
                                                    ? `${formatDate(rec.startDate)} - ${formatDate(rec.endDate)}`
                                                    : formatDate(rec.clockIn || rec.date || rec.startTime)}
                                            </TableCell>
                                            {activeTab === 'attendance' ? (
                                                <>
                                                    <TableCell className="py-4 px-6 text-sm text-primary font-medium">{formatTime(rec.clockIn)}</TableCell>
                                                    <TableCell className="py-4 px-6 text-sm text-muted-foreground">{formatTime(rec.clockOut)}</TableCell>
                                                    <TableCell className="py-4 px-6 text-sm font-semibold">
                                                        {rec.clockIn && rec.clockOut ?
                                                            ((new Date(rec.clockOut).getTime() - new Date(rec.clockIn).getTime()) / (1000 * 60 * 60)).toFixed(2) + ' hrs'
                                                            : '---'}
                                                    </TableCell>
                                                    <TableCell className="py-4 px-6">
                                                        <span className={cn(
                                                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase",
                                                            rec.status === 'PRESENT' ? "bg-green-100 text-green-800" :
                                                                rec.status === 'ABSENT' ? "bg-red-100 text-red-800" :
                                                                    rec.status === 'LATE' ? "bg-yellow-100 text-yellow-800" :
                                                                        "bg-gray-100 text-gray-800"
                                                        )}>
                                                            {rec.status || 'PRESENT'}
                                                        </span>
                                                    </TableCell>
                                                </>
                                            ) : (
                                                <TableCell className="py-4 px-6">
                                                    {activeTab === 'leaves' && (
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-medium text-sm text-foreground">{rec.type}</span>
                                                            <span className="text-xs text-muted-foreground">{rec.duration}</span>
                                                        </div>
                                                    )}
                                                    {activeTab === 'breaks' && (
                                                        <div className="flex gap-2 items-center text-sm font-medium text-yellow-600">
                                                            <span>{formatTime(rec.startTime)}</span>
                                                            <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                                                            <span>{formatTime(rec.endTime)}</span>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            )}
                                            {activeTab === 'leaves' && (
                                                <TableCell className="py-4 px-6">
                                                    <span className={cn(
                                                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                        rec.status === 'APPROVED' ? "bg-green-100 text-green-800" :
                                                            rec.status === 'DECLINED' ? "bg-red-100 text-red-800" :
                                                                "bg-yellow-100 text-yellow-800"
                                                    )}>
                                                        {rec.status}
                                                    </span>
                                                </TableCell>
                                            )}
                                            <TableCell className="py-4 px-6 text-right">
                                                <div className="flex justify-end gap-1 transition-opacity">
                                                    <Button onClick={() => startEditing(rec)} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10">
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button onClick={() => deleteRecord(rec.id)} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredRecords.length === 0 && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={activeTab === 'attendance' ? 8 : activeTab === 'leaves' ? 6 : 5}
                                                className="py-12 text-center"
                                            >
                                                <div className="flex flex-col items-center gap-2 text-muted-foreground opacity-50">
                                                    <AlertCircle className="h-8 w-8" />
                                                    <p className="text-sm font-medium">No records detected</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            )}
            {/* Edit Dialog */}
            <Dialog open={!!editingRecord} onOpenChange={(open) => {
                if (!open) {
                    setEditingRecord(null);
                    setEditingBreakId(null);
                    setBreakEditForm(null);
                }
            }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit {activeTab.slice(0, -1)} Record</DialogTitle>
                        <DialogDescription>Modify entry for {editingRecord?.userName}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
                        {activeTab === 'attendance' && (
                            <>
                                <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 mb-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Reference Date</Label>
                                        <Badge variant="outline" className="text-[9px] font-black text-primary bg-white px-2 py-0.5 rounded-full border border-slate-200">EXISTING RECORD</Badge>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 ml-1">
                                        <div className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm text-primary">
                                            <CalendarIcon className="h-4 w-4" />
                                        </div>
                                        <p className="text-xl font-black tracking-tight text-slate-900">
                                            {formatDate(editForm.date)}
                                        </p>
                                    </div>
                                    <input type="hidden" value={editForm.date} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Clock In</Label>
                                        <Input type="time" value={editForm.clockIn ? formatTime(editForm.clockIn) : ""}
                                            onChange={e => {
                                                const localDate = new Date(`${format(parseISO(editForm.date), 'yyyy-MM-dd')}T${e.target.value}:00`);
                                                setEditForm({ ...editForm, clockIn: localDate.toISOString() });
                                            }} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Clock Out</Label>
                                        <Input type="time" value={editForm.clockOut ? formatTime(editForm.clockOut) : ""}
                                            onChange={e => {
                                                const localDate = new Date(`${format(parseISO(editForm.date), 'yyyy-MM-dd')}T${e.target.value}:00`);
                                                setEditForm({ ...editForm, clockOut: localDate.toISOString() });
                                            }} />
                                    </div>
                                </div>

                                {/* Daily Sessions Compilation */}
                                {editForm.allSessions && editForm.allSessions.length > 0 && (
                                    <div className="space-y-2 border-t pt-4">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <Zap className="h-3 w-3 text-orange-500" />
                                            Daily Sessions Summary
                                        </Label>
                                        <div className="space-y-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
                                            {editForm.allSessions.map((session: any, idx: number) => {
                                                const isCurrent = session.id === editingRecord?.id;
                                                return (
                                                    <div
                                                        key={session.id}
                                                        className={cn(
                                                            "flex flex-col gap-2 p-3 rounded-lg border transition-all",
                                                            isCurrent ? "bg-white border-primary shadow-sm ring-1 ring-primary/20" : "bg-white/50 border-slate-200 opacity-60"
                                                        )}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn(
                                                                    "text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter",
                                                                    isCurrent ? "bg-primary text-white" : "bg-slate-200 text-slate-600"
                                                                )}>
                                                                    Session #{idx + 1} {isCurrent && "(Current)"}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-400 capitalize">{session.mode.toLowerCase()}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
                                                                <span className="text-green-600">{formatTime(session.clockIn)}</span>
                                                                <ArrowRight className="h-3 w-3 text-slate-300" />
                                                                <span className="text-red-600">{formatTime(session.clockOut)}</span>
                                                            </div>
                                                        </div>

                                                        {session.breaks && session.breaks.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {session.breaks.map((b: any, bIdx: number) => (
                                                                    <div key={b.id} className="bg-amber-50 text-[9px] font-bold text-amber-700 px-1.5 py-0.5 rounded border border-amber-100 flex items-center gap-1">
                                                                        <Coffee className="h-2 w-2" />
                                                                        {formatTime(b.startTime)} - {formatTime(b.endTime)}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Break Sessions Compilation */}
                                {editForm.breaks && editForm.breaks.length > 0 && (
                                    <div className="space-y-2 border-t pt-4">
                                        <Label className="text-sm font-semibold flex items-center gap-2">
                                            <Coffee className="h-4 w-4 text-yellow-600" />
                                            Break Sessions ({editForm.breaks.length})
                                        </Label>
                                        <div className="space-y-2 max-h-[250px] overflow-y-auto bg-muted/30 rounded-xl p-3">
                                            {editForm.breaks.map((breakSession: any, index: number) => {
                                                const isEditingBreak = editingBreakId === breakSession.id;

                                                return (
                                                    <div key={breakSession.id || index} className={cn(
                                                        "flex flex-col gap-2 bg-white p-3 rounded-xl border transition-all",
                                                        isEditingBreak ? "border-amber-400 shadow-md ring-1 ring-amber-400/20" : "border-border"
                                                    )}>
                                                        {isEditingBreak ? (
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Editing Break #{index + 1}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <Button
                                                                            type="button"
                                                                            onClick={() => saveBreakInline(breakSession.id)}
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                        >
                                                                            <Check className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            onClick={cancelEditingBreak}
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div className="space-y-1">
                                                                        <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Start</Label>
                                                                        <Input
                                                                            type="time"
                                                                            className="h-8 text-xs"
                                                                            value={breakEditForm.startTime ? format(parseISO(breakEditForm.startTime), "HH:mm") : ""}
                                                                            onChange={e => {
                                                                                const datePart = breakEditForm.date?.includes('T') ? breakEditForm.date.split('T')[0] : breakEditForm.date;
                                                                                const localDate = new Date(`${datePart}T${e.target.value}:00`);
                                                                                setBreakEditForm({ ...breakEditForm, startTime: localDate.toISOString() });
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">End</Label>
                                                                        <Input
                                                                            type="time"
                                                                            className="h-8 text-xs"
                                                                            value={breakEditForm.endTime ? format(parseISO(breakEditForm.endTime), "HH:mm") : ""}
                                                                            onChange={e => {
                                                                                const datePart = breakEditForm.date?.includes('T') ? breakEditForm.date.split('T')[0] : breakEditForm.date;
                                                                                const localDate = new Date(`${datePart}T${e.target.value}:00`);
                                                                                setBreakEditForm({ ...breakEditForm, endTime: localDate.toISOString() });
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-between group">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-yellow-700 text-xs">#{index + 1}</span>
                                                                        <div className="flex items-center gap-2 text-sm font-mono font-bold">
                                                                            <span className="text-slate-600">{formatTime(breakSession.startTime)}</span>
                                                                            <ArrowRight className="h-3 w-3 text-slate-300" />
                                                                            <span className="text-slate-600">{formatTime(breakSession.endTime)}</span>
                                                                        </div>
                                                                    </div>
                                                                    <span className="text-[10px] text-muted-foreground ml-5">
                                                                        {breakSession.endTime && breakSession.startTime
                                                                            ? `${((new Date(breakSession.endTime).getTime() - new Date(breakSession.startTime).getTime()) / (1000 * 60)).toFixed(0)} min duration`
                                                                            : 'Session In-Progress'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <Button
                                                                        type="button"
                                                                        onClick={() => startEditingBreak(breakSession)}
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                                                                    >
                                                                        <Edit2 className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        onClick={() => deleteBreakInline(breakSession.id)}
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <p className="text-xs text-muted-foreground italic">
                                            ⚠️ Note: Modifying clock in/out times may affect break session validity. Ensure break sessions fall within the new timeframe.
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label>Work Location</Label>
                                    <Select value={editForm.mode} onValueChange={m => setEditForm({ ...editForm, mode: m })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="OFFICE">In-Office</SelectItem>
                                            <SelectItem value="WFH">WFH</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <Select value={editForm.status} onValueChange={s => setEditForm({ ...editForm, status: s })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PRESENT">Present</SelectItem>
                                            <SelectItem value="ABSENT">Absent</SelectItem>
                                            <SelectItem value="LATE">Late</SelectItem>
                                            <SelectItem value="HALF_DAY">Half Day</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}
                        {activeTab === 'leaves' && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Start Date</Label>
                                        <Input type="date" value={editForm.startDate} onChange={e => setEditForm({ ...editForm, startDate: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>End Date</Label>
                                        <Input type="date" value={editForm.endDate} onChange={e => setEditForm({ ...editForm, endDate: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Reason</Label>
                                    <Input value={editForm.reason || ""} onChange={e => setEditForm({ ...editForm, reason: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <Select value={editForm.status} onValueChange={s => setEditForm({ ...editForm, status: s })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PENDING">Pending</SelectItem>
                                            <SelectItem value="APPROVED">Approved</SelectItem>
                                            <SelectItem value="DECLINED">Declined</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}
                        {activeTab === 'breaks' && (
                            <>
                                <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 mb-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Break Date</Label>
                                        <Badge variant="outline" className="text-[9px] font-black text-amber-600 bg-white px-2 py-0.5 rounded-full border border-slate-200">BREAK SESSION</Badge>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 ml-1">
                                        <div className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm text-amber-500">
                                            <Coffee className="h-4 w-4" />
                                        </div>
                                        <p className="text-xl font-black tracking-tight text-slate-900">
                                            {formatDate(editForm.date)}
                                        </p>
                                    </div>
                                    <input type="hidden" value={editForm.date} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Start Time</Label>
                                        <Input type="time" value={editForm.startTime ? format(parseISO(editForm.startTime), "HH:mm") : ""}
                                            onChange={e => {
                                                const datePart = editForm.date.includes('T') ? editForm.date.split('T')[0] : editForm.date;
                                                const localDate = new Date(`${datePart}T${e.target.value}:00`);
                                                setEditForm({ ...editForm, startTime: localDate.toISOString() });
                                            }} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">End Time</Label>
                                        <Input type="time" value={editForm.endTime ? format(parseISO(editForm.endTime), "HH:mm") : ""}
                                            onChange={e => {
                                                const datePart = editForm.date.includes('T') ? editForm.date.split('T')[0] : editForm.date;
                                                const localDate = new Date(`${datePart}T${e.target.value}:00`);
                                                setEditForm({ ...editForm, endTime: localDate.toISOString() });
                                            }} />
                                    </div>
                                </div>
                            </>
                        )}
                        <Button type="submit" disabled={processing} className="w-full">
                            {processing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Save Changes"}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div >
    )
}
