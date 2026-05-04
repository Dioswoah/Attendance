"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Users, Clock, Coffee, CalendarOff, UserMinus, Search, Building2, MapPin, Loader2, CheckCircle2, TrendingUp, Activity, Flame, ShieldAlert, Zap, Home, Briefcase, MoreHorizontal } from "lucide-react"
import { io } from "socket.io-client"
import { useSession } from "next-auth/react"
import { getBrowserTimezone } from "@/lib/timezone"
import { statusConfig } from "@/components/UserStatusDropdown"
import { UserAvatar } from "@/components/UserAvatar"

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalStaff: 0,
        clockedIn: 0,
        onBreak: 0,
        onLeave: 0,
        absent: 0
    })
    const [employees, setEmployees] = useState<any[]>([])
    const [departments, setDepartments] = useState<any[]>([])
    const [attendanceRecords, setAttendanceRecords] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Dialog state for staff details
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogTitle, setDialogTitle] = useState("")
    const [dialogStaff, setDialogStaff] = useState<any[]>([])

    // Filters
    const [searchTerm, setSearchTerm] = useState("")
    const [deptFilter, setDeptFilter] = useState("all")
    const [statusFilter, setStatusFilter] = useState("all")
    const [sortBy, setSortBy] = useState("name")

    // Timezone Logic
    const { data: session } = useSession()
    const userTimeZone = (session?.user as any)?.useCurrentTimezone
        ? getBrowserTimezone()
        : (session?.user as any)?.selectedTimezone || getBrowserTimezone()

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [empRes, deptRes, attRes] = await Promise.all([
                    fetch('/api/employees'),
                    fetch('/api/departments'),
                    fetch('/api/attendance')
                ])

                if (empRes.ok && deptRes.ok && attRes.ok) {
                    const emps = await empRes.json()
                    const depts = await deptRes.json()
                    const atts = await attRes.json()

                    const activeEmps = emps.filter((e: any) => !e.isArchived)
                    const activeEmpIds = new Set(activeEmps.map((e: any) => e.id))

                    setEmployees(activeEmps)
                    setDepartments(depts)
                    setAttendanceRecords(atts)

                    // Calculate stats for active employees only
                    const activeAtts = atts.filter((a: any) => activeEmpIds.has(a.userId))

                    const clockedIn = activeAtts.filter((a: any) => a.status === 'clocked-in').length
                    const onBreak = activeAtts.filter((a: any) => a.status === 'on-break').length
                    const onLeave = activeAtts.filter((a: any) => a.status === 'on-leave').length
                    const totalStaff = activeEmps.length

                    setStats({
                        totalStaff,
                        clockedIn,
                        onBreak,
                        onLeave,
                        absent: totalStaff - (clockedIn + onBreak + onLeave)
                    })
                }
            } catch (error) {
                console.error("Failed to fetch dashboard data")
            } finally {
                setLoading(false)
            }
        }

        fetchData()

        // Realtime Updates via SSE
        let eventSource: EventSource | null = null;
        if (typeof EventSource !== 'undefined') {
            eventSource = new EventSource('/api/stream');
            eventSource.onmessage = (event) => {
                if (event.data === ': heartbeat' || event.data.includes('connected')) return;
                try {
                    const payload = JSON.parse(event.data);
                    // Refresh if attendance, leaves, or STAFF status changes
                    if (['attendance', 'leaves', 'staff'].includes(payload.type)) {
                        fetchData();
                    }
                } catch (e) {
                    // Silently fail parse
                }
            };
        }

        return () => {
            if (eventSource) eventSource.close();
        }
    }, [])

    const activityFeed = useMemo(() => {
        const feed: any[] = []
        attendanceRecords.forEach(record => {
            const emp = employees.find((e: any) => e.id === record.userId)
            if (record.clockIn) {
                feed.push({
                    id: `${record.id}-in`,
                    userName: record.userName,
                    userImage: record.userImage,
                    department: record.department,
                    type: 'clock-in',
                    timestamp: new Date(record.clockIn),
                    timezone: emp?.selectedTimezone || (emp?.employmentLocation === 'Australia' ? 'Australia/Sydney' : 'Asia/Manila')
                })
            }
            if (record.breaks && Array.isArray(record.breaks)) {
                record.breaks.forEach((b: any) => {
                    feed.push({
                        id: `${b.id}-start`,
                        userName: record.userName,
                        userImage: record.userImage,
                        department: record.department,
                        type: 'start-break',
                        timestamp: new Date(b.startTime),
                        timezone: emp?.selectedTimezone || (emp?.employmentLocation === 'Australia' ? 'Australia/Sydney' : 'Asia/Manila')
                    })
                    if (b.endTime) {
                        feed.push({
                            id: `${b.id}-end`,
                            userName: record.userName,
                            userImage: record.userImage,
                            department: record.department,
                            type: 'end-break',
                            timestamp: new Date(b.endTime),
                            timezone: emp?.selectedTimezone || (emp?.employmentLocation === 'Australia' ? 'Australia/Sydney' : 'Asia/Manila')
                        })
                    }
                })
            }
            if (record.clockOut) {
                feed.push({
                    id: `${record.id}-out`,
                    userName: record.userName,
                    userImage: record.userImage,
                    department: record.department,
                    type: 'clock-out',
                    timestamp: new Date(record.clockOut),
                    timezone: emp?.selectedTimezone || (emp?.employmentLocation === 'Australia' ? 'Australia/Sydney' : 'Asia/Manila')
                })
            }
        })
        return feed.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    }, [attendanceRecords, employees])

    // Live Clock State
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
            // If break is ongoing (no breakEnd), use current time (now) unless clocked out
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

    // Handle stat card click to show staff details
    const handleStatClick = (statType: string) => {
        let staff: any[] = []
        let title = ""

        switch (statType) {
            case "total":
                staff = employees
                title = "All Staff Members"
                break
            case "active":
                staff = employees.filter(emp =>
                    attendanceRecords.some(a => a.userId === emp.id && a.status === 'clocked-in')
                )
                title = "Active Staff (Clocked In)"
                break
            case "break":
                staff = employees.filter(emp =>
                    attendanceRecords.some(a => a.userId === emp.id && a.status === 'on-break')
                )
                title = "Staff On Break"
                break
            case "leave":
                staff = employees.filter(emp =>
                    attendanceRecords.some(a => a.userId === emp.id && a.status === 'on-leave')
                )
                title = "Staff On Leave"
                break
            case "absent":
                staff = employees.filter(emp =>
                    !attendanceRecords.some(a => a.userId === emp.id && a.status !== 'absent')
                )
                title = "Absent Staff"
                break
        }

        setDialogTitle(title)
        setDialogStaff(staff)
        setDialogOpen(true)
    }

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesDept = deptFilter === "all" ||
            emp.departmentId === deptFilter ||
            (emp.secondaryDepartments || []).some((d: any) => d.id === deptFilter)

        const record = attendanceRecords.find(a => a.userId === emp.id)
        const status = record?.status || "absent"
        const matchesStatus = statusFilter === "all" || status === statusFilter

        return matchesSearch && matchesDept && matchesStatus
    })

    const sortedEmployees = useMemo(() => {
        return [...filteredEmployees].sort((a, b) => {
            const aRecord = attendanceRecords.find(rec => rec.userId === a.id)
            const bRecord = attendanceRecords.find(rec => rec.userId === b.id)
            const aStatus = aRecord?.status || "absent"
            const bStatus = bRecord?.status || "absent"
            const aLocation = aRecord?.mode || "OFFLINE"
            const bLocation = bRecord?.mode || "OFFLINE"

            switch (sortBy) {
                case "name":
                    return (a.name || "").localeCompare(b.name || "");
                case "department":
                    const aDept = a.department?.name || a.department || "";
                    const bDept = b.department?.name || b.department || "";
                    return String(aDept).localeCompare(String(bDept));
                case "status":
                    return aStatus.localeCompare(bStatus);
                case "location":
                    return aLocation.localeCompare(bLocation);
                default:
                    return 0;
            }
        })
    }, [filteredEmployees, sortBy, attendanceRecords])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
                <div className="h-20 w-20 bg-white rounded-2xl flex items-center justify-center shadow-sm overflow-hidden animate-bounce p-2">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Dashboard...</p>
            </div>
        )
    }

    return (
        <div className="w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-500 pb-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground text-sm">Workforce Monitoring & Attendance Overview</p>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-border shadow-sm">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-medium text-muted-foreground">Live Status Active</span>
                </div>
            </div>

            {/* Top Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {[
                    { label: "Total Staff", value: stats.totalStaff, icon: Users, sub: "Authorized Personnel", color: "blue", type: "total" },
                    { label: "Active Staff", value: stats.clockedIn, icon: Zap, sub: `${Math.round((stats.clockedIn / stats.totalStaff) * 100) || 0}% Clocked In`, color: "green", type: "active" },
                    { label: "On Break", value: stats.onBreak, icon: Coffee, sub: "Temporary Idle", color: "yellow", type: "break" },
                    { label: "On Leave", value: stats.onLeave, icon: CalendarOff, sub: "Scheduled Exit", color: "slate", type: "leave" },
                    { label: "Absent", value: stats.absent, icon: ShieldAlert, sub: "Not Clocked In", color: "red", type: "absent" }
                ].map((stat, i) => (
                    <Card
                        key={i}
                        className="border border-border shadow-sm rounded-xl bg-white overflow-hidden relative group cursor-pointer hover:shadow-md hover:border-primary/50 transition-all duration-200"
                        onClick={() => handleStatClick(stat.type)}
                    >
                        <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
                            <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground leading-tight">{stat.label}</CardTitle>
                            <stat.icon className={`h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground group-hover:text-primary transition-colors`} />
                        </CardHeader>
                        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                            <div className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</div>
                            <p className="text-[9px] sm:text-xs text-muted-foreground mt-1 leading-tight line-clamp-2">{stat.sub}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Middle Row: Activity & Dept Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                    <CardHeader className="bg-white p-6 border-b border-border">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-lg font-semibold text-foreground">Recent Activity</CardTitle>
                                <CardDescription className="text-muted-foreground text-sm">Live attendance feed</CardDescription>
                            </div>
                            <Activity className="h-5 w-5 text-muted-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {activityFeed.length > 0 ? (
                            <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                                {activityFeed.map((log) => (
                                    <div key={log.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-all duration-200">
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium text-sm overflow-hidden border border-border">
                                                    <UserAvatar src={log.userImage} name={log.userName} className="h-full w-full" />
                                                </div>
                                                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-100 z-10">
                                                    {log.type === 'clock-in' && <Zap className="h-3 w-3 text-green-500 fill-green-500" />}
                                                    {log.type === 'clock-out' && <CheckCircle2 className="h-3 w-3 text-slate-500" />}
                                                    {log.type === 'start-break' && <Coffee className="h-3 w-3 text-amber-500" />}
                                                    {log.type === 'end-break' && <Zap className="h-3 w-3 text-blue-500" />}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground text-sm leading-tight">{log.userName}</p>
                                                <p className="text-xs text-muted-foreground">{log.department}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="outline" className={`font-normal text-xs mb-1 ${log.type === 'clock-in' ? 'bg-green-50 text-green-700 border-green-200' :
                                                log.type === 'start-break' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    log.type === 'end-break' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        'bg-slate-50 text-slate-700 border-slate-200'
                                                }`}>
                                                {log.type === 'clock-in' ? 'Clocked In' :
                                                    log.type === 'start-break' ? 'Started Break' :
                                                        log.type === 'end-break' ? 'Resumed Work' :
                                                            'Clocked Out'}
                                            </Badge>
                                            <p className="text-xs text-muted-foreground font-mono">
                                                {log.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: log.timezone || userTimeZone })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground opacity-50">
                                <Clock className="h-8 w-8 mb-2" />
                                <p className="text-sm font-medium">No active logs today</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                    <CardHeader className="bg-white border-b border-border p-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-lg font-semibold text-foreground">Department Distribution</CardTitle>
                                <CardDescription className="text-muted-foreground text-sm">Active staff by department</CardDescription>
                            </div>
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6 max-h-[400px] overflow-y-auto">
                        {departments.map(dept => {
                            const deptEmps = employees.filter(e =>
                                e.departmentId === dept.id ||
                                (e.secondaryDepartments || []).some((d: any) => d.id === dept.id)
                            )
                            const present = deptEmps.filter(e => attendanceRecords.some(a => a.userId === e.id && a.status !== 'absent')).length
                            const percentage = (present / deptEmps.length) * 100 || 0

                            return (
                                <div key={dept.id} className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-0.5">
                                            <span className="text-sm font-medium text-foreground">{dept.name}</span>
                                            <p className="text-xs text-muted-foreground">{present}/{deptEmps.length} Active</p>
                                        </div>
                                        <span className="text-xs font-semibold text-primary">{Math.round(percentage)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 ease-out rounded-full ${percentage > 0 ? 'bg-primary' : 'bg-muted-foreground/20'}`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Section: Full Employee Table */}
            <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                <CardHeader className="bg-white p-6 border-b border-border">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-1">
                            <CardTitle className="text-lg font-semibold text-foreground">Staff Overview</CardTitle>
                            <CardDescription className="text-sm text-muted-foreground">Real-time status of all personnel</CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search staff..."
                                    className="pl-9 h-10 w-[240px] bg-background rounded-lg text-sm"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Select value={deptFilter} onValueChange={setDeptFilter}>
                                <SelectTrigger className="h-10 w-[160px] bg-background rounded-lg text-sm">
                                    <SelectValue placeholder="Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Departments</SelectItem>
                                    {departments.map(d => (
                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="h-10 w-[140px] bg-background rounded-lg text-sm">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="clocked-in">Active</SelectItem>
                                    <SelectItem value="on-break">Break</SelectItem>
                                    <SelectItem value="on-leave">On Leave</SelectItem>
                                    <SelectItem value="clocked-out">Offline</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="h-10 w-[160px] bg-background rounded-lg text-sm">
                                    <SelectValue placeholder="Sort By" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="name">First Name</SelectItem>
                                    <SelectItem value="department">Department</SelectItem>
                                    <SelectItem value="status">Status</SelectItem>
                                    <SelectItem value="location">Location</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto relative w-full">
                    <Table className="min-w-[800px]">
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Personnel</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Department</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground text-center">Status</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Metrics</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground text-right">Location</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedEmployees.map((emp) => {
                                const record = attendanceRecords.find(a => a.userId === emp.id)
                                const status = record?.status || "absent"

                                return (
                                    <TableRow key={emp.id} className="hover:bg-muted/50 transition-all duration-200">
                                        <TableCell className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className="h-9 w-9 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground font-medium relative overflow-hidden text-sm">
                                                        <UserAvatar src={emp.image} name={emp.name} className="h-full w-full" />
                                                    </div>
                                                    {/* Status Indicator */}
                                                    {(() => {
                                                        const isOnline = status === 'clocked-in' || status === 'on-break'
                                                        const effectiveStatus = isOnline ? (emp.availabilityStatus || 'AVAILABLE') : 'APPEAR_OFFLINE'
                                                        const statusItem = statusConfig[effectiveStatus as keyof typeof statusConfig]

                                                        if (!statusItem) return null

                                                        const StatusIcon = statusItem.icon
                                                        const statusColor = statusItem.color
                                                        return (
                                                            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-100 z-10" title={statusItem.label}>
                                                                <StatusIcon className={`h-3 w-3 ${statusColor}`} />
                                                            </div>
                                                        )
                                                    })()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-foreground text-sm leading-tight flex items-center gap-2">
                                                        {emp.name || "Unknown Identity"}
                                                        {(() => {
                                                            const isOnline = status === 'clocked-in' || status === 'on-break'
                                                            const effectiveStatus = isOnline ? (emp.availabilityStatus || 'AVAILABLE') : 'APPEAR_OFFLINE'
                                                            const statusLabel = statusConfig[effectiveStatus as keyof typeof statusConfig]?.label

                                                            if (!statusLabel) return null

                                                            return (
                                                                <span className="text-[10px] text-muted-foreground/60 font-medium px-1.5 py-0.5 bg-slate-100 rounded-full scale-90 origin-left">
                                                                    {emp.customStatusMessage || statusLabel}
                                                                </span>
                                                            )
                                                        })()}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">{emp.email}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4 px-6">
                                            <span className="text-sm text-foreground">
                                                {emp.department?.name || "Unassigned"}
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
                                                        Returns {new Date(record.returnDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: emp.selectedTimezone || (emp.employmentLocation === 'Australia' ? 'Australia/Sydney' : 'Asia/Manila') })}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                                    <span>{record?.clockIn ? new Date(record.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: emp.selectedTimezone || (emp.employmentLocation === 'Australia' ? 'Australia/Sydney' : 'Asia/Manila') }) : '---'}</span>
                                                </div>
                                                <span className="text-xs text-muted-foreground font-mono tabular-nums">{calculateLiveDuration(record)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4 px-6 text-right">
                                            {record?.mode && status !== 'on-leave' ? (
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {record.mode === 'OFFICE' ? (
                                                            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                                                                <Building2 className="h-3 w-3" />
                                                                In Office
                                                            </Badge>
                                                        ) : record.mode === 'WFH' ? (
                                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                                                                <Home className="h-3 w-3" />
                                                                WFH
                                                            </Badge>
                                                        ) : record.mode === 'ONSITE' ? (
                                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                                                                <Briefcase className="h-3 w-3" />
                                                                Offsite
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                                                                <MoreHorizontal className="h-3 w-3" />
                                                                {record.mode === 'ONSITE' ? 'OFFSITE' : record.mode.replace('_', ' ')}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {record.locationDetails && (
                                                        <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[150px]" title={record.locationDetails}>
                                                            {record.locationDetails}
                                                        </span>
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
                </CardContent>
            </Card>

            {/* Staff Details Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-foreground">{dialogTitle}</DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            {dialogStaff.length} {dialogStaff.length === 1 ? 'person' : 'people'} in this category
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-2">
                        {dialogStaff.length > 0 ? (
                            <div className="space-y-2">
                                {dialogStaff.map((staff) => {
                                    const dept = departments.find(d => d.id === staff.departmentId)
                                    const attendance = attendanceRecords.find(a => a.userId === staff.id)

                                    return (
                                        <div
                                            key={staff.id}
                                            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                                                    {staff.name?.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-foreground">{staff.name}</p>
                                                    <p className="text-sm text-muted-foreground">{dept?.name || 'No Department'}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                {attendance ? (
                                                    <Badge variant="outline" className="font-medium">
                                                        {attendance.status.replace('-', ' ').toUpperCase()}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                        Absent
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <Users className="h-12 w-12 mb-3 opacity-50" />
                                <p className="text-sm font-medium">No staff in this category</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
