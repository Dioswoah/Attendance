"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import useSWR, { mutate } from "swr"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Clock, FileText, Loader2, Calendar, UserMinus, Pencil, Trash2, Archive, ArchiveRestore, Coffee, Edit3 } from "lucide-react"
import { format, subDays, isSameDay, parseISO, eachDayOfInterval, startOfDay, endOfDay } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { getBrowserTimezone } from "@/lib/timezone"

type RequestStatus = "PENDING" | "APPROVED" | "DECLINED"

interface AttendanceRequest {
    id: string
    date: string
    type: string
    time: string
    reason: string
    status: RequestStatus
    createdAt: string
    declineReason?: string
    isArchived?: boolean
    targetId?: string
}

export default function AmendRecordsPage() {
    const { data: session } = useSession()
    const [requests, setRequests] = useState<AttendanceRequest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [showArchived, setShowArchived] = useState(false)
    const [userTimeZone, setUserTimeZone] = useState("Asia/Manila")
    const [selectedEntryId, setSelectedEntryId] = useState<string | "new" | null>(null)

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch('/api/user/me')
                if (res.ok) {
                    const data = await res.json()
                    // 1. Priority: Force current browser timezone if flagged
                    if (data.useCurrentTimezone) {
                        setUserTimeZone(getBrowserTimezone())
                    }
                    // 2. Priority: Explictly selected timezone
                    else if (data.selectedTimezone) {
                        setUserTimeZone(data.selectedTimezone)
                    }
                    // 3. Fallback: Region-based defaults
                    else if (data.employmentLocation === 'Philippines') {
                        setUserTimeZone('Asia/Manila')
                    }
                    else if (data.employmentLocation === 'Australia') {
                        setUserTimeZone('Australia/Sydney')
                    }
                    // 4. Last Resort: Browser timezone
                    else {
                        setUserTimeZone(getBrowserTimezone())
                    }
                }
            } catch { }
        }
        fetchProfile()
    }, [])

    const [dateFilter, setDateFilter] = useState({
        start: format(subDays(new Date(), 2), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    })
    const [viewFilter, setViewFilter] = useState("all") // 'all', 'today', 'yesterday', 'before'

    const [actualRecords, setActualRecords] = useState<any[]>([])
    const [isLoadingRecords, setIsLoadingRecords] = useState(true)

    const filteredRequests = requests.filter(r => {
        const matchesArchive = showArchived ? r.isArchived : !r.isArchived
        if (!matchesArchive) return false

        // Show PENDING requests regardless of date filter, so they don't "disappear" from the log
        if (r.status === 'PENDING') return true

        // Date Range Filter
        const reqDate = new Date(r.date).setHours(0, 0, 0, 0)
        const start = new Date(dateFilter.start).setHours(0, 0, 0, 0)
        const end = new Date(dateFilter.end).setHours(23, 59, 59, 999)

        if (reqDate < start || reqDate > end) return false

        // Removed logic that hides cascaded requests if Root Clock In is pending
        // This allows users to see all their pending requests even if the clock-in is not approved yet.

        return true
    })

    // Form State
    const [selectedDateOption, setSelectedDateOption] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [recordType, setRecordType] = useState("CLOCK_IN")
    const [time, setTime] = useState("")
    const [reason, setReason] = useState("")

    // Reference Data
    const [attendanceHistory, setAttendanceHistory] = useState<any[]>([])
    const [referenceTime, setReferenceTime] = useState<string | null>(null)


    // --- SWR Hooks ---
    const fetcher = (url: string) => fetch(url).then(res => res.json())
    const uid = session?.user?.id

    // 1. Attendance Requests
    const { data: requestsData, mutate: mutateRequests } = useSWR(uid ? `/api/attendance-requests?userId=${uid}` : null, fetcher)

    // 2. Actual Records (Table)
    const { data: actualRecordsData, mutate: mutateActualRecords, isLoading: isActualLoading } = useSWR(
        uid ? `/api/attendance?userId=${uid}&startDate=${dateFilter.start}&endDate=${dateFilter.end}` : null,
        fetcher
    )

    // 3. Attendance History (Last 3 days for Reference)
    const historyEnd = new Date().toISOString()
    const historyStart = subDays(new Date(), 3).toISOString()
    const { data: historyData, mutate: mutateHistory } = useSWR(
        uid ? `/api/attendance?userId=${uid}&startDate=${historyStart}&endDate=${historyEnd}` : null,
        fetcher
    )

    // Sync SWR Data to State
    useEffect(() => {
        if (requestsData) {
            setRequests(requestsData)
            setIsLoading(false)
        }
    }, [requestsData])

    useEffect(() => {
        if (actualRecordsData) {
            setActualRecords(actualRecordsData)
            setIsLoadingRecords(false)
        }
    }, [actualRecordsData])

    useEffect(() => {
        if (historyData) setAttendanceHistory(historyData)
    }, [historyData])

    // Legacy functions replaced by SWR, keeping empty to avoid breaking refs if any
    const fetchRequests = () => mutateRequests()
    const fetchActualRecords = () => mutateActualRecords()
    const fetchAttendanceHistory = () => mutateHistory()

    useEffect(() => {
        updateReferenceTime()
    }, [selectedDateOption, recordType, attendanceHistory])

    const updateReferenceTime = () => {
        if (!attendanceHistory.length) return

        // Find record for selected date
        // Find all records for selected date
        // Try actualRecords first (matches table view), fallback to history
        let dayRecords = actualRecords.filter(a => a.date === selectedDateOption)
        if (dayRecords.length === 0) {
            dayRecords = attendanceHistory.filter(a => a.date === selectedDateOption)
        }

        if (dayRecords.length === 0) {
            setReferenceTime("No record found for this date")
            return
        }

        let timeStr = ""

        switch (recordType) {
            case "CLOCK_IN":
                const ins = dayRecords.map(r => r.clockIn).filter(Boolean)
                timeStr = ins.length > 0 ? ins.map(t => new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: userTimeZone })).join(', ') : "Not recorded"
                break
            case "CLOCK_OUT":
                const outs = dayRecords.map(r => r.clockOut).filter(Boolean)
                timeStr = outs.length > 0 ? outs.map(t => new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: userTimeZone })).join(', ') : "Not recorded"
                break
            case "BREAK_START":
                const allBreakStarts: string[] = []
                dayRecords.forEach(r => {
                    if (r.breaks && r.breaks.length > 0) {
                        r.breaks.forEach((b: any) => allBreakStarts.push(new Date(b.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: userTimeZone })))
                    } else if (r.breakStart) {
                        allBreakStarts.push(new Date(r.breakStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: userTimeZone }))
                    }
                })
                timeStr = allBreakStarts.length > 0 ? allBreakStarts.join(', ') : "Not recorded"
                break
            case "BREAK_END":
                const allBreakEnds: string[] = []
                dayRecords.forEach(r => {
                    if (r.breaks && r.breaks.length > 0) {
                        r.breaks.forEach((b: any) => allBreakEnds.push(b.endTime ? new Date(b.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: userTimeZone }) : 'Active'))
                    } else if (r.breakEnd) {
                        allBreakEnds.push(new Date(r.breakEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: userTimeZone }))
                    }
                })
                timeStr = allBreakEnds.length > 0 ? allBreakEnds.join(', ') : "Not recorded"
                break
        }

        setReferenceTime(`Current: ${timeStr}`)
    }

    // fetchRequests replaced by SWR logic above

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!session?.user?.id) return

        setIsSubmitting(true)
        try {
            // Use selected date string directly (YYYY-MM-DD)
            const dateStr = selectedDateOption

            // Calculate offset for the user's timezone
            const offset = (() => {
                try {
                    const part = new Intl.DateTimeFormat('en-US', { timeZone: userTimeZone, timeZoneName: 'longOffset' }).formatToParts().find(p => p.type === 'timeZoneName')
                    return part?.value.replace('GMT', '') || '+00:00'
                } catch { return '+00:00' }
            })()

            // Construct DateTime for the "time"
            // We need to combine targetDate (YYYY-MM-DD) with time (HH:MM)
            const dateTimeStr = `${dateStr}T${time}:00${offset}`
            const requestDate = new Date(dateTimeStr)

            if (requestDate > new Date()) {
                toast.error("Cannot set attendance time in the future", {
                    description: "Please select a time that has already passed."
                })
                setIsSubmitting(false)
                return
            }

            const payload = {
                userId: session.user.id,
                // For the logical 'date' field, we always want UTC Midnight of the selected day,
                // regardless of user timezone, so it matches the canonical session date.
                date: new Date(`${dateStr}T00:00:00Z`).toISOString(),
                type: recordType,
                time: new Date(dateTimeStr).toISOString(),
                reason,
                targetId: selectedEntryId === 'new' ? undefined : selectedEntryId
            }

            const url = editingId ? `/api/attendance-requests/${editingId}` : '/api/attendance-requests'
            const method = editingId ? 'PATCH' : 'POST'

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                setDialogOpen(false)
                resetForm()
                fetchRequests()
                toast.success(editingId ? "Request updated successfully" : "Request submitted successfully")
            } else {
                toast.error("Failed to submit request")
            }
        } catch (error) {
            console.error(error)
            toast.error("Error submitting request")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleArchive = async (id: string) => {
        try {
            const res = await fetch(`/api/attendance-requests/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isArchived: true })
            })
            if (res.ok) {
                setRequests(prev => prev.map(r => r.id === id ? { ...r, isArchived: true } : r))
            }
        } catch (e) {
            console.error(e)
        }
    }

    const handleUnarchive = async (id: string) => {
        try {
            const res = await fetch(`/api/attendance-requests/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isArchived: false })
            })
            if (res.ok) {
                setRequests(prev => prev.map(r => r.id === id ? { ...r, isArchived: false } : r))
            }
        } catch (e) {
            console.error(e)
        }
    }

    const handleEdit = (req: AttendanceRequest) => {
        // If the request is already finalized (Approved/Declined), 
        // editing it should create a NEW request (preserve history), 
        // effectively treating it as a new submission with pre-filled data.
        if (req.status === 'APPROVED' || req.status === 'DECLINED') {
            setEditingId(null)
            setSelectedEntryId('new') // Treat as new if finalized
        } else {
            setEditingId(req.id)
            setSelectedEntryId(req.targetId || 'new')
        }

        setSelectedDateOption(format(new Date(req.date), 'yyyy-MM-dd'))
        setRecordType(req.type)
        try {
            setTime(new Intl.DateTimeFormat('en-GB', { timeZone: userTimeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(req.time)))
        } catch {
            setTime(format(new Date(req.time), 'HH:mm'))
        }
        setReason(req.reason)
        setDialogOpen(true)
    }

    const handleDelete = (id: string) => {
        toast("Cancel this request?", {
            description: "This action cannot be undone.",
            action: {
                label: "Confirm",
                onClick: async () => {
                    const deleteToast = toast.loading("Cancelling request...")
                    try {
                        const res = await fetch(`/api/attendance-requests/${id}`, { method: 'DELETE' })
                        if (res.ok) {
                            fetchRequests()
                            toast.success("Request cancelled", { id: deleteToast })
                        } else {
                            toast.error("Failed to cancel request", { id: deleteToast })
                        }
                    } catch (e) {
                        toast.error("Error cancelling request", { id: deleteToast })
                    }
                }
            },
            cancel: {
                label: "Cancel",
                onClick: () => { }
            },
        })
    }

    const resetForm = () => {
        setEditingId(null)
        setSelectedEntryId(null)
        setSelectedDateOption(format(new Date(), 'yyyy-MM-dd'))
        setRecordType("CLOCK_IN")
        setTime("")
        setReason("")
    }

    const getStatusBadge = (status: RequestStatus) => {
        switch (status) {
            case "APPROVED":
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Approved</Badge>
            case "DECLINED":
                return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">Declined</Badge>
            default:
                return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200">Pending</Badge>
        }
    }

    // Helper to group requests by date
    const groupedRequests = filteredRequests.reduce((groups, req) => {
        const dateStr = format(new Date(req.date), 'yyyy-MM-dd')
        if (!groups[dateStr]) {
            groups[dateStr] = []
        }
        groups[dateStr].push(req)
        return groups
    }, {} as Record<string, AttendanceRequest[]>)

    // Sort dates descending
    const sortedDates = Object.keys(groupedRequests).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

    return (
        <div className="space-y-8 w-full">
            <div className="flex items-center justify-between">
                <div id="tour-amend-header">
                    <h1 className="text-2xl font-bold tracking-tight">Amend Records</h1>
                    <p className="text-muted-foreground mt-1">Request corrections for your attendance logs.</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={(open) => {
                    setDialogOpen(open)
                    if (!open) resetForm()
                }}>
                    <DialogContent className="max-h-[85vh] overflow-y-auto w-11/12 max-w-md sm:w-full">
                        <DialogHeader>
                            <DialogTitle>{editingId ? "Edit Correction Request" : "Request Correction"}</DialogTitle>
                            <DialogDescription>
                                {editingId ? "Update your correction details." : "Submit a change for Clock In/Out or Break times."}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                            <div className="bg-muted/40 p-3 rounded-lg border border-border/50 mb-6 space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground uppercase font-bold tracking-wider">Date</span>
                                    <span className="font-semibold">{format(parseISO(selectedDateOption), 'MMMM dd, yyyy')}</span>
                                </div>
                                <div className="space-y-1.5 pt-3 border-t border-border/20">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">What are you correcting?</Label>
                                    <Select value={recordType} onValueChange={(val) => {
                                        setRecordType(val)
                                        setSelectedEntryId(null) // Reset selection when type changes
                                    }}>
                                        <SelectTrigger className="h-10 bg-white border-border/50">
                                            <SelectValue placeholder="Select record type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CLOCK_IN">Clock In</SelectItem>
                                            <SelectItem value="CLOCK_OUT">Clock Out</SelectItem>
                                            <SelectItem value="BREAK_START">Break Start</SelectItem>
                                            <SelectItem value="BREAK_END">Break End</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-3 pb-2">
                                <Label className="text-xs font-bold text-foreground">Select Entry to Amend</Label>
                                <div className="grid grid-cols-1 gap-2">
                                    {(() => {
                                        // Try actualRecords first, fallback to history
                                        let dayRecords = actualRecords.filter(a => a.date === selectedDateOption)
                                        if (dayRecords.length === 0) {
                                            dayRecords = attendanceHistory.filter(a => a.date === selectedDateOption)
                                        }

                                        let entries: any[] = []

                                        if (recordType === 'CLOCK_IN') {
                                            entries = dayRecords.map(r => ({ id: r.id, time: r.clockIn, label: 'Clock In' })).filter(e => e.time)
                                        } else if (recordType === 'CLOCK_OUT') {
                                            // Include records even if they don't have a clock out time yet (so we can add one)
                                            entries = dayRecords.map(r => ({ id: r.id, time: r.clockOut, label: 'Clock Out' }))
                                        } else if (recordType === 'BREAK_START' || recordType === 'BREAK_END') {
                                            dayRecords.forEach(r => {
                                                if (r.breaks) {
                                                    r.breaks.forEach((b: any) => {
                                                        const bTime = recordType === 'BREAK_START' ? b.startTime : b.endTime
                                                        // For Break End, include even if missing (so we can add one)
                                                        if (bTime || recordType === 'BREAK_END') {
                                                            entries.push({ id: b.id, time: bTime, label: recordType === 'BREAK_START' ? 'Break Start' : 'Break End' })
                                                        }
                                                    })
                                                }
                                            })
                                        }

                                        return (
                                            <>
                                                {entries.map((e) => (
                                                    <div
                                                        key={e.id}
                                                        onClick={() => {
                                                            setSelectedEntryId(e.id)
                                                            if (e.time) {
                                                                try {
                                                                    setTime(new Intl.DateTimeFormat('en-GB', { timeZone: userTimeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(e.time)))
                                                                } catch {
                                                                    setTime(format(new Date(e.time), 'HH:mm'))
                                                                }
                                                            } else {
                                                                setTime("")
                                                            }
                                                        }}
                                                        className={cn(
                                                            "flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer group",
                                                            selectedEntryId === e.id
                                                                ? "border-red-600 bg-red-50/50 ring-1 ring-red-600"
                                                                : "border-border/40 bg-white hover:border-red-200 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
                                                                selectedEntryId === e.id ? "bg-red-600 text-white" : "bg-muted text-muted-foreground group-hover:bg-red-100 group-hover:text-red-600"
                                                            )}>
                                                                <Clock className="w-4 h-4" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold capitalize">{e.label}</span>
                                                                <span className="text-xs font-mono text-muted-foreground">
                                                                    {e.time ? `Recorded at ${format(new Date(e.time), 'hh:mm a')}` : 'Not recorded yet'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {selectedEntryId === e.id && (
                                                            <Badge className="bg-red-600 text-white border-none shadow-sm">Selected</Badge>
                                                        )}
                                                    </div>
                                                ))}
                                                <div
                                                    onClick={() => {
                                                        setSelectedEntryId('new')
                                                        setTime("")
                                                    }}
                                                    className={cn(
                                                        "flex items-center justify-between p-3 rounded-xl border-2 border-dashed transition-all cursor-pointer group",
                                                        selectedEntryId === 'new'
                                                            ? "border-red-600 bg-red-50/50 border-solid ring-1 ring-red-600"
                                                            : "border-border/60 bg-white hover:border-red-400 hover:bg-red-50/20"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
                                                            selectedEntryId === 'new' ? "bg-red-600 text-white" : "bg-muted text-muted-foreground group-hover:bg-red-200 group-hover:text-red-700"
                                                        )}>
                                                            <Plus className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold">Add Missing Entry</span>
                                                            <span className="text-xs text-muted-foreground">Request a new record for this date</span>
                                                        </div>
                                                    </div>
                                                    {selectedEntryId === 'new' && (
                                                        <Badge className="bg-red-600 text-white border-none shadow-sm">New</Badge>
                                                    )}
                                                </div>
                                            </>
                                        )
                                    })()}
                                </div>
                            </div>

                            <div className="space-y-2 pt-2">
                                <Label className="text-xs font-bold">Corrected Time</Label>
                                <div className="relative">
                                    <Input
                                        type="time"
                                        value={time}
                                        onChange={e => setTime(e.target.value)}
                                        className="h-11 pl-4 bg-white border-border/50 text-base"
                                        required
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground italic px-1">
                                    Enter the time that should have been recorded.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Reason</Label>
                                <Textarea
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    placeholder="Forgot to clock out..."
                                    required
                                />
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white min-w-[120px]">
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {editingId ? "Update Request" : "Submit Request"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-red-600" />
                        <h2 className="text-lg font-bold">Attendance Records</h2>
                    </div>

                    <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border/50">
                        <Button
                            variant={viewFilter === "all" ? "default" : "ghost"}
                            size="sm"
                            className={cn("h-7 text-[10px] font-bold uppercase tracking-wider px-3", viewFilter === "all" ? "bg-red-600 hover:bg-red-700" : "")}
                            onClick={() => setViewFilter("all")}
                        >
                            Last 3 Days
                        </Button>
                        <Button
                            variant={viewFilter === "today" ? "default" : "ghost"}
                            size="sm"
                            className={cn("h-7 text-[10px] font-bold uppercase tracking-wider px-3", viewFilter === "today" ? "bg-red-600 hover:bg-red-700" : "")}
                            onClick={() => setViewFilter("today")}
                        >
                            Today
                        </Button>
                        <Button
                            variant={viewFilter === "yesterday" ? "default" : "ghost"}
                            size="sm"
                            className={cn("h-7 text-[10px] font-bold uppercase tracking-wider px-3", viewFilter === "yesterday" ? "bg-red-600 hover:bg-red-700" : "")}
                            onClick={() => setViewFilter("yesterday")}
                        >
                            Yesterday
                        </Button>
                        <Button
                            variant={viewFilter === "before" ? "default" : "ghost"}
                            size="sm"
                            className={cn("h-7 text-[10px] font-bold uppercase tracking-wider px-3", viewFilter === "before" ? "bg-red-600 hover:bg-red-700" : "")}
                            onClick={() => setViewFilter("before")}
                        >
                            Day Before
                        </Button>
                    </div>
                </div>
                <div className="rounded-md border border-border bg-white overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                                <TableHead className="w-[150px] font-bold text-foreground">Date</TableHead>
                                <TableHead className="w-[120px] font-bold text-foreground">Mode</TableHead>
                                <TableHead className="font-bold text-foreground text-center">Clock In</TableHead>
                                <TableHead className="font-bold text-foreground text-center">Clock Out</TableHead>
                                <TableHead className="font-bold text-foreground text-center">Breaks</TableHead>
                                <TableHead className="w-[150px] font-bold text-foreground text-right border-l border-border/50">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingRecords ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                                        <TableCell className="text-center"><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                                        <TableCell className="text-center"><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                                        <TableCell className="text-center"><Skeleton className="h-10 w-24 mx-auto" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : (() => {
                                const allDays = eachDayOfInterval({
                                    start: startOfDay(parseISO(dateFilter.start)),
                                    end: endOfDay(parseISO(dateFilter.end))
                                }).reverse()

                                const filteredDays = allDays.filter(day => {
                                    if (viewFilter === "all") return true
                                    if (viewFilter === "today") return isSameDay(day, new Date())
                                    if (viewFilter === "yesterday") return isSameDay(day, subDays(new Date(), 1))
                                    if (viewFilter === "before") return isSameDay(day, subDays(new Date(), 2))
                                    return true
                                })

                                return filteredDays.map((day) => {
                                    const dateStr = format(day, 'yyyy-MM-dd')
                                    const dayRecords = actualRecords.filter(r => r.date === dateStr && r.mode !== 'LEAVE')
                                    const hasAnyRecord = dayRecords.length > 0

                                    return (
                                        <TableRow key={dateStr} className="hover:bg-muted/50 transition-colors">
                                            <TableCell className="font-medium align-middle">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold">{format(day, 'MMM dd, yyyy')}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                                                        {isSameDay(day, new Date()) ? "Today" :
                                                            isSameDay(day, subDays(new Date(), 1)) ? "Yesterday" :
                                                                format(day, 'EEEE')}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-middle">
                                                <div className="flex flex-col gap-1 items-start">
                                                    {dayRecords.map((r, ri) => (
                                                        <Badge key={r.id || ri} variant="outline" className="font-bold text-[10px] uppercase tracking-wide">
                                                            {r.mode}
                                                        </Badge>
                                                    ))}
                                                    {!hasAnyRecord && (
                                                        <span className="text-[10px] text-muted-foreground italic">No Log</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center align-middle font-mono text-sm">
                                                <div className="flex flex-col gap-1.5 items-center justify-center">
                                                    {dayRecords.map((record, ri) => (
                                                        <div key={record.id || ri} className="flex items-center justify-center gap-1.5 group/in">
                                                            <span>{record?.clockIn ? format(parseISO(record.clockIn), 'hh:mm a') : '---'}</span>
                                                            {record?.clockIn && (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedDateOption(dateStr);
                                                                        setRecordType("CLOCK_IN");
                                                                        setSelectedEntryId(record.id);
                                                                        try {
                                                                            setTime(new Intl.DateTimeFormat('en-GB', { timeZone: userTimeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(record.clockIn)));
                                                                        } catch {
                                                                            setTime(format(parseISO(record.clockIn), 'HH:mm'));
                                                                        }
                                                                        setDialogOpen(true);
                                                                    }}
                                                                    className="text-muted-foreground hover:text-red-600 transition-colors opacity-0 group-hover/in:opacity-100"
                                                                >
                                                                    <Edit3 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {!hasAnyRecord && '---'}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center align-middle font-mono text-sm text-muted-foreground">
                                                <div className="flex flex-col gap-1.5 items-center justify-center">
                                                    {dayRecords.map((record, ri) => (
                                                        <div key={record.id || ri} className="flex items-center justify-center gap-1.5 group/out">
                                                            <span>{record?.clockOut ? format(parseISO(record.clockOut), 'hh:mm a') : '---'}</span>
                                                            {record?.clockOut && (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedDateOption(dateStr);
                                                                        setRecordType("CLOCK_OUT");
                                                                        setSelectedEntryId(record.id);
                                                                        try {
                                                                            setTime(new Intl.DateTimeFormat('en-GB', { timeZone: userTimeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(record.clockOut)));
                                                                        } catch {
                                                                            setTime(format(parseISO(record.clockOut), 'HH:mm'));
                                                                        }
                                                                        setDialogOpen(true);
                                                                    }}
                                                                    className="text-muted-foreground hover:text-red-600 transition-colors opacity-0 group-hover/out:opacity-100"
                                                                >
                                                                    <Edit3 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {!hasAnyRecord && '---'}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center align-middle">
                                                <div className="flex flex-col gap-2 items-center">
                                                    {dayRecords.map((record, ri) => (
                                                        record?.breaks && record.breaks.length > 0 ? (
                                                            <div key={record.id || ri} className="flex flex-col gap-1 items-center font-mono">
                                                                {record.breaks.map((b: any, bi: number) => (
                                                                    <div key={b.id || bi} className="text-[10px] bg-yellow-50 text-yellow-700 px-2 py-1 rounded border border-yellow-100 flex flex-col gap-0.5 items-start">
                                                                        <div className="flex items-center gap-2 group/bstart w-full justify-between">
                                                                            <div className="flex items-center gap-1">
                                                                                <span className="font-bold opacity-60">S:</span>
                                                                                <span>{format(parseISO(b.startTime), 'hh:mm a')}</span>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => {
                                                                                    setSelectedDateOption(dateStr);
                                                                                    setRecordType("BREAK_START");
                                                                                    setSelectedEntryId(b.id);
                                                                                    try {
                                                                                        setTime(new Intl.DateTimeFormat('en-GB', { timeZone: userTimeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(b.startTime)));
                                                                                    } catch {
                                                                                        setTime(format(parseISO(b.startTime), 'HH:mm'));
                                                                                    }
                                                                                    setDialogOpen(true);
                                                                                }}
                                                                                className="opacity-0 group-hover/bstart:opacity-100 hover:text-red-600 ml-1"
                                                                            >
                                                                                <Edit3 className="w-2.5 h-2.5" />
                                                                            </button>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 group/bend w-full justify-between">
                                                                            <div className="flex items-center gap-1">
                                                                                <span className="font-bold opacity-60">E:</span>
                                                                                <span>{b.endTime ? format(parseISO(b.endTime), 'hh:mm a') : '--:--'}</span>
                                                                            </div>
                                                                            {b.endTime && (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setSelectedDateOption(dateStr);
                                                                                        setRecordType("BREAK_END");
                                                                                        setSelectedEntryId(b.id);
                                                                                        try {
                                                                                            setTime(new Intl.DateTimeFormat('en-GB', { timeZone: userTimeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(b.endTime)));
                                                                                        } catch {
                                                                                            setTime(format(parseISO(b.endTime), 'HH:mm'));
                                                                                        }
                                                                                        setDialogOpen(true);
                                                                                    }}
                                                                                    className="opacity-0 group-hover/bend:opacity-100 hover:text-red-600 ml-1"
                                                                                >
                                                                                    <Edit3 className="w-2.5 h-2.5" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            ri === 0 && dayRecords.every(dr => !dr.breaks || dr.breaks.length === 0) ? <span key="none" className="text-xs text-muted-foreground italic">None</span> : null
                                                        )
                                                    ))}
                                                    {!hasAnyRecord && <span className="text-xs text-muted-foreground italic">None</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right align-middle border-l border-border/50 bg-muted/5">
                                                <Button
                                                    id={isSameDay(day, new Date()) ? "tour-amend-new-btn" : undefined}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 font-bold text-[10px] uppercase tracking-widest h-7 px-2"
                                                    onClick={() => {
                                                        setSelectedDateOption(dateStr)
                                                        const latestRecord = dayRecords[dayRecords.length - 1]
                                                        // Identify default action based on record status
                                                        if (!hasAnyRecord) {
                                                            setRecordType("CLOCK_IN")
                                                            setReferenceTime("No log found for this date. You can request a Clock In.")
                                                        } else if (latestRecord && !latestRecord.clockOut) {
                                                            // If clocked in but not out, user might want to correct Clock In OR add Clock Out
                                                            setRecordType("CLOCK_OUT")
                                                            setReferenceTime(`Clocked in at ${format(parseISO(latestRecord.clockIn), 'hh:mm a')}. You can request a Clock Out time or switch to correct Clock In.`)
                                                        } else {
                                                            setRecordType("CLOCK_IN")
                                                            setReferenceTime("Multiple records or completed shift found. Use the dropdown to select which to amend, or use specific icons in the table.")
                                                        }

                                                        setDialogOpen(true)
                                                    }}
                                                >
                                                    Amend
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            })()}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-12 mb-4 gap-4 pt-8 border-t border-dashed border-border">
                <div id="tour-amend-log" className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-red-600" />
                    <h2 className="text-lg font-bold">Request Log</h2>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-2 bg-white p-1 border border-border rounded-lg shadow-sm">
                        <div className="flex items-center gap-2 px-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">From</span>
                            <Input
                                type="date"
                                value={dateFilter.start}
                                onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                                className="h-8 w-auto min-w-[130px] border-none bg-transparent focus-visible:ring-0 text-xs font-medium"
                            />
                        </div>
                        <div className="w-px h-6 bg-border" />
                        <div className="flex items-center gap-2 px-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">To</span>
                            <Input
                                type="date"
                                value={dateFilter.end}
                                onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                                className="h-8 w-auto min-w-[130px] border-none bg-transparent focus-visible:ring-0 text-xs font-medium"
                            />
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowArchived(!showArchived)}
                        className={cn(
                            "text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap",
                            showArchived ? "text-primary bg-primary/10" : "text-muted-foreground"
                        )}
                    >
                        {showArchived ? "View Active" : "View Archived"}
                    </Button>
                </div>
            </div>

            <div id="tour-amend-grid" className="rounded-md border border-border bg-white overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                            <TableHead className="w-[200px] font-bold text-foreground">Date</TableHead>
                            <TableHead className="font-bold text-foreground">Request Details</TableHead>
                            <TableHead className="w-[150px] font-bold text-foreground">Status</TableHead>
                            <TableHead className="text-right font-bold text-foreground w-[180px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell>
                                        <div className="space-y-2">
                                            <Skeleton className="h-5 w-40" />
                                            <Skeleton className="h-3 w-32" />
                                        </div>
                                    </TableCell>
                                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredRequests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                    No {showArchived ? 'archived' : 'active'} requests found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedDates.map(date => {
                                const dayRequests = groupedRequests[date]
                                return dayRequests.map((req, index) => (
                                    <TableRow key={req.id} className="hover:bg-muted/50">
                                        {index === 0 && (
                                            <TableCell rowSpan={dayRequests.length} className="align-top font-medium border-r border-border/50 bg-muted/5">
                                                <div className="flex flex-col gap-1 sticky top-4">
                                                    <span className="text-base font-semibold">{format(new Date(req.date), 'MMM dd, yyyy')}</span>
                                                    <span className="text-xs text-muted-foreground font-normal">
                                                        {(() => {
                                                            const d = new Date(req.date)
                                                            if (isSameDay(d, new Date())) return "Today"
                                                            if (isSameDay(d, subDays(new Date(), 1))) return "Yesterday"
                                                            if (isSameDay(d, subDays(new Date(), 2))) return "Day Before"
                                                            return format(d, 'EEEE')
                                                        })()}
                                                    </span>
                                                </div>
                                            </TableCell>
                                        )}
                                        <TableCell className="align-top py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="font-bold capitalize shadow-none">
                                                        {req.type.toLowerCase().replace('_', ' ')}
                                                    </Badge>
                                                    <div className="flex items-center text-sm font-mono text-muted-foreground">
                                                        <Clock className="w-3.5 h-3.5 mr-1.5" />
                                                        {new Date(req.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: userTimeZone })}
                                                    </div>
                                                </div>
                                                <p className="text-sm text-foreground/80 pl-1 border-l-2 border-muted mt-1 italic">
                                                    "{req.reason}"
                                                </p>
                                                {req.declineReason && (
                                                    <p className="text-xs text-red-600 font-semibold mt-1">Declined: {req.declineReason}</p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="align-top py-4">
                                            {getStatusBadge(req.status)}
                                        </TableCell>
                                        <TableCell className="align-top text-right py-4">
                                            <div className="flex flex-col items-end gap-2">
                                                <div className="flex items-center justify-end gap-1">
                                                    {(!req.isArchived) && (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleEdit(req)} title={req.status === 'PENDING' ? "Edit Request" : "Submit New Request"}>
                                                                <Pencil className="h-4 w-4" />
                                                                <span className="sr-only">Edit</span>
                                                            </Button>
                                                            {req.status === 'PENDING' ? (
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(req.id)} title="Cancel Request">
                                                                    <Trash2 className="h-4 w-4" />
                                                                    <span className="sr-only">Cancel</span>
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleArchive(req.id)}
                                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                                                                    title="Archive Request"
                                                                >
                                                                    <Archive className="h-4 w-4" />
                                                                    <span className="sr-only">Archive</span>
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                    {req.isArchived && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleUnarchive(req.id)}
                                                            className="h-8 w-8 text-primary hover:text-primary/80 hover:bg-primary/10"
                                                            title="Unarchive Request"
                                                        >
                                                            <ArchiveRestore className="h-4 w-4" />
                                                            <span className="sr-only">Unarchive</span>
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
