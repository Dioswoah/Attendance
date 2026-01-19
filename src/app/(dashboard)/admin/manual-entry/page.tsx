"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
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
    ShieldCheck
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { cn } from "@/lib/utils"

type TabType = 'attendance' | 'leave' | 'breaks'
type ModeType = 'create' | 'list'

export default function ManualEntryPage() {
    const [activeTab, setActiveTab] = useState<TabType>('attendance')
    const [activeMode, setActiveMode] = useState<ModeType>('create')

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
    const [lvType, setLvType] = useState("Annual Leave")
    const [lvDuration, setLvDuration] = useState("Full Day")
    const [lvStartTime, setLvStartTime] = useState("09:00")
    const [lvEndTime, setLvEndTime] = useState("13:00")
    const [lvReason, setLvReason] = useState("")

    // Form States - Breaks
    const [brEmpId, setBrEmpId] = useState("")
    const [brDate, setBrDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [brIn, setBrIn] = useState("12:00")
    const [brOut, setBrOut] = useState("13:00")

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
            } else if (activeTab === 'leave') {
                url += `startDate=${startDate}&endDate=${endDate}&departmentId=${filterDept}`
            } else if (activeTab === 'breaks') {
                url += `date=${startDate}&userId=${filterEmp === 'all' ? '' : filterEmp}`
            }

            const res = await fetch(url)
            if (res.ok) setRecords(await res.json())
        } finally {
            setLoading(false)
        }
    }

    const handleAttendanceSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setProcessing(true)
        try {
            const clockIn = new Date(`${attDate}T${attIn}:00`)
            const clockOut = attOut ? new Date(`${attDate}T${attOut}:00`) : null

            const res = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: attEmpId,
                    date: attDate,
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

    const handleLeaveSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
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
        setProcessing(true)
        try {
            const startTime = new Date(`${brDate}T${brIn}:00`)
            const endTime = brOut ? new Date(`${brDate}T${brOut}:00`) : null

            const res = await fetch('/api/breaks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: brEmpId,
                    date: brDate,
                    startTime: startTime.toISOString(),
                    endTime: endTime?.toISOString()
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

    const deleteRecord = async (id: string) => {
        if (!confirm("Are you sure you want to delete this record?")) return
        setProcessing(true)
        try {
            const res = await fetch(`/api/${activeTab}/${id}`, { method: 'DELETE' })
            if (res.ok) fetchRecords()
        } finally { setProcessing(false) }
    }

    const filteredRecords = records.filter(r =>
        r.userName?.toLowerCase().includes(filterQuery.toLowerCase()) ||
        r.department?.toLowerCase().includes(filterQuery.toLowerCase())
    )

    if (loading && records.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Loading Portal...</p>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Manual Entry</h1>
                    <p className="text-muted-foreground text-sm">Administrative Intelligence & Node Overrides</p>
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
                    { id: 'leave', label: 'Authorized Leave', icon: FileText },
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
                    { id: 'list', label: 'Review Existing Nodes' }
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
                    <CardHeader className="border-b border-border p-6 bg-muted/20">
                        <CardTitle className="text-lg font-semibold text-foreground">
                            Manual {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Initialization
                        </CardTitle>
                        <CardDescription className="text-sm text-muted-foreground">
                            Securing data injection for departmental audit
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                        {activeTab === 'attendance' && (
                            <form onSubmit={handleAttendanceSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>Select Operative</Label>
                                        <Select value={attEmpId} onValueChange={setAttEmpId} required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Staff..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Structural Node</Label>
                                        <Select value={attMode} onValueChange={setAttMode}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="OFFICE">Office Terminal</SelectItem>
                                                <SelectItem value="WFH">Remote Node</SelectItem>
                                                <SelectItem value="OTHER">Field Deployment</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Date</Label>
                                        <Input type="date" value={attDate} onChange={e => setAttDate(e.target.value)} required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Ingress Time</Label>
                                            <Input type="time" value={attIn} onChange={e => setAttIn(e.target.value)} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Egress Time</Label>
                                            <Input type="time" value={attOut} onChange={e => setAttOut(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                                <Button type="submit" disabled={processing} className="w-full">
                                    {processing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                                    {status === 'success' ? "Sync Complete" : "Authorize Final Entry"}
                                </Button>
                            </form>
                        )}

                        {activeTab === 'leave' && (
                            <form onSubmit={handleLeaveSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>Staff Member</Label>
                                        <Select value={lvEmpId} onValueChange={setLvEmpId} required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Staff..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Leave Classification</Label>
                                        <Select value={lvType} onValueChange={setLvType}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {['Annual Leave', 'Sick Leave', 'Compassionate', 'Unpaid Leave'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Start Date</Label>
                                        <Input type="date" value={lvStart} onChange={e => setLvStart(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>End Date</Label>
                                        <Input type="date" value={lvEnd} onChange={e => setLvEnd(e.target.value)} required />
                                    </div>
                                    <div className="space-y-3 md:col-span-2">
                                        <Label className="block text-center mb-2">Duration Parameter</Label>
                                        <div className="flex justify-center gap-2">
                                            {['Full Day', 'Half Day', 'Part Day'].map(d => (
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
                                        <Label>Justification Remarks</Label>
                                        <Input placeholder="Enter audit remarks..." value={lvReason} onChange={e => setLvReason(e.target.value)} />
                                    </div>
                                </div>
                                <Button type="submit" disabled={processing} className="w-full">
                                    {processing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                                    {status === 'success' ? "Authorization Complete" : "Grant Manual Leave"}
                                </Button>
                            </form>
                        )}

                        {activeTab === 'breaks' && (
                            <form onSubmit={handleBreakSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>Select Operative</Label>
                                        <Select value={brEmpId} onValueChange={setBrEmpId} required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Staff..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
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
                                        <Input type="time" value={brOut} onChange={e => setBrOut(e.target.value)} />
                                    </div>
                                </div>
                                <Button type="submit" disabled={processing} className="w-full">
                                    {processing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                                    {status === 'success' ? "Break Sync Complete" : "Register Manual Break"}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {/* Filters for Lists */}
                    <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white p-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="space-y-2">
                                <Label>Node Focus</Label>
                                <Select value={filterDept} onValueChange={setFilterDept}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Global Overlook</SelectItem>
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
                                        <TableHead className="py-4 px-6 font-medium text-muted-foreground">Personnel</TableHead>
                                        <TableHead className="py-4 px-6 font-medium text-muted-foreground">Architecture</TableHead>
                                        <TableHead className="py-4 px-6 font-medium text-muted-foreground">Temporal</TableHead>
                                        <TableHead className="py-4 px-6 font-medium text-muted-foreground">{activeTab === 'leave' ? 'Leave Type' : 'Metrics'}</TableHead>
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
                                            <TableCell className="py-4 px-6 text-sm text-muted-foreground">
                                                {activeTab === 'leave' ? `${format(parseISO(rec.startDate), "dd MMM")} - ${format(parseISO(rec.endDate), "dd MMM")}` : format(parseISO(rec.clockIn || rec.date || rec.startTime), "dd MMM yyyy")}
                                            </TableCell>
                                            <TableCell className="py-4 px-6">
                                                {activeTab === 'attendance' && (
                                                    <div className="flex gap-2 items-center text-sm font-medium">
                                                        <span className="text-primary">{rec.clockIn ? format(parseISO(rec.clockIn), "HH:mm") : '---'}</span>
                                                        <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                                                        <span className="text-muted-foreground">{rec.clockOut ? format(parseISO(rec.clockOut), "HH:mm") : '---'}</span>
                                                    </div>
                                                )}
                                                {activeTab === 'leave' && (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-medium text-sm text-foreground">{rec.type}</span>
                                                        <span className="text-xs text-muted-foreground">{rec.duration}</span>
                                                    </div>
                                                )}
                                                {activeTab === 'breaks' && (
                                                    <div className="flex gap-2 items-center text-sm font-medium text-yellow-600">
                                                        <span>{format(parseISO(rec.startTime), "HH:mm")}</span>
                                                        <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                                                        <span>{rec.endTime ? format(parseISO(rec.endTime), "HH:mm") : '---'}</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-4 px-6 text-right">
                                                <Button onClick={() => deleteRecord(rec.id)} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredRecords.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-12 text-center">
                                                <div className="flex flex-col items-center gap-2 text-muted-foreground opacity-50">
                                                    <AlertCircle className="h-8 w-8" />
                                                    <p className="text-sm font-medium">No records detected in temporal segment</p>
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
        </div>
    )
}
