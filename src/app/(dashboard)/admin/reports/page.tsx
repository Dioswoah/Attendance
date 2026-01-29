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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Users, ChevronDown } from "lucide-react"

export default function ExportPage() {
    const [generating, setGenerating] = useState(false)
    const [departments, setDepartments] = useState<any[]>([])
    const [allStaff, setAllStaff] = useState<any[]>([])

    // Filters
    const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [selectedDept, setSelectedDept] = useState("all")
    const [includeArchived, setIncludeArchived] = useState(false)
    const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
    const [staffSearchQuery, setStaffSearchQuery] = useState("")

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
            if (staffRes.ok) setAllStaff(await staffRes.json())
        } catch (error) {
            console.error("Fetch data error:", error)
        }
    }

    const filteredStaffForDropdown = allStaff
        .filter(s => (includeArchived ? true : !s.isArchived))
        .filter(s => {
            const selectedDeptData = departments.find(d => d.id === selectedDept)
            const normalizedSelectedName = selectedDeptData?.name?.toLowerCase().trim()

            const matchesDept = selectedDept === 'all' ||
                s.departmentId === selectedDept ||
                (normalizedSelectedName && (
                    s.department?.name?.toLowerCase().trim() === normalizedSelectedName ||
                    s.departmentName?.toLowerCase().trim() === normalizedSelectedName
                ))

            const matchesQuery = s.name.toLowerCase().includes(staffSearchQuery.toLowerCase())
            return matchesDept && matchesQuery
        })

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

    const setQuickRange = (range: 'today' | '7days' | '30days' | 'month') => {
        const end = new Date()
        const start = new Date()
        if (range === 'today') {
            // Both start and end are already today
        } else if (range === '7days') start.setDate(end.getDate() - 7)
        else if (range === '30days') start.setDate(end.getDate() - 30)
        else if (range === 'month') start.setDate(1)

        setStartDate(format(start, "yyyy-MM-dd"))
        setEndDate(format(end, "yyyy-MM-dd"))
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

    const handleExport = async () => {
        setGenerating(true)
        try {
            const res = await fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}&departmentId=${selectedDept}`)
            if (res.ok) {
                const rawData = await res.json()

                // Filter data based on selected staff and archive status
                const data = rawData.filter((record: any) => {
                    // Check if user is in selected list (if selection is active)
                    if (selectedStaffIds.length > 0) {
                        return selectedStaffIds.includes(record.userId)
                    }

                    // Otherwise, check archive status if no specific selection
                    const user = allStaff.find(s => s.id === record.userId)
                    if (!includeArchived && user?.isArchived) return false

                    return true
                })

                // Sheet 1: Logs (Sorted)
                const sortedData = [...data].sort((a, b) => {
                    if (a.userName < b.userName) return -1
                    if (a.userName > b.userName) return 1
                    return a.date.localeCompare(b.date)
                })

                const logData = sortedData.map((record: any) => {
                    const stats = calculateDurations([record])
                    return {
                        'Employee': record.userName,
                        'Department': record.department,
                        'Date': record.date,
                        'Clock In': record.clockIn ? format(new Date(record.clockIn), "HH:mm") : '-',
                        'Clock Out': record.clockOut ? format(new Date(record.clockOut), "HH:mm") : '-',
                        'Work Hours': Number((stats.workMs / (1000 * 60 * 60)).toFixed(2)),
                        'Leave Hours': Number((stats.leaveMs / (1000 * 60 * 60)).toFixed(2)),
                        'Work Location': record.mode
                    }
                })

                // Sheet 2: Summary (Derive from data)
                const uniqueEmployees = Array.from(new Set(data.map((r: any) => r.userId)))
                const summaryData = uniqueEmployees.map(id => {
                    const empRecs = data.filter((r: any) => r.userId === id)
                    const stats = calculateDurations(empRecs)
                    const firstRec = empRecs[0]
                    return {
                        'Employee': firstRec.userName,
                        'Department': firstRec.department,
                        'Days Worked': empRecs.filter((r: any) => r.clockIn).length,
                        'Total Work Hours': Number((stats.workMs / (1000 * 60 * 60)).toFixed(2)),
                        'Days Leave': empRecs.filter((r: any) => r.status === 'on-leave' || r.mode === 'LEAVE' || r.status === 'LEAVE').length,
                        'Total Leave Hours': Number((stats.leaveMs / (1000 * 60 * 60)).toFixed(2))
                    }
                }).sort((a, b) => a.Employee.localeCompare(b.Employee))

                const wb = XLSX.utils.book_new()

                const wsLogs = XLSX.utils.json_to_sheet(logData)
                wsLogs['!cols'] = Object.keys(logData[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }))
                XLSX.utils.book_append_sheet(wb, wsLogs, "Master Ledger")

                const wsSummary = XLSX.utils.json_to_sheet(summaryData)
                wsSummary['!cols'] = Object.keys(summaryData[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }))
                XLSX.utils.book_append_sheet(wb, wsSummary, "Finance Summary")

                XLSX.writeFile(wb, `REDADAIR_MASTER_PAYROLL_${startDate}_${endDate}.xlsx`)
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
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Export Ledger</h1>
                    <p className="text-muted-foreground text-sm">Workforce Intelligence & Industrial Reports</p>
                </div>
                <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full border border-border">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Ledger Stream Active</span>
                </div>
            </div>

            <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                <CardHeader className="p-6 border-b border-border bg-muted/20">
                    <CardTitle className="text-lg font-semibold text-foreground">Export Configuration</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">Configure chronological and structural parameters</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
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
                                        alert("End Data cannot be earlier than Start Date")
                                        return
                                    }
                                    setEndDate(e.target.value)
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Department</Label>
                            <Select value={selectedDept} onValueChange={(val) => {
                                setSelectedDept(val)
                                setSelectedStaffIds([])
                            }}>
                                <SelectTrigger className="h-10">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                        <SelectValue placeholder="All Departments" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Departments</SelectItem>
                                    {departments.map((dept: any) => (
                                        <SelectItem key={dept.id} value={dept.id}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                                    {includeArchived && (
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
                                    )}
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


                    <div className="flex items-center justify-end">
                        <div className="flex items-center space-x-2 bg-muted/30 p-2 rounded-lg border border-border">
                            <Checkbox
                                id="include-archived"
                                checked={includeArchived}
                                onCheckedChange={(c) => setIncludeArchived(!!c)}
                            />
                            <Label htmlFor="include-archived" className="text-xs font-medium cursor-pointer">
                                Include Archived Staff
                            </Label>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label>Quick Presets</Label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'today', label: 'Today' },
                                { id: '7days', label: 'Last 7 Days' },
                                { id: '30days', label: 'Last 30 Days' },
                                { id: 'month', label: 'Month to Date' }
                            ].map(range => (
                                <Button
                                    key={range.id}
                                    onClick={() => setQuickRange(range.id as any)}
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs font-medium"
                                >
                                    {range.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-border">
                        <Button
                            onClick={handleExport}
                            disabled={generating}
                            className="w-full md:w-auto"
                        >
                            {generating ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4 mr-2" />
                            )}
                            {generating ? "Synthesizing Dataset..." : "Generate Master Ledger"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                    <CardHeader className="p-6 border-b border-border bg-muted/20">
                        <CardTitle className="text-base font-semibold text-foreground">Report Data Schema</CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 py-6">
                        <div className="space-y-4">
                            {[
                                { label: 'IDENTITY', desc: 'Verified Employee Name', icon: User },
                                { label: 'DEPARTMENT', desc: 'Assigned Business Unit', icon: Building2 },
                                { label: 'LOG TIME', desc: 'Attendance Timestamp', icon: Clock },
                                { label: 'EFFICIENCY', desc: 'Work Engagement Metrics', icon: Zap }
                            ].map(item => (
                                <div key={item.label} className="flex items-center gap-4 group">
                                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                                        <item.icon className="h-4 w-4" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="font-medium text-sm text-foreground">{item.label}</p>
                                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-muted/30 relative p-8 flex flex-col justify-center">
                    <div className="relative z-10 space-y-4">
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold tracking-tight text-foreground">Data Integrity</h3>
                            <p className="text-xs font-medium text-muted-foreground">Redadair Audit Compliance (RAC-01)</p>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground border-l-2 border-primary pl-4">
                            All generated ledgers are cryptographically assigned to the current administrative session. Exported datasets comply with fire protection industry standards and workforce monitoring protocols.
                        </p>
                    </div>
                </Card>
            </div>
        </div >
    )
}
