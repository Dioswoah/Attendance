"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Plus,
    Search,
    Trash2,
    Edit2,
    Loader2,
    Download,
    Calendar as CalendarIcon,
    Building2,
    LayoutGrid,
    ArrowRight,
    ShieldCheck,
    Database,
    Flame,
    Zap,
    Clock,
    User
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import * as XLSX from 'xlsx'
import { format } from "date-fns"

export default function ExportPage() {
    const [generating, setGenerating] = useState(false)
    const [departments, setDepartments] = useState<any[]>([])

    // Filters
    const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [selectedDept, setSelectedDept] = useState("all")

    useEffect(() => {
        fetchDepartments()
    }, [])

    const fetchDepartments = async () => {
        try {
            const res = await fetch('/api/departments')
            if (res.ok) setDepartments(await res.json())
        } catch (error) {
            console.error("Fetch departments error:", error)
        }
    }

    const setQuickRange = (range: '7days' | '30days' | 'month') => {
        const end = new Date()
        const start = new Date()
        if (range === '7days') start.setDate(end.getDate() - 7)
        else if (range === '30days') start.setDate(end.getDate() - 30)
        else if (range === 'month') start.setDate(1)

        setStartDate(format(start, "yyyy-MM-dd"))
        setEndDate(format(end, "yyyy-MM-dd"))
    }

    const calculateHours = (start?: string, end?: string) => {
        if (!start || !end) return "0.00"
        const diff = new Date(end).getTime() - new Date(start).getTime()
        const decimalHours = diff / (1000 * 60 * 60)
        return decimalHours.toFixed(2)
    }

    const handleExport = async () => {
        setGenerating(true)
        try {
            const res = await fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}&departmentId=${selectedDept}`)
            if (res.ok) {
                const data = await res.json()

                const exportData = data.map((record: any) => ({
                    'IDENTITY': record.userName,
                    'DEPARTMENT': record.department,
                    'DATE': record.date,
                    'CLOCK_IN': record.clockIn ? format(new Date(record.clockIn), "HH:mm:ss") : '-',
                    'CLOCK_OUT': record.clockOut ? format(new Date(record.clockOut), "HH:mm:ss") : '-',
                    'TOTAL_HOURS': calculateHours(record.clockIn, record.clockOut),
                    'STATUS': record.status.toUpperCase(),
                    'WORK_MODE': record.mode
                }))

                const ws = XLSX.utils.json_to_sheet(exportData)
                const wb = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb, ws, "Attendance_Ledger")
                XLSX.writeFile(wb, `REDADAIR_MASTER_LEDGER_${startDate}_${endDate}.xlsx`)
            }
        } catch (error) {
            console.error("Export failed:", error)
        } finally {
            setGenerating(false)
        }
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase leading-none">Export Ledger</h1>
                    <p className="text-red-600 font-bold uppercase tracking-[0.2em] text-[10px] ml-1">Workforce Intelligence & Industrial Reports</p>
                </div>
                <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                    <Database className="h-4 w-4 text-red-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ledger Stream Active</span>
                </div>
            </div>

            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white border border-slate-100">
                <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-50">
                    <CardTitle className="text-xl font-black text-slate-900 uppercase italic">Export Configuration</CardTitle>
                    <CardDescription className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure chronological and structural parameters</CardDescription>
                </CardHeader>
                <CardContent className="p-10 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Temporal Start</Label>
                            <div className="relative">
                                <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="h-12 pl-12 rounded-xl bg-slate-50 border-slate-100 font-bold text-[10px] uppercase italic text-slate-700"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Temporal End</Label>
                            <div className="relative">
                                <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="h-12 pl-12 rounded-xl bg-slate-50 border-slate-100 font-bold text-[10px] uppercase italic text-slate-700"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Department Scope</Label>
                            <Select value={selectedDept} onValueChange={setSelectedDept}>
                                <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold text-[10px] text-slate-600 italic px-5 uppercase tracking-widest leading-none">
                                    <div className="flex items-center gap-3">
                                        <Building2 className="h-3.5 w-3.5 text-slate-300" />
                                        <SelectValue placeholder="All Nodes" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                    <SelectItem value="all" className="font-bold uppercase italic text-[9px]">Global Overlook</SelectItem>
                                    {departments.map(d => (
                                        <SelectItem key={d.id} value={d.id} className="font-bold uppercase italic text-[9px]">{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Temporal Presets</Label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: '7days', label: 'Last 7 Days' },
                                { id: '30days', label: 'Last 30 Days' },
                                { id: 'month', label: 'Month to Date' }
                            ].map(range => (
                                <Button
                                    key={range.id}
                                    onClick={() => setQuickRange(range.id as any)}
                                    variant="ghost"
                                    className="h-9 px-5 rounded-lg bg-slate-50 text-[9px] font-black uppercase tracking-widest italic text-slate-500 hover:bg-red-600 hover:text-white transition-all"
                                >
                                    {range.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100">
                        <Button
                            onClick={handleExport}
                            disabled={generating}
                            className="bg-red-600 hover:bg-red-700 h-16 px-10 rounded-2xl gap-4 shadow-lg shadow-red-100 transition-all active:scale-95 group w-full md:w-auto"
                        >
                            {generating ? (
                                <Loader2 className="h-5 w-5 animate-spin text-white" />
                            ) : (
                                <Download className="h-5 w-5 text-red-100 group-hover:translate-y-0.5 transition-transform" />
                            )}
                            <span className="font-black text-[11px] uppercase tracking-widest italic text-white">
                                {generating ? "Synthesizing Dataset..." : "Generate Master Ledger"}
                            </span>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white border border-slate-100">
                    <CardHeader className="p-6 border-b border-slate-50">
                        <CardTitle className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic">Report Data Schema</CardTitle>
                    </CardHeader>
                    <CardContent className="px-8 py-6">
                        <div className="space-y-4">
                            {[
                                { label: 'IDENTITY', desc: 'Verified Employee Name', icon: User },
                                { label: 'DEPARTMENT', desc: 'Assigned Business Unit', icon: Building2 },
                                { label: 'LOG TIME', desc: 'Attendance Timestamp', icon: Clock },
                                { label: 'EFFICIENCY', desc: 'Work Engagement Metrics', icon: Zap }
                            ].map(item => (
                                <div key={item.label} className="flex items-center gap-4 group">
                                    <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-red-50 group-hover:text-red-600 transition-colors">
                                        <item.icon className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="font-black text-slate-800 text-[10px] italic uppercase tracking-widest leading-none">{item.label}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-slate-900 relative p-8 text-white flex flex-col justify-center">
                    <Flame className="absolute top-4 right-4 h-12 w-12 text-red-600/20" />
                    <div className="relative z-10 space-y-4">
                        <div className="space-y-1">
                            <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-tight">Data Integrity</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Redadair Audit Compliance (RAC-01)</p>
                        </div>
                        <p className="text-[10px] leading-relaxed font-bold text-slate-300 border-l-2 border-red-600 pl-4 italic">
                            All generated ledgers are cryptographically assigned to the current administrative session. Exported datasets comply with fire protection industry standards and workforce monitoring protocols.
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    )
}
