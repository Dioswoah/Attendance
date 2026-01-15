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
                    duration: lvDuration
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
                <div className="h-12 w-12 rounded-xl bg-red-600 flex items-center justify-center animate-pulse shadow-lg">
                    <Flame className="h-6 w-6 text-white fill-white" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Portal...</p>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase leading-none">Manual Entry</h1>
                    <p className="text-red-600 font-bold uppercase tracking-[0.2em] text-[10px] ml-1">Administrative Intelligence & Node Overrides</p>
                </div>
                <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Override Mode Active</span>
                </div>
            </div>

            {/* Category Toggle */}
            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[1.5rem] w-fit">
                {[
                    { id: 'attendance', label: 'Attendance', icon: Clock },
                    { id: 'leave', label: 'Authorized Leave', icon: FileText },
                    { id: 'breaks', label: 'Break Sessions', icon: Coffee }
                ].map(tab => (
                    <Button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id as any); setActiveMode('create'); }}
                        variant="ghost"
                        className={cn(
                            "h-12 px-8 rounded-xl gap-3 transition-all font-black uppercase italic tracking-widest",
                            activeTab === tab.id
                                ? "bg-white text-red-600 shadow-sm"
                                : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-red-600" : "text-slate-300")} />
                        <span className="text-[9px]">{tab.label}</span>
                    </Button>
                ))}
            </div>

            {/* Mode Switcher */}
            <div className="flex gap-4 border-b border-slate-100 pb-2">
                {[
                    { id: 'create', label: 'Create New record' },
                    { id: 'list', label: 'Review Existing Nodes' }
                ].map(mode => (
                    <button
                        key={mode.id}
                        onClick={() => setActiveMode(mode.id as any)}
                        className={cn(
                            "pb-2 px-1 text-[10px] font-black uppercase italic tracking-[0.2em] transition-all relative",
                            activeMode === mode.id ? "text-slate-900" : "text-slate-300 hover:text-slate-500"
                        )}
                    >
                        {mode.label}
                        {activeMode === mode.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-full" />}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            {activeMode === 'create' ? (
                <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white border border-slate-100">
                    <div className="p-8 border-b border-slate-50 bg-slate-50/50">
                        <CardTitle className="text-xl font-black text-slate-900 italic uppercase">
                            Manual {activeTab} Initialization
                        </CardTitle>
                        <CardDescription className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            Securing data injection for departmental audit
                        </CardDescription>
                    </div>
                    <CardContent className="p-10">
                        {activeTab === 'attendance' && (
                            <form onSubmit={handleAttendanceSubmit} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Select Operative</Label>
                                        <Select value={attEmpId} onValueChange={setAttEmpId} required>
                                            <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] text-slate-600 italic">
                                                <SelectValue placeholder="CHOOSE STAFF..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-slate-100">
                                                {employees.map(e => <SelectItem key={e.id} value={e.id} className="font-bold uppercase italic text-[9px] tracking-widest">{e.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Structural Node</Label>
                                        <Select value={attMode} onValueChange={setAttMode}>
                                            <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] text-slate-600 italic">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-slate-100">
                                                <SelectItem value="OFFICE" className="font-bold uppercase italic text-[9px]">🏢 OFFICE TERMINAL</SelectItem>
                                                <SelectItem value="WFH" className="font-bold uppercase italic text-[9px]">🏠 REMOTE NODE</SelectItem>
                                                <SelectItem value="OTHER" className="font-bold uppercase italic text-[9px]">📍 FIELD DEPLOYMENT</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Temporal Date</Label>
                                        <Input type="date" value={attDate} onChange={e => setAttDate(e.target.value)} className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic" required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Ingress Time</Label>
                                            <Input type="time" value={attIn} onChange={e => setAttIn(e.target.value)} className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Egress Time</Label>
                                            <Input type="time" value={attOut} onChange={e => setAttOut(e.target.value)} className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic" />
                                        </div>
                                    </div>
                                </div>
                                <Button type="submit" disabled={processing} className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 italic uppercase tracking-widest gap-3">
                                    {processing ? <Loader2 className="animate-spin h-5 w-5" /> : status === 'success' ? "Sync Complete" : "Authorize Final Entry"}
                                </Button>
                            </form>
                        )}

                        {activeTab === 'leave' && (
                            <form onSubmit={handleLeaveSubmit} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Staff Member</Label>
                                        <Select value={lvEmpId} onValueChange={setLvEmpId} required>
                                            <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] text-slate-600 italic">
                                                <SelectValue placeholder="CHOOSE STAFF..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-slate-100">
                                                {employees.map(e => <SelectItem key={e.id} value={e.id} className="font-bold uppercase italic text-[9px] tracking-widest">{e.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Leave Classification</Label>
                                        <Select value={lvType} onValueChange={setLvType}>
                                            <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] text-slate-600 italic">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-slate-100">
                                                {['Annual Leave', 'Sick Leave', 'Compassionate', 'Unpaid Leave'].map(t => <SelectItem key={t} value={t} className="font-bold italic text-[10px] uppercase">{t}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Temporal Start</Label>
                                        <Input type="date" value={lvStart} onChange={e => setLvStart(e.target.value)} className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Temporal End</Label>
                                        <Input type="date" value={lvEnd} onChange={e => setLvEnd(e.target.value)} className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic" required />
                                    </div>
                                    <div className="space-y-3 md:col-span-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1 text-center block">Duration Parameter</Label>
                                        <div className="flex justify-center gap-3">
                                            {['Full Day', 'Half Day', 'Part Day'].map(d => (
                                                <Button
                                                    key={d}
                                                    type="button"
                                                    onClick={() => setLvDuration(d)}
                                                    variant="ghost"
                                                    className={cn(
                                                        "h-11 px-6 rounded-lg font-black text-[9px] uppercase tracking-widest italic border transition-all",
                                                        lvDuration === d ? "bg-slate-900 text-white border-slate-900 shadow-sm" : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                                                    )}
                                                >
                                                    {d}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Justification Remarks</Label>
                                        <Input placeholder="ENTER AUDIT REMARKS..." value={lvReason} onChange={e => setLvReason(e.target.value)} className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic" />
                                    </div>
                                </div>
                                <Button type="submit" disabled={processing} className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 italic uppercase tracking-widest">
                                    {processing ? <Loader2 className="animate-spin h-5 w-5" /> : status === 'success' ? "Authorization Complete" : "Grant Manual Leave"}
                                </Button>
                            </form>
                        )}

                        {activeTab === 'breaks' && (
                            <form onSubmit={handleBreakSubmit} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Select Operative</Label>
                                        <Select value={brEmpId} onValueChange={setBrEmpId} required>
                                            <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] text-slate-600 italic">
                                                <SelectValue placeholder="CHOOSE STAFF..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-slate-100">
                                                {employees.map(e => <SelectItem key={e.id} value={e.id} className="font-bold uppercase italic text-[9px] tracking-widest">{e.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Observational Date</Label>
                                        <Input type="date" value={brDate} onChange={e => setBrDate(e.target.value)} className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Session Start</Label>
                                        <Input type="time" value={brIn} onChange={e => setBrIn(e.target.value)} className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Session End</Label>
                                        <Input type="time" value={brOut} onChange={e => setBrOut(e.target.value)} className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic" />
                                    </div>
                                </div>
                                <Button type="submit" disabled={processing} className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 italic uppercase tracking-widest">
                                    {processing ? <Loader2 className="animate-spin h-5 w-5" /> : status === 'success' ? "Break Sync Complete" : "Register Manual Break"}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {/* Filters for Lists */}
                    <Card className="border-none shadow-sm rounded-2xl bg-white border border-slate-100 p-8">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="space-y-1.5">
                                <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Node Focus</Label>
                                <Select value={filterDept} onValueChange={setFilterDept}>
                                    <SelectTrigger className="h-10 bg-slate-50 border-slate-100 rounded-lg font-bold text-[9px] uppercase tracking-widest text-slate-600">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-lg border-slate-100">
                                        <SelectItem value="all" className="font-bold uppercase italic text-[9px]">Global Overlook</SelectItem>
                                        {departments.map(d => <SelectItem key={d.id} value={d.id} className="font-bold uppercase italic text-[9px]">{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Temporal From</Label>
                                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 bg-slate-50 border-slate-100 rounded-lg font-bold text-[9px] uppercase tracking-widest italic" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Temporal To</Label>
                                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 bg-slate-50 border-slate-100 rounded-lg font-bold text-[9px] uppercase tracking-widest italic" />
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                                <Input
                                    placeholder="Filter identity..."
                                    value={filterQuery}
                                    onChange={e => setFilterQuery(e.target.value)}
                                    className="pl-9 h-10 bg-slate-50 border-slate-100 rounded-lg font-bold text-[9px] uppercase tracking-widest italic transition-all focus:bg-white"
                                />
                            </div>
                        </div>
                    </Card>

                    <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white border border-slate-100">
                        <div className="p-0 overflow-x-auto min-h-[400px]">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="border-slate-100 hover:bg-transparent">
                                        <TableHead className="py-4 px-8 font-black text-slate-400 uppercase text-[8px] tracking-[0.2em]">Personnel</TableHead>
                                        <TableHead className="py-4 px-8 font-black text-slate-400 uppercase text-[8px] tracking-[0.2em]">Architecture</TableHead>
                                        <TableHead className="py-4 px-8 font-black text-slate-400 uppercase text-[8px] tracking-[0.2em]">Temporal</TableHead>
                                        <TableHead className="py-4 px-8 font-black text-slate-400 uppercase text-[8px] tracking-[0.2em]">{activeTab === 'leave' ? 'Leave Type' : 'Metrics'}</TableHead>
                                        <TableHead className="py-4 px-8 font-black text-slate-400 uppercase text-[8px] tracking-[0.2em] text-right">Admin</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRecords.map(rec => (
                                        <TableRow key={rec.id} className="border-slate-50 hover:bg-slate-50/20 transition-all group">
                                            <TableCell className="py-4 px-8">
                                                <span className="font-black text-slate-800 uppercase italic text-[10px] leading-none">{rec.userName}</span>
                                            </TableCell>
                                            <TableCell className="py-4 px-8 font-bold text-slate-400 uppercase text-[9px]">{rec.department}</TableCell>
                                            <TableCell className="py-4 px-8 font-bold text-slate-500 uppercase italic text-[9px]">
                                                {activeTab === 'leave' ? `${format(parseISO(rec.startDate), "dd MMM")} - ${format(parseISO(rec.endDate), "dd MMM")}` : format(parseISO(rec.clockIn || rec.date || rec.startTime), "dd MMM yyyy")}
                                            </TableCell>
                                            <TableCell className="py-4 px-8">
                                                {activeTab === 'attendance' && (
                                                    <div className="flex gap-2 items-center text-[10px] font-black italic">
                                                        <span className="text-red-500">{rec.clockIn ? format(parseISO(rec.clockIn), "HH:mm") : '---'}</span>
                                                        <ArrowRight className="h-2 w-2 opacity-30" />
                                                        <span className="text-slate-400">{rec.clockOut ? format(parseISO(rec.clockOut), "HH:mm") : '---'}</span>
                                                    </div>
                                                )}
                                                {activeTab === 'leave' && (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-red-600 font-black uppercase text-[9px] italic">{rec.type}</span>
                                                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{rec.duration}</span>
                                                    </div>
                                                )}
                                                {activeTab === 'breaks' && (
                                                    <div className="flex gap-2 items-center text-yellow-600 text-[10px] font-black italic">
                                                        <span>{format(parseISO(rec.startTime), "HH:mm")}</span>
                                                        <ArrowRight className="h-2 w-2 opacity-30" />
                                                        <span>{rec.endTime ? format(parseISO(rec.endTime), "HH:mm") : '---'}</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-4 px-8 text-right">
                                                <Button onClick={() => deleteRecord(rec.id)} variant="ghost" size="icon" className="h-8 w-8 text-slate-200 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredRecords.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-24 text-center">
                                                <div className="flex flex-col items-center gap-2 opacity-20">
                                                    <AlertCircle className="h-8 w-8 text-slate-900" />
                                                    <p className="text-[9px] font-black uppercase tracking-widest italic">No records detected in temporal segment</p>
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
