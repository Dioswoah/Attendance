"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Clock, Coffee, CalendarOff, UserMinus, Search, Building2, MapPin, Loader2, CheckCircle2, TrendingUp, Activity, Flame, ShieldAlert, Zap } from "lucide-react"

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
                    const totalStaff = emps.length

                    setStats({
                        totalStaff,
                        clockedIn,
                        onBreak,
                        onLeave: 0, // Not implemented yet
                        absent: totalStaff - (clockedIn + onBreak)
                    })
                }
            } catch (error) {
                console.error("Failed to fetch dashboard data")
            } finally {
                setLoading(false)
            }
        }

        fetchData()
        const interval = setInterval(fetchData, 30000) // Refresh every 30s
        return () => clearInterval(interval)
    }, [])

    const calculateHours = (start?: string, end?: string) => {
        if (!start || !end) return "0h 0m"
        const diff = new Date(end).getTime() - new Date(start).getTime()
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        return `${hours}h ${mins}m`
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
                <div className="h-12 w-12 rounded-xl bg-red-600 flex items-center justify-center animate-bounce shadow-lg">
                    <Flame className="h-6 w-6 text-white fill-white" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Intelligence...</p>
            </div>
        )
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase leading-none">Dashboard</h1>
                    <p className="text-red-600 font-bold uppercase tracking-[0.2em] text-[10px] ml-1">Workforce Monitoring & Attendance Overview</p>
                </div>
                <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Status Active</span>
                </div>
            </div>

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {[
                    { label: "Total Staff", value: stats.totalStaff, icon: Users, sub: "Authorized Personnel", color: "red" },
                    { label: "Active Staff", value: stats.clockedIn, icon: Zap, sub: `${Math.round((stats.clockedIn / stats.totalStaff) * 100) || 0}% Clocked In`, color: "yellow" },
                    { label: "On Break", value: stats.onBreak, icon: Coffee, sub: "Temporary Idle", color: "orange" },
                    { label: "On Leave", value: stats.onLeave, icon: CalendarOff, sub: "Scheduled Exit", color: "slate" },
                    { label: "Absent", value: stats.absent, icon: ShieldAlert, sub: "Not Clocked In", color: "red" }
                ].map((stat, i) => (
                    <Card key={i} className="border-none shadow-sm rounded-3xl bg-white border border-slate-50 overflow-hidden relative group">
                        <div className={`absolute top-0 left-0 w-1.5 h-full ${stat.color === 'red' ? 'bg-red-600' : stat.color === 'yellow' ? 'bg-yellow-500' : stat.color === 'orange' ? 'bg-orange-500' : 'bg-slate-300'}`} />
                        <CardHeader className="flex flex-row items-center justify-between pb-2 px-6 pt-6">
                            <CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</CardTitle>
                            <stat.icon className={`h-4 w-4 ${stat.color === 'red' ? 'text-red-600' : stat.color === 'yellow' ? 'text-yellow-600' : stat.color === 'orange' ? 'text-orange-600' : 'text-slate-400'}`} />
                        </CardHeader>
                        <CardContent className="px-6 pb-6">
                            <div className="text-3xl font-black text-slate-900 tracking-tighter italic">{stat.value}</div>
                            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{stat.sub}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Middle Row: Activity & Dept Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white border border-slate-50">
                    <CardHeader className="bg-white p-8 border-b border-slate-50">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-lg font-black text-slate-900 italic uppercase">Recent Activity</CardTitle>
                                <CardDescription className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Live attendance feed</CardDescription>
                            </div>
                            <Activity className="h-5 w-5 text-red-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {attendanceRecords.length > 0 ? (
                            <div className="divide-y divide-slate-50">
                                {attendanceRecords.slice(0, 5).map((record) => (
                                    <div key={record.id} className="flex items-center justify-between p-6 hover:bg-slate-50 transition-all duration-200">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 font-black italic shadow-sm border border-slate-100">
                                                {record.userName?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 uppercase italic text-xs">{record.userName}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{record.department}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="outline" className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border-none ${record.status === 'clocked-in' ? 'bg-red-50 text-red-600' :
                                                record.status === 'on-break' ? 'bg-yellow-50 text-yellow-700' :
                                                    'bg-slate-100 text-slate-500'
                                                }`}>
                                                {record.status.replace('-', ' ')}
                                            </Badge>
                                            <p className="text-[9px] font-bold text-slate-400 italic mt-1.5 flex items-center justify-end gap-1">
                                                <Clock className="h-2.5 w-2.5" />
                                                {new Date(record.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-200 opacity-50">
                                <Clock className="h-8 w-8 mb-2" />
                                <p className="text-[9px] font-black uppercase tracking-widest">No active logs</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white border border-slate-50">
                    <CardHeader className="bg-white border-b border-slate-50 p-8">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-lg font-black text-slate-900 italic uppercase">Department Distribution</CardTitle>
                                <CardDescription className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Active staff by department</CardDescription>
                            </div>
                            <Building2 className="h-5 w-5 text-red-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                        {departments.map(dept => {
                            const deptEmps = employees.filter(e => e.departmentId === dept.id)
                            const present = deptEmps.filter(e => attendanceRecords.some(a => a.userId === e.id && a.status !== 'absent')).length
                            const percentage = (present / deptEmps.length) * 100 || 0

                            return (
                                <div key={dept.id} className="space-y-2.5">
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black text-slate-800 uppercase italic tracking-widest">{dept.name}</span>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{present}/{deptEmps.length} Active</p>
                                        </div>
                                        <span className="text-[10px] font-black text-red-600 italic">{Math.round(percentage)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 ease-out rounded-full ${percentage > 0 ? 'bg-red-600' : 'bg-slate-200'}`}
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
            <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white border border-slate-50">
                <CardHeader className="bg-white p-8 border-b border-slate-50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                        <div className="space-y-1">
                            <CardTitle className="text-xl font-black text-slate-900 italic uppercase leading-none">Staff Overview</CardTitle>
                            <CardDescription className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Real-time status of all personnel</CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <Input
                                    placeholder="SEARCH IDENTITY..."
                                    className="pl-10 h-11 w-[240px] bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all focus:bg-white"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Select value={deptFilter} onValueChange={setDeptFilter}>
                                <SelectTrigger className="h-11 w-[160px] bg-slate-50 border-slate-100 rounded-xl font-black text-[9px] uppercase tracking-widest text-slate-500">
                                    <SelectValue placeholder="DEPARTMENTS" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-100">
                                    <SelectItem value="all" className="font-bold text-[9px] uppercase italic">All Nodes</SelectItem>
                                    {departments.map(d => (
                                        <SelectItem key={d.id} value={d.id} className="font-bold text-[9px] uppercase italic">{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="h-11 w-[140px] bg-slate-50 border-slate-100 rounded-xl font-black text-[9px] uppercase tracking-widest text-slate-500">
                                    <SelectValue placeholder="STATUS" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-100">
                                    <SelectItem value="all" className="font-bold text-[9px] uppercase italic">All Status</SelectItem>
                                    <SelectItem value="clocked-in" className="font-bold text-[9px] uppercase italic text-red-600">Active</SelectItem>
                                    <SelectItem value="on-break" className="font-bold text-[9px] uppercase italic text-yellow-600">Break</SelectItem>
                                    <SelectItem value="clocked-out" className="font-bold text-[9px] uppercase italic text-slate-400">Offline</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="border-slate-100 hover:bg-transparent">
                                <TableHead className="py-5 px-8 font-black text-slate-400 uppercase text-[9px] tracking-widest">Personnel</TableHead>
                                <TableHead className="py-5 px-8 font-black text-slate-400 uppercase text-[9px] tracking-widest">Department</TableHead>
                                <TableHead className="py-5 px-8 font-black text-slate-400 uppercase text-[9px] tracking-widest text-center">Status</TableHead>
                                <TableHead className="py-5 px-8 font-black text-slate-400 uppercase text-[9px] tracking-widest">Metrics</TableHead>
                                <TableHead className="py-5 px-8 font-black text-slate-400 uppercase text-[9px] tracking-widest text-right">Access</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredEmployees.map((emp) => {
                                const record = attendanceRecords.find(a => a.userId === emp.id)
                                const status = record?.status || "absent"

                                return (
                                    <TableRow key={emp.id} className="border-slate-50 hover:bg-slate-50/30 transition-all duration-200">
                                        <TableCell className="py-5 px-8">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-black italic relative overflow-hidden text-xs">
                                                    {emp.image ? <img src={emp.image} alt="" className="h-full w-full object-cover" /> : (emp.name?.charAt(0) || "U")}
                                                    <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 border-2 border-white rounded-full ${status === 'clocked-in' ? 'bg-red-600' :
                                                        status === 'on-break' ? 'bg-yellow-500' : 'bg-slate-200'
                                                        }`} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-800 uppercase italic text-[11px] leading-tight">{emp.name || "Unknown Identity"}</span>
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{emp.email}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-5 px-8">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase italic">
                                                {emp.department?.name || "Unassigned"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-5 px-8 text-center">
                                            <Badge variant="outline" className={`px-2.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border-none ${status === 'clocked-in' ? 'bg-red-50 text-red-600' :
                                                status === 'on-break' ? 'bg-yellow-50 text-yellow-700' :
                                                    status === 'clocked-out' ? 'bg-slate-100 text-slate-400' :
                                                        'bg-red-50/50 text-red-400'
                                                }`}>
                                                {status.replace('-', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-5 px-8">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-700">
                                                    <Clock className="h-2.5 w-2.5 text-slate-300" />
                                                    <span className="italic">{record?.clockIn ? new Date(record.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}</span>
                                                </div>
                                                <span className="text-[8px] font-bold text-slate-300 uppercase mt-0.5">{record?.clockIn ? calculateHours(record.clockIn, record.clockOut || new Date().toISOString()) : '0h 0m'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-5 px-8 text-right">
                                            {record?.mode ? (
                                                <div className="flex items-center justify-end gap-1.5 text-slate-400 group">
                                                    <MapPin className="h-2.5 w-2.5 transition-colors group-hover:text-red-500" />
                                                    <span className="text-[8px] font-black uppercase tracking-widest leading-none">{record.mode}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[8px] font-bold text-slate-200 uppercase">Offline</span>
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
