"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { calculateTardiness } from "@/lib/performance-utils"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    CheckCircle2,
    XCircle,
    Trash2,
    AlertCircle,
    Loader2,
    Calendar as CalendarIcon,
    TrendingUp,
    Download,
    Building2,
    Clock,
    UserCircle,
    ShieldCheck,
    UserCog,
    History as HistoryIcon,
    Search,
    Filter,
    Users
} from "lucide-react"
import { format, parseISO, subDays, eachDayOfInterval } from "date-fns"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { getBrowserTimezone, prepareTimeForExport, formatWithTimezone } from "@/lib/timezone"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'
import { cn } from "@/lib/utils"
import { StaffPerformanceCard } from "@/components/performance/StaffPerformanceCard"

export default function ManagerActivityPage() {
    const [activeTab, setActiveTab] = useState<'logs' | 'control'>('logs')
    const [leaves, setLeaves] = useState<any[]>([])
    const [employees, setEmployees] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedManager, setSelectedManager] = useState<string | null>(null)
    const [managers, setManagers] = useState<any[]>([])
    const [departments, setDepartments] = useState<any[]>([])
    const [managerDepartments, setManagerDepartments] = useState<any[]>([])
    const [perfTeamFilter, setPerfTeamFilter] = useState("all")

    // Action State
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [declineReason, setDeclineReason] = useState("")
    const [isDeclineDialogOpen, setIsDeclineDialogOpen] = useState(false)
    const [selectedLeafForAction, setSelectedLeafForAction] = useState<any>(null)
    const [attendanceRequests, setAttendanceRequests] = useState<any[]>([])

    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"))
    const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [userTimeZone, setUserTimeZone] = useState("UTC")
    const { data: session } = useSession()

    // NEW: Manager Control Sub-Tabs
    const [controlTab, setControlTab] = useState<'requests' | 'history' | 'performance' | 'reports'>('requests')
    const [performanceData, setPerformanceData] = useState<any[]>([])
    const [rawPerformanceData, setRawPerformanceData] = useState<any[]>([])
    const [isFetchingPerformance, setIsFetchingPerformance] = useState(false)
    const [reportStartDate, setReportStartDate] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"))
    const [reportEndDate, setReportEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [isGeneratingReport, setIsGeneratingReport] = useState(false)
    const [managerTeam, setManagerTeam] = useState<any[]>([])
    const [perfStartDate, setPerfStartDate] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"))
    const [perfEndDate, setPerfEndDate] = useState(format(new Date(), "yyyy-MM-dd"))

    // Report Selection State
    const [reportStaffFilter, setReportStaffFilter] = useState<string[]>([])
    const [reportDeptFilter, setReportDeptFilter] = useState<string>("all")

    useEffect(() => {
        if (session?.user) {
            const stored = (session.user as any).selectedTimezone
            if (stored && stored !== 'UTC') setUserTimeZone(stored)
            else if ((session.user as any).useCurrentTimezone) {
                setUserTimeZone(getBrowserTimezone())
            }
        }
    }, [session])

    // Edit State
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<any>(null)
    const [editForm, setEditForm] = useState<any>({
        startDate: "",
        endDate: "",
        type: "",
        reason: "",
        status: "",
        startTime: "",
        endTime: "",
        time: ""
    })

    useEffect(() => {
        fetchData()
    }, [startDate, endDate, selectedManager])

    useEffect(() => {
        if (selectedManager && activeTab === 'control' && controlTab === 'performance') {
            fetchPerformanceData()
        }
    }, [selectedManager, activeTab, controlTab, perfStartDate, perfEndDate, perfTeamFilter])

    const fetchData = async () => {
        setLoading(true)
        try {
            const query = new URLSearchParams({
                startDate,
                endDate,
                ...(selectedManager && { managerId: selectedManager })
            })

            const [leavesRes, attRes, empRes, deptsRes] = await Promise.all([
                fetch(`/api/leaves?${query.toString()}`),
                fetch(`/api/attendance-requests?${query.toString()}`),
                fetch('/api/employees'),
                fetch('/api/departments')
            ])

            if (leavesRes.ok && empRes.ok && attRes.ok && deptsRes.ok) {
                const leavesData = await leavesRes.json()
                const attData = await attRes.json()
                const employeesData = await empRes.json()
                const deptsData = await deptsRes.json()

                setEmployees(employeesData)
                setDepartments(deptsData)

                // Merge logs
                const formattedLeaves = leavesData.map((l: any) => ({ ...l, kind: 'LEAVE' }))
                const formattedAtt = attData.map((a: any) => ({
                    ...a,
                    kind: 'ATTENDANCE',
                    userName: a.user?.name || 'Unknown',
                    userImage: a.user?.image,
                    department: a.user?.department?.name,
                    startDate: a.date,
                    endDate: a.date,
                    duration: 'N/A',
                    type: a.type
                }))

                setLeaves([...formattedLeaves, ...formattedAtt])

                if (selectedManager) {
                    const reports = employeesData.filter((e: any) => e.managerId === selectedManager)
                    setManagerTeam(reports)

                    // Find departments managed by this person
                    const managedDepts = deptsData.filter((d: any) => d.managerId === selectedManager)
                    setManagerDepartments(managedDepts)
                }

                // Filter for Managers
                const mgrs = employeesData.filter((e: any) =>
                    e.roles?.includes('MANAGER') ||
                    e.roles?.includes('ADMIN') ||
                    employeesData.some((sub: any) => sub.managerId === e.id)
                )
                const uniqueMgrs = Array.from(new Map(mgrs.map((m: any) => [m.id, m])).values())
                    .sort((a: any, b: any) => a.name.localeCompare(b.name))

                setManagers(uniqueMgrs)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const fetchPerformanceData = async () => {
        if (!selectedManager) return
        setIsFetchingPerformance(true)
        try {
            // Determine filtered team
            let team = employees.filter(e => e.managerId === selectedManager)
            if (perfTeamFilter !== "all" && perfTeamFilter !== "reports") {
                team = employees.filter(e => e.departmentId === perfTeamFilter)
            } else if (perfTeamFilter === "reports") {
                team = employees.filter(e => e.managerId === selectedManager)
            } else if (perfTeamFilter === "all") {
                // All managed: direct reports OR employees in managed departments
                const managedDeptIds = managerDepartments.map(d => d.id)
                team = employees.filter(e =>
                    e.managerId === selectedManager ||
                    (e.departmentId && managedDeptIds.includes(e.departmentId))
                )
            }

            if (team.length === 0) {
                setPerformanceData([])
                return
            }

            const start = new Date(perfStartDate)
            const end = new Date(perfEndDate)
            const staffIds = team.map(e => e.id)

            const query = new URLSearchParams({
                userIds: staffIds.join(','),
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                includeAll: 'true'
            })

            const res = await fetch(`/api/attendance?${query.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setRawPerformanceData(data)
                const days = eachDayOfInterval({ start, end })
                const chartData = days.map(day => {
                    const dateStr = format(day, "yyyy-MM-dd")
                    const dayAtt = data.filter((a: any) => a.date === dateStr)
                    const presentCount = dayAtt.filter((a: any) => a.status !== 'on-leave').length

                    // Calculate tardiness using individual user work hours
                    const lateCount = dayAtt.filter((a: any) => {
                        if (!a.clockIn || a.status === 'on-leave') return false

                        // Find the user for this attendance record
                        const user = team.find(u => u.id === a.userId)
                        if (!user) return false

                        // Use centralized calculation which includes Philippine-specific grace period
                        return calculateTardiness(a, user) > 0
                    }).length

                    return {
                        date: format(day, "MMM dd"),
                        basePresent: presentCount,
                        present: presentCount - lateCount,
                        late: lateCount,
                        absent: team.length - presentCount,
                        totalStaff: team.length
                    }
                })
                setPerformanceData(chartData)
                // Update manager team for the counters in UI
                setManagerTeam(team)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsFetchingPerformance(false)
        }
    }

    const generateReport = async () => {
        if (!selectedManager) return
        setIsGeneratingReport(true)
        try {
            const team = reportStaffFilter.length > 0
                ? managerTeam.filter(e => reportStaffFilter.includes(e.id))
                : (reportDeptFilter === "all"
                    ? managerTeam
                    : managerTeam.filter(e => e.departmentId === reportDeptFilter))

            if (team.length === 0) {
                toast.error("No staff members selected for the report")
                setIsGeneratingReport(false)
                return
            }

            const staffIds = team.map(e => e.id)
            const query = new URLSearchParams({
                userIds: staffIds.join(','),
                startDate: reportStartDate,
                endDate: reportEndDate,
                includeAll: 'true'
            })

            const res = await fetch(`/api/attendance?${query.toString()}`)
            if (!res.ok) throw new Error("Failed to fetch report data")

            const data = await res.json()
            const wb = XLSX.utils.book_new()

            // Attendance Ledger
            const ledgerData = data.map((record: any) => ({
                'Date': formatWithTimezone(record.date, userTimeZone, 'date'),
                'Staff Name': record.userName,
                'Clock In': record.clockIn ? formatWithTimezone(record.clockIn, userTimeZone, 'time') : '-',
                'Clock Out': record.clockOut ? formatWithTimezone(record.clockOut, userTimeZone, 'time') : '-',
                'Total Hours': record.duration ? (record.duration / 60).toFixed(2) : '0',
                'Status': record.status,
                'Shift Start': record.shiftStartTime
            }))

            const wsLedger = XLSX.utils.json_to_sheet(ledgerData)
            XLSX.utils.book_append_sheet(wb, wsLedger, "Attendance Ledger")

            const managerName = managers.find(m => m.id === selectedManager)?.name || 'Manager'
            XLSX.writeFile(wb, `Team_Report_${managerName.replace(/\s+/g, '_')}_${reportStartDate}_to_${reportEndDate}.xlsx`)
            toast.success("Report downloaded")
        } catch (error) {
            toast.error("Failed to generate report")
        } finally {
            setIsGeneratingReport(false)
        }
    }

    const getManagerOfUser = (userId: string) => {
        const user = employees.find(e => e.id === userId)
        if (!user) return null

        // If they report to someone, return that person
        if (user.managerId) {
            return employees.find(e => e.id === user.managerId) || { name: "System Admin", role: "ADMIN" }
        }

        // If they are a manager themselves, they likely report to Admin
        if (user.roles?.includes('MANAGER') || user.role === 'MANAGER') {
            return { name: "Direct to Admin", isSystem: true }
        }

        return null
    }

    const handleStatusUpdate = async (item: any, status: 'APPROVED' | 'DECLINED', reason?: string) => {
        setProcessingId(item.id)
        const endpoint = item.kind === 'ATTENDANCE'
            ? `/api/attendance-requests/${item.id}`
            : `/api/leaves/${item.id}`

        try {
            const res = await fetch(endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, declineReason: reason })
            })

            if (res.ok) {
                toast.success(`Request ${status.toLowerCase()}`)
                setIsDeclineDialogOpen(false)
                fetchData() // Refresh data
            } else {
                toast.error("Failed to update status")
            }
        } catch (error) {
            toast.error("Error updating request")
        } finally {
            setProcessingId(null)
        }
    }

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingItem) return
        setProcessingId(editingItem.id)

        const endpoint = editingItem.kind === 'ATTENDANCE'
            ? `/api/attendance-requests/${editingItem.id}`
            : `/api/leaves/${editingItem.id}`

        try {
            const body: any = {
                status: editForm.status,
                type: editForm.type,
                reason: editForm.reason,
            }

            // Calculate offset for the user's timezone
            const offset = (() => {
                try {
                    const part = new Intl.DateTimeFormat('en-US', { timeZone: userTimeZone, timeZoneName: 'longOffset' }).formatToParts().find(p => p.type === 'timeZoneName')
                    return part?.value.replace('GMT', '') || '+00:00'
                } catch { return '+00:00' }
            })()

            if (editingItem.kind === 'ATTENDANCE') {
                body.date = editForm.startDate
                body.time = `${editForm.startDate}T${editForm.time}:00${offset}`
            } else {
                body.startDate = editForm.startDate
                body.endDate = editForm.endDate
                if (editForm.startTime) body.startTime = `${editForm.startDate}T${editForm.startTime}:00${offset}`
                if (editForm.endTime) body.endTime = `${editForm.endDate}T${editForm.endTime}:00${offset}`
            }

            const res = await fetch(endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (res.ok) {
                toast.success("Record updated successfully")
                setIsEditDialogOpen(false)
                fetchData()
            } else {
                toast.error("Failed to update record")
            }
        } catch (error) {
            toast.error("Error updating record")
        } finally {
            setProcessingId(null)
        }
    }

    const handleDelete = (item: any) => {
        toast("Delete Record?", {
            description: "Are you sure you want to delete this record? This cannot be undone.",
            action: {
                label: "Confirm Delete",
                onClick: () => performDelete(item)
            },
            cancel: {
                label: "Cancel",
                onClick: () => toast.dismiss()
            }
        })
    }

    const performDelete = async (item: any) => {
        setProcessingId(item.id)
        const endpoint = item.kind === 'ATTENDANCE'
            ? `/api/attendance-requests/${item.id}`
            : `/api/leaves/${item.id}`

        try {
            const res = await fetch(endpoint, {
                method: 'DELETE'
            })

            if (res.ok) {
                toast.success("Record deleted")
                fetchData()
            } else {
                toast.error("Failed to delete record")
            }
        } catch (error) {
            toast.error("Error deleting record")
        } finally {
            setProcessingId(null)
        }
    }

    // Helper to get leaves for selected manager
    const getManagerLeaves = (managerId: string) => {
        // Find users who report to this manager
        const reportingUserIds = employees
            .filter(e => e.managerId === managerId)
            .map(e => e.id)

        return leaves.filter(l => reportingUserIds.includes(l.userId))
    }

    const renderActionButtons = (leaf: any) => (
        <div className="flex items-center justify-end gap-2">
            {leaf.status === 'PENDING' ? (
                <>
                    <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                        onClick={() => handleStatusUpdate(leaf, 'APPROVED')}
                        disabled={!!processingId}
                        title="Approve"
                    >
                        {processingId === leaf.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    </Button>
                    <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                            setSelectedLeafForAction(leaf)
                            setDeclineReason(leaf.declineReason || "")
                            setIsDeclineDialogOpen(true)
                        }}
                        disabled={!!processingId}
                        title="Decline"
                    >
                        <XCircle className="h-4 w-4" />
                    </Button>
                </>
            ) : (
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2"
                        onClick={() => {
                            setEditingItem(leaf)
                            setEditForm({
                                startDate: leaf.startDate?.split('T')[0] || leaf.startDate || leaf.date?.split('T')[0] || "",
                                endDate: leaf.endDate?.split('T')[0] || leaf.endDate || "",
                                type: leaf.type,
                                reason: leaf.reason,
                                status: leaf.status,
                                startTime: leaf.startTime ? new Date(leaf.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userTimeZone }) : "",
                                endTime: leaf.endTime ? new Date(leaf.endTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userTimeZone }) : "",
                                time: leaf.time ? new Date(leaf.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userTimeZone }) : ""
                            })
                            setIsEditDialogOpen(true)
                        }}
                        disabled={!!processingId}
                    >
                        Edit
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-700 hover:bg-slate-50 px-2"
                        onClick={() => {
                            if (leaf.status === 'APPROVED') {
                                setSelectedLeafForAction(leaf)
                                setDeclineReason(leaf.declineReason || "")
                                setIsDeclineDialogOpen(true)
                            } else {
                                handleStatusUpdate(leaf, 'APPROVED')
                            }
                        }}
                        disabled={!!processingId}
                    >
                        Modify
                    </Button>
                </div>
            )}
            <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                onClick={() => handleDelete(leaf)}
                disabled={!!processingId}
                title="Delete Record"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    )

    return (
        <div className="w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-10 px-4 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Manager Activity</h1>
                    <p className="text-muted-foreground text-sm">Audit logs and administrative override for manager actions</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={activeTab === 'logs' ? "default" : "outline"}
                        onClick={() => setActiveTab('logs')}
                        className="gap-2"
                    >
                        <HistoryIcon className="h-4 w-4" />
                        Action Logs
                    </Button>
                    <Button
                        variant={activeTab === 'control' ? "default" : "outline"}
                        onClick={() => setActiveTab('control')}
                        className="gap-2"
                    >
                        <ShieldCheck className="h-4 w-4" />
                        Manager Control
                    </Button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-border shadow-sm">
                <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-2">
                        <HistoryIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Logs Period:</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="h-9 w-40 text-sm"
                        />
                        <span className="text-muted-foreground">-</span>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="h-9 w-40 text-sm"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-[350px]">
                    <UserCog className="h-4 w-4 text-muted-foreground" />
                    <Select value={selectedManager || "all"} onValueChange={(v) => setSelectedManager(v === "all" ? null : v)}>
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder="All Managers" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Managers Activity</SelectItem>
                            {managers.map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    {activeTab === 'logs' && (
                        <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                            <CardHeader className="bg-muted/10 border-b border-border">
                                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                    <HistoryIcon className="h-5 w-5 text-muted-foreground" />
                                    Review Activity Log
                                </CardTitle>
                                <CardDescription>Recent actions taken on leave requests across all managers</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="pl-6">Request Date</TableHead>
                                            <TableHead>Staff</TableHead>
                                            <TableHead>Manager</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right pr-6">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {leaves
                                            .map(leaf => {
                                                const manager = getManagerOfUser(leaf.userId)
                                                return (
                                                    <TableRow key={leaf.id}>
                                                        <TableCell className="pl-6 font-medium text-muted-foreground">
                                                            {new Date(leaf.createdAt || new Date().toISOString()).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: userTimeZone })}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium">{leaf.userName}</span>
                                                                <span className="text-xs text-muted-foreground">{leaf.department}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <div className={cn(
                                                                    "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                                                                    manager?.isSystem ? "bg-slate-100 text-slate-500" : "bg-primary/10 text-primary"
                                                                )}>
                                                                    {manager?.isSystem ? <ShieldCheck className="h-3 w-3" /> : (manager?.name?.charAt(0) || "?")}
                                                                </div>
                                                                <span className={cn(
                                                                    "text-sm",
                                                                    manager?.isSystem ? "text-slate-500 font-medium italic" : "text-slate-900 font-medium"
                                                                )}>
                                                                    {manager?.name || "Unassigned"}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">{leaf.type}</Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col gap-1.5 items-start">
                                                                <Badge className={
                                                                    leaf.status === 'APPROVED' ? "bg-green-100 text-green-700 hover:bg-green-100" :
                                                                        "bg-red-100 text-red-700 hover:bg-red-100"
                                                                }>
                                                                    {leaf.status}
                                                                </Badge>
                                                                {leaf.status === 'DECLINED' && leaf.declineReason && (
                                                                    <span className="text-[10px] text-muted-foreground max-w-[200px] truncate bg-muted px-1.5 py-0.5 rounded-sm" title={leaf.declineReason}>
                                                                        "{leaf.declineReason}"
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="pr-6">
                                                            {renderActionButtons(leaf)}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'control' && (
                        <div className="space-y-6">
                            {!selectedManager ? (
                                <Card className="border-dashed border-2 border-border bg-muted/5 p-12 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="h-16 w-16 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-border">
                                            <UserCog className="h-8 w-8 text-slate-300" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-lg font-bold">No Manager Selected</h3>
                                            <p className="text-sm text-muted-foreground">Select a manager above to view their performance metrics and generate reports.</p>
                                        </div>
                                    </div>
                                </Card>
                            ) : (
                                <div className="space-y-6">
                                    <Tabs defaultValue="performance" value={controlTab} onValueChange={(v: any) => setControlTab(v)} className="w-full">
                                        <TabsList className="bg-white border border-border shadow-sm h-11 px-1 rounded-xl gap-1">
                                            <TabsTrigger value="requests" className="data-[state=active]:bg-primary data-[state=active]:text-white h-9 rounded-lg transition-all text-xs font-bold uppercase tracking-wider">
                                                Pending Requests
                                            </TabsTrigger>
                                            <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-white h-9 rounded-lg transition-all text-xs font-bold uppercase tracking-wider">
                                                History
                                            </TabsTrigger>
                                            <TabsTrigger value="performance" className="data-[state=active]:bg-primary data-[state=active]:text-white h-9 rounded-lg transition-all text-xs font-bold uppercase tracking-wider">
                                                Performance
                                            </TabsTrigger>
                                            <TabsTrigger value="reports" className="data-[state=active]:bg-primary data-[state=active]:text-white h-9 rounded-lg transition-all text-xs font-bold uppercase tracking-wider">
                                                Team Reports
                                            </TabsTrigger>
                                        </TabsList>

                                        <div className="mt-6">
                                            <TabsContent value="requests" className="m-0 animate-in slide-in-from-right-4 duration-300">
                                                <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                                                    <CardHeader className="bg-amber-50/50 border-b border-amber-100 p-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                                                <AlertCircle className="h-5 w-5 text-amber-600" />
                                                            </div>
                                                            <div>
                                                                <CardTitle className="text-lg font-bold text-amber-900">Pending Actions</CardTitle>
                                                                <CardDescription className="text-amber-700/70">Requests awaiting manager approval</CardDescription>
                                                            </div>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-0">
                                                        <Table>
                                                            <TableHeader className="bg-muted/5">
                                                                <TableRow>
                                                                    <TableHead className="pl-6">Staff</TableHead>
                                                                    <TableHead>Dates</TableHead>
                                                                    <TableHead>Type</TableHead>
                                                                    <TableHead>Duration</TableHead>
                                                                    <TableHead className="text-right pr-6 font-bold">Actions</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {getManagerLeaves(selectedManager)
                                                                    .filter(l => l.status === 'PENDING')
                                                                    .map(leaf => (
                                                                        <TableRow key={leaf.id} className="hover:bg-muted/5 transition-colors">
                                                                            <TableCell className="pl-6 font-semibold text-slate-900">{leaf.userName}</TableCell>
                                                                            <TableCell className="text-slate-600 font-medium">
                                                                                {format(parseISO(leaf.startDate), "MMM dd")} - {format(parseISO(leaf.endDate), "MMM dd")}
                                                                            </TableCell>
                                                                            <TableCell><Badge variant="outline" className="bg-slate-50">{leaf.type}</Badge></TableCell>
                                                                            <TableCell className="text-sm font-medium text-slate-500">{leaf.duration}</TableCell>
                                                                            <TableCell className="pr-6">
                                                                                {renderActionButtons(leaf)}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                {getManagerLeaves(selectedManager).filter(l => l.status === 'PENDING').length === 0 && (
                                                                    <TableRow>
                                                                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground bg-muted/5 italic">
                                                                            No pending requests for this manager
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </TableBody>
                                                        </Table>
                                                    </CardContent>
                                                </Card>
                                            </TabsContent>

                                            <TabsContent value="history" className="m-0 animate-in slide-in-from-right-4 duration-300">
                                                <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                                                    <CardHeader className="bg-slate-50/50 border-b border-border p-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                                                <HistoryIcon className="h-5 w-5 text-slate-600" />
                                                            </div>
                                                            <div>
                                                                <CardTitle className="text-lg font-bold text-slate-900">Manager History</CardTitle>
                                                                <CardDescription>Actions previously taken by this manager</CardDescription>
                                                            </div>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-0">
                                                        <Table>
                                                            <TableHeader className="bg-muted/5">
                                                                <TableRow>
                                                                    <TableHead className="pl-6">Staff</TableHead>
                                                                    <TableHead>Dates</TableHead>
                                                                    <TableHead>Type</TableHead>
                                                                    <TableHead>Status</TableHead>
                                                                    <TableHead className="text-right pr-6 font-bold">Override</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {getManagerLeaves(selectedManager)
                                                                    .filter(l => l.status !== 'PENDING')
                                                                    .map(leaf => (
                                                                        <TableRow key={leaf.id} className="hover:bg-muted/5 transition-colors">
                                                                            <TableCell className="pl-6 font-semibold text-slate-900">{leaf.userName}</TableCell>
                                                                            <TableCell className="text-slate-600 font-medium text-sm">
                                                                                {format(parseISO(leaf.startDate), "MMM dd")} - {format(parseISO(leaf.endDate), "MMM dd")}
                                                                            </TableCell>
                                                                            <TableCell><Badge variant="outline">{leaf.type}</Badge></TableCell>
                                                                            <TableCell>
                                                                                <div className="flex flex-col gap-1.5 items-start">
                                                                                    <Badge className={leaf.status === 'APPROVED' ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100"}>
                                                                                        {leaf.status}
                                                                                    </Badge>
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell className="pr-6">
                                                                                {renderActionButtons(leaf)}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                {getManagerLeaves(selectedManager).filter(l => l.status !== 'PENDING').length === 0 && (
                                                                    <TableRow>
                                                                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground bg-muted/5 italic">
                                                                            No processing history for this manager in this range
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </TableBody>
                                                        </Table>
                                                    </CardContent>
                                                </Card>
                                            </TabsContent>

                                            <TabsContent value="performance" className="m-0 animate-in slide-in-from-right-4 duration-300">
                                                <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                                                    <CardHeader className="bg-primary/5 border-b border-primary/10 p-6">
                                                        <div className="flex flex-col gap-6">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                                                        <TrendingUp className="h-5 w-5 text-primary" />
                                                                    </div>
                                                                    <div>
                                                                        <CardTitle className="text-lg font-bold text-slate-900">Performance Metrics</CardTitle>
                                                                        <CardDescription className="text-slate-500">Aggregate attendance and punctuality trends across the team</CardDescription>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex items-center gap-2 bg-white border border-primary/20 p-1 rounded-lg">
                                                                        <Input
                                                                            type="date"
                                                                            value={perfStartDate}
                                                                            onChange={e => setPerfStartDate(e.target.value)}
                                                                            className="h-8 w-32 border-none shadow-none text-xs font-bold"
                                                                        />
                                                                        <span className="text-primary/30">-</span>
                                                                        <Input
                                                                            type="date"
                                                                            value={perfEndDate}
                                                                            onChange={e => setPerfEndDate(e.target.value)}
                                                                            className="h-8 w-32 border-none shadow-none text-xs font-bold"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col md:flex-row items-center gap-4 bg-white/50 p-4 rounded-xl border border-primary/10">
                                                                <div className="flex items-center gap-2 flex-1">
                                                                    <Filter className="h-4 w-4 text-primary/60" />
                                                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Department Scope:</span>
                                                                    <Select value={perfTeamFilter} onValueChange={setPerfTeamFilter}>
                                                                        <SelectTrigger className="h-9 w-[280px] bg-white border-primary/20 text-sm font-medium">
                                                                            <SelectValue placeholder="All Managed Departments" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="all">All Managed Departments</SelectItem>
                                                                            {managerDepartments.map(d => (
                                                                                <SelectItem key={d.id} value={d.id}>{d.name} Department</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <div className="flex items-center gap-1.5 ml-2">
                                                                        <AlertCircle className="h-3 w-3 text-slate-400" />
                                                                        <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Filter performance by entire team or specific managed department.</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase bg-white px-3 py-1.5 rounded-lg border border-primary/10">
                                                                    <Users className="h-3 w-3" />
                                                                    {managerTeam.length} Members in View
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-8">
                                                        {isFetchingPerformance ? (
                                                            <div className="h-[400px] flex flex-col items-center justify-center space-y-4">
                                                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Aggregating Team Stats...</p>
                                                            </div>
                                                        ) : performanceData.length > 0 ? (
                                                            <div className="space-y-8">
                                                                <div className="h-[350px] w-full">
                                                                    <ResponsiveContainer width="100%" height="100%">
                                                                        <LineChart data={performanceData}>
                                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                                            <XAxis
                                                                                dataKey="date"
                                                                                axisLine={false}
                                                                                tickLine={false}
                                                                                tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                                                                            />
                                                                            <YAxis
                                                                                axisLine={false}
                                                                                tickLine={false}
                                                                                tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                                                                            />
                                                                            <Tooltip
                                                                                contentStyle={{
                                                                                    borderRadius: '12px',
                                                                                    border: 'none',
                                                                                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                                                                                }}
                                                                            />
                                                                            <Legend iconType="circle" />
                                                                            <Line
                                                                                type="monotone"
                                                                                dataKey="present"
                                                                                name="On-Time"
                                                                                stroke="#10b981"
                                                                                strokeWidth={3}
                                                                                dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                                                                activeDot={{ r: 6, strokeWidth: 0 }}
                                                                            />
                                                                            <Line
                                                                                type="monotone"
                                                                                dataKey="late"
                                                                                name="Late Punctuality"
                                                                                stroke="#f59e0b"
                                                                                strokeWidth={3}
                                                                                dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                                                                activeDot={{ r: 6, strokeWidth: 0 }}
                                                                            />
                                                                            <Line
                                                                                type="monotone"
                                                                                dataKey="absent"
                                                                                name="Absent"
                                                                                stroke="#ef4444"
                                                                                strokeWidth={3}
                                                                                dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                                                                activeDot={{ r: 6, strokeWidth: 0 }}
                                                                            />
                                                                        </LineChart>
                                                                    </ResponsiveContainer>
                                                                </div>

                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm">
                                                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Avg. Presence</p>
                                                                        <h3 className="text-2xl font-black text-emerald-900">
                                                                            {performanceData.length > 0 ? Math.round((performanceData.reduce((acc, d) => acc + d.basePresent, 0) / (performanceData.length * (managerTeam.length || 1))) * 100) : 0}%
                                                                        </h3>
                                                                    </div>
                                                                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 shadow-sm">
                                                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Tardiness Rate</p>
                                                                        <h3 className="text-2xl font-black text-amber-900">
                                                                            {performanceData.reduce((acc, d) => acc + d.basePresent, 0) > 0 ? Math.round((performanceData.reduce((acc, d) => acc + d.late, 0) / (performanceData.reduce((acc, d) => acc + d.basePresent, 0) || 1)) * 100) : 0}%
                                                                        </h3>
                                                                    </div>
                                                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
                                                                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Staff Count</p>
                                                                        <h3 className="text-2xl font-black text-slate-900">{managerTeam.length} Members</h3>
                                                                    </div>
                                                                </div>

                                                                {/* Individual Staff Cards */}
                                                                <div className="pt-8 border-t border-border">
                                                                    <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                                                                        <Users className="h-4 w-4 text-primary" />
                                                                        Individual Performance Breakdown
                                                                    </h3>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                                                        {managerTeam.map(member => (
                                                                            <StaffPerformanceCard
                                                                                key={member.id}
                                                                                user={member}
                                                                                attendanceRecords={rawPerformanceData.filter((a: any) => a.userId === member.id)}
                                                                                dateRange={{ start: perfStartDate, end: perfEndDate }}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground opacity-50 italic">
                                                                No attendance data available for the selected range
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </TabsContent>

                                            <TabsContent value="reports" className="m-0 animate-in slide-in-from-right-4 duration-300">
                                                <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                                                    <CardHeader className="bg-primary border-b border-primary/20 p-8">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-14 w-14 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30 backdrop-blur-sm">
                                                                <Download className="w-7 h-7 text-white" />
                                                            </div>
                                                            <div>
                                                                <CardTitle className="text-xl font-black text-white tracking-tight">Audit Report Generator</CardTitle>
                                                                <CardDescription className="text-white/70 font-medium">Generate XLSX ledger for all staff under this manager</CardDescription>
                                                            </div>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-8">
                                                        <div className="max-w-md mx-auto space-y-8">
                                                            <div className="space-y-4">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Start Date</Label>
                                                                        <Input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="h-11 rounded-xl" />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">End Date</Label>
                                                                        <Input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="h-11 rounded-xl" />
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Target Department</Label>
                                                                    <Select
                                                                        value={reportDeptFilter}
                                                                        onValueChange={(val) => {
                                                                            setReportDeptFilter(val)
                                                                            setReportStaffFilter([]) // Reset staff filter when department changes
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="h-11 rounded-xl bg-white border-border">
                                                                            <SelectValue placeholder="All Managed Departments" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="all">All Managed Departments</SelectItem>
                                                                            {managerDepartments.map(d => (
                                                                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>

                                                                <div className="space-y-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                                            Personnel Selection ({reportStaffFilter.length === 0 ? 'All' : reportStaffFilter.length})
                                                                        </Label>
                                                                        {(() => {
                                                                            const team = reportDeptFilter === "all"
                                                                                ? managerTeam
                                                                                : managerTeam.filter(e => e.departmentId === reportDeptFilter);
                                                                            if (team.length === 0) return null;
                                                                            return (
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    className="h-6 text-[9px] font-black uppercase tracking-widest text-primary hover:text-primary/80"
                                                                                    onClick={() => {
                                                                                        if (reportStaffFilter.length === team.length) {
                                                                                            setReportStaffFilter([])
                                                                                        } else {
                                                                                            setReportStaffFilter(team.map(s => s.id))
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    {reportStaffFilter.length === team.length ? 'Deselect All' : 'Select All'}
                                                                                </Button>
                                                                            )
                                                                        })()}
                                                                    </div>
                                                                    <div className="border border-slate-100 rounded-2xl bg-slate-50/50 p-4 max-h-[180px] overflow-y-auto space-y-2 custom-scrollbar shadow-inner">
                                                                        {(() => {
                                                                            const team = reportDeptFilter === "all"
                                                                                ? managerTeam
                                                                                : managerTeam.filter(e => e.departmentId === reportDeptFilter);

                                                                            if (team.length === 0) {
                                                                                return <p className="text-[10px] text-center py-6 text-slate-400 font-bold uppercase tracking-widest italic">No staff in this scope</p>
                                                                            }

                                                                            return (
                                                                                <div className="grid grid-cols-1 gap-1.5">
                                                                                    {team.map(member => (
                                                                                        <div
                                                                                            key={member.id}
                                                                                            onClick={() => {
                                                                                                setReportStaffFilter(prev =>
                                                                                                    prev.includes(member.id)
                                                                                                        ? prev.filter(id => id !== member.id)
                                                                                                        : [...prev, member.id]
                                                                                                )
                                                                                            }}
                                                                                            className={cn(
                                                                                                "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border shadow-sm",
                                                                                                reportStaffFilter.includes(member.id)
                                                                                                    ? "bg-primary/10 border-primary/20 text-primary"
                                                                                                    : "bg-white border-slate-200/50 hover:bg-white/80 hover:border-slate-300"
                                                                                            )}
                                                                                        >
                                                                                            <div className={cn(
                                                                                                "w-4 h-4 rounded-md border flex items-center justify-center transition-all",
                                                                                                reportStaffFilter.includes(member.id)
                                                                                                    ? "bg-primary border-primary text-white"
                                                                                                    : "bg-white border-slate-300"
                                                                                            )}>
                                                                                                {reportStaffFilter.includes(member.id) && <CheckCircle2 className="w-3 h-3" />}
                                                                                            </div>
                                                                                            <div>
                                                                                                <p className="text-xs font-bold leading-tight truncate">{member.name}</p>
                                                                                                <p className="text-[9px] text-slate-400 font-medium truncate uppercase tracking-tighter">
                                                                                                    {departments.find(d => d.id === member.departmentId)?.name || 'Misc'}
                                                                                                </p>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )
                                                                        })()}
                                                                    </div>
                                                                </div>

                                                                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center justify-between">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="h-10 w-10 bg-white rounded-xl shadow-sm border border-primary/10 flex items-center justify-center">
                                                                            <Building2 className="w-5 h-5 text-primary/40" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[10px] font-black text-primary/60 uppercase tracking-tighter">Selected Scope</p>
                                                                            <p className="text-sm font-bold text-slate-700">
                                                                                {reportStaffFilter.length > 0
                                                                                    ? `${reportStaffFilter.length} Selected Personnel`
                                                                                    : reportDeptFilter === "all"
                                                                                        ? `All managed staff (${managerTeam.length})`
                                                                                        : `${managerTeam.filter(e => e.departmentId === reportDeptFilter).length} Staff in Dept.`
                                                                                }
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <Badge className="bg-primary/10 text-primary border-primary/20 uppercase text-[10px] font-black shadow-none px-3">Standard XLSX</Badge>
                                                                </div>
                                                            </div>

                                                            <Button
                                                                onClick={generateReport}
                                                                disabled={isGeneratingReport}
                                                                className="w-full h-14 rounded-2xl text-md font-black shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                                            >
                                                                {isGeneratingReport ? (
                                                                    <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Compiling Ledger...</>
                                                                ) : (
                                                                    <><Download className="w-5 h-5 mr-3" /> Export Manager's Data</>
                                                                )}
                                                            </Button>

                                                            <p className="text-[10px] text-center text-slate-400 font-medium leading-relaxed">
                                                                Reports are generated using the admin's active timezone ({userTimeZone}).<br />
                                                                This export includes raw attendance, tardiness markers, and total durations.
                                                            </p>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </TabsContent>
                                        </div>
                                    </Tabs>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            <Dialog open={isDeclineDialogOpen} onOpenChange={setIsDeclineDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Decline Request</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for declining this request.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Reason</Label>
                            <Textarea
                                value={declineReason}
                                onChange={e => setDeclineReason(e.target.value)}
                                placeholder="e.g. Insufficient staffing coverage..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeclineDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => selectedLeafForAction && handleStatusUpdate(selectedLeafForAction, 'DECLINED', declineReason)}
                            disabled={!declineReason.trim() || !!processingId}
                        >
                            {processingId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Decline"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserCog className="h-5 w-5" />
                            Edit Request Details
                        </DialogTitle>
                        <DialogDescription>
                            Modify the core details of this {editingItem?.kind.toLowerCase()} record.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">Type</Label>
                                <Select value={editForm.type} onValueChange={(v) => setEditForm({ ...editForm, type: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {editingItem?.kind === 'ATTENDANCE' ? (
                                            <>
                                                <SelectItem value="CLOCK_IN">Clock In</SelectItem>
                                                <SelectItem value="CLOCK_OUT">Clock Out</SelectItem>
                                                <SelectItem value="BREAK_START">Break Start</SelectItem>
                                                <SelectItem value="BREAK_END">Break End</SelectItem>
                                            </>
                                        ) : (
                                            <>
                                                <SelectItem value="ANNUAL">Annual Leave</SelectItem>
                                                <SelectItem value="SICK">Sick / Personal Leave</SelectItem>
                                                <SelectItem value="PERSONAL">Personal Leave</SelectItem>
                                                <SelectItem value="MATERNITY">Maternity</SelectItem>
                                                <SelectItem value="OTHER">Other</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">Status</Label>
                                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="APPROVED">Approved</SelectItem>
                                        <SelectItem value="DECLINED">Declined</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">{editingItem?.kind === 'ATTENDANCE' ? 'Date' : 'Start Date'}</Label>
                                <Input
                                    type="date"
                                    value={editForm.startDate}
                                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                                />
                            </div>
                            {editingItem?.kind === 'LEAVE' && (
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">End Date</Label>
                                    <Input
                                        type="date"
                                        value={editForm.endDate}
                                        onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {editingItem?.kind === 'ATTENDANCE' ? (
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Time</Label>
                                    <Input
                                        type="time"
                                        value={editForm.time}
                                        onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase font-bold text-muted-foreground">Start Time</Label>
                                        <Input
                                            type="time"
                                            value={editForm.startTime}
                                            onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase font-bold text-muted-foreground">End Time</Label>
                                        <Input
                                            type="time"
                                            value={editForm.endTime}
                                            onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">Reason</Label>
                            <Textarea
                                value={editForm.reason}
                                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                                className="h-20"
                            />
                        </div>

                        <DialogFooter className="pt-4">
                            <Button variant="outline" type="button" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={!!processingId}>
                                {processingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
