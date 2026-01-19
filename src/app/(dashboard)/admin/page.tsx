"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Clock, Coffee, CalendarOff, UserMinus, Search, Building2, MapPin, Loader2, CheckCircle2, TrendingUp, Activity, Flame, ShieldAlert, Zap } from "lucide-react"
import { io } from "socket.io-client"

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

    // Filters
    const [searchTerm, setSearchTerm] = useState("")
    const [deptFilter, setDeptFilter] = useState("all")
    const [statusFilter, setStatusFilter] = useState("all")

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

                    setEmployees(emps)
                    setDepartments(depts)
                    setAttendanceRecords(atts)

                    // Calculate stats
                    const clockedIn = atts.filter((a: any) => a.status === 'clocked-in').length
                    const onBreak = atts.filter((a: any) => a.status === 'on-break').length
                    const onLeave = atts.filter((a: any) => a.status === 'on-leave').length
                    const totalStaff = emps.length

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

        const socket = io({
            path: '/api/socket/io',
        })

        socket.on("update-data", () => {
            fetchData()
        })

        return () => {
            socket.disconnect()
        }
    }, [])

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

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesDept = deptFilter === "all" || emp.departmentId === deptFilter

        // Find attendance record for this emp
        const record = attendanceRecords.find(a => a.userId === emp.id)
        const status = record?.status || "absent"
        const matchesStatus = statusFilter === "all" || status === statusFilter

        return matchesSearch && matchesDept && matchesStatus
    })

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Loading Dashboard...</p>
            </div>
        )
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                    { label: "Total Staff", value: stats.totalStaff, icon: Users, sub: "Authorized Personnel", color: "blue" },
                    { label: "Active Staff", value: stats.clockedIn, icon: Zap, sub: `${Math.round((stats.clockedIn / stats.totalStaff) * 100) || 0}% Clocked In`, color: "green" },
                    { label: "On Break", value: stats.onBreak, icon: Coffee, sub: "Temporary Idle", color: "yellow" },
                    { label: "On Leave", value: stats.onLeave, icon: CalendarOff, sub: "Scheduled Exit", color: "slate" },
                    { label: "Absent", value: stats.absent, icon: ShieldAlert, sub: "Not Clocked In", color: "red" }
                ].map((stat, i) => (
                    <Card key={i} className="border border-border shadow-sm rounded-xl bg-white overflow-hidden relative group">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 px-6 pt-6">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                            <stat.icon className={`h-4 w-4 text-muted-foreground`} />
                        </CardHeader>
                        <CardContent className="px-6 pb-6">
                            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                            <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
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
                        {attendanceRecords.length > 0 ? (
                            <div className="divide-y divide-border">
                                {attendanceRecords.slice(0, 5).map((record) => (
                                    <div key={record.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-all duration-200">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium text-sm">
                                                {record.userName?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground text-sm">{record.userName}</p>
                                                <p className="text-xs text-muted-foreground">{record.department}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="outline" className="font-normal text-xs">
                                                {record.status.replace('-', ' ')}
                                            </Badge>
                                            <p className="text-xs text-muted-foreground mt-1 font-mono">
                                                {new Date(record.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground opacity-50">
                                <Clock className="h-8 w-8 mb-2" />
                                <p className="text-sm font-medium">No active logs</p>
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
                    <CardContent className="p-6 space-y-6">
                        {departments.map(dept => {
                            const deptEmps = employees.filter(e => e.departmentId === dept.id)
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
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Personnel</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Department</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground text-center">Status</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground">Metrics</TableHead>
                                <TableHead className="py-4 px-6 font-medium text-muted-foreground text-right">Access</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredEmployees.map((emp) => {
                                const record = attendanceRecords.find(a => a.userId === emp.id)
                                const status = record?.status || "absent"

                                return (
                                    <TableRow key={emp.id} className="hover:bg-muted/50 transition-all duration-200">
                                        <TableCell className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground font-medium relative overflow-hidden text-sm">
                                                    {emp.image ? <img src={emp.image} alt="" className="h-full w-full object-cover" /> : (emp.name?.charAt(0) || "U")}
                                                    <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 border-2 border-white rounded-full ${status === 'clocked-in' ? 'bg-green-500' :
                                                        status === 'on-break' ? 'bg-yellow-500' : 'bg-slate-300'
                                                        }`} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-foreground text-sm leading-tight">{emp.name || "Unknown Identity"}</span>
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
                                            <Badge variant="outline" className={`font-normal ${status === 'clocked-in' ? 'bg-green-50 text-green-700 border-green-200' :
                                                status === 'on-break' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                    status === 'on-leave' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        status === 'clocked-out' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                                            'bg-red-50 text-red-600 border-red-100'
                                                }`}>
                                                {status.replace('-', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                                    <span>{record?.clockIn ? new Date(record.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}</span>
                                                </div>
                                                <span className="text-xs text-muted-foreground font-mono tabular-nums">{calculateLiveDuration(record)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4 px-6 text-right">
                                            {record?.mode ? (
                                                <div className="flex items-center justify-end gap-1.5 text-muted-foreground">
                                                    <MapPin className="h-3 w-3" />
                                                    <span className="text-xs font-medium">{record.mode}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">Offline</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
