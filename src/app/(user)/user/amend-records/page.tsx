"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Clock, FileText, Loader2, Calendar, UserMinus, Pencil, Trash2, Archive, ArchiveRestore } from "lucide-react"
import { format, subDays, isSameDay } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

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

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch('/api/user/me')
                if (res.ok) {
                    const data = await res.json()
                    if (data.location === 'Philippines') setUserTimeZone('Asia/Manila')
                    else if (data.location === 'Australia') setUserTimeZone('Australia/Sydney')
                }
            } catch { }
        }
        fetchProfile()
    }, [])

    const [dateFilter, setDateFilter] = useState({
        start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    })

    const filteredRequests = requests.filter(r => {
        const matchesArchive = showArchived ? r.isArchived : !r.isArchived
        if (!matchesArchive) return false

        // Date Range Filter
        const reqDate = new Date(r.date).setHours(0, 0, 0, 0)
        const start = new Date(dateFilter.start).setHours(0, 0, 0, 0)
        const end = new Date(dateFilter.end).setHours(23, 59, 59, 999)

        if (reqDate < start || reqDate > end) return false

        // Hide cascaded requests (Break/ClockOut) if the Root Clock In is still pending
        if (r.status === 'PENDING' && ['BREAK_START', 'BREAK_END', 'CLOCK_OUT'].includes(r.type)) {
            const reqDateStr = new Date(r.date).toLocaleDateString()
            const hasPendingClockIn = requests.some(pr =>
                pr.type === 'CLOCK_IN' &&
                pr.status === 'PENDING' &&
                new Date(pr.date).toLocaleDateString() === reqDateStr
            )
            if (hasPendingClockIn) return false
        }

        return true
    })

    // Dynamic Date Options
    const [dateOptions, setDateOptions] = useState<{ label: string, value: string }[]>([])

    // Form State
    const [selectedDateOption, setSelectedDateOption] = useState("today")
    const [recordType, setRecordType] = useState("CLOCK_IN")
    const [time, setTime] = useState("")
    const [reason, setReason] = useState("")

    // Reference Data
    const [attendanceHistory, setAttendanceHistory] = useState<any[]>([])
    const [referenceTime, setReferenceTime] = useState<string | null>(null)

    useEffect(() => {
        // Generate last 3 days
        const today = new Date()
        const opts = [
            { label: `${format(today, 'MMM dd, yyyy')} (Today)`, value: format(today, 'yyyy-MM-dd') },
            { label: `${format(subDays(today, 1), 'MMM dd, yyyy')} (Yesterday)`, value: format(subDays(today, 1), 'yyyy-MM-dd') },
            { label: `${format(subDays(today, 2), 'MMM dd, yyyy')} (Day Before)`, value: format(subDays(today, 2), 'yyyy-MM-dd') },
        ]
        setDateOptions(opts)
        setSelectedDateOption(opts[0].value) // Default to today
    }, [])

    useEffect(() => {
        if (session?.user?.id) {
            fetchRequests()
            fetchAttendanceHistory()
        }
    }, [session])

    useEffect(() => {
        updateReferenceTime()
    }, [selectedDateOption, recordType, attendanceHistory])

    const fetchAttendanceHistory = async () => {
        if (!session?.user?.id) return
        try {
            // Fetch last few days
            const end = new Date()
            const start = subDays(end, 3)
            const res = await fetch(`/api/attendance?userId=${session.user.id}&startDate=${start.toISOString()}&endDate=${end.toISOString()}`)
            if (res.ok) {
                setAttendanceHistory(await res.json())
            }
        } catch (error) {
            // Error handled
        }
    }

    const updateReferenceTime = () => {
        if (!attendanceHistory.length) return

        // Find record for selected date
        // Note: attendanceHistory dates are usually YYYY-MM-DD strings from API transform
        const record = attendanceHistory.find(a => a.date === selectedDateOption)

        if (!record) {
            setReferenceTime("No record found for this date")
            return
        }

        let timeStr = "Not recorded"

        switch (recordType) {
            case "CLOCK_IN":
                if (record.clockIn) timeStr = new Date(record.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: userTimeZone })
                break
            case "CLOCK_OUT":
                if (record.clockOut) timeStr = new Date(record.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: userTimeZone })
                break
            case "BREAK_START":
                // Check breaks array for latest or just show main if simplified
                if (record.breaks && record.breaks.length > 0) {
                    timeStr = record.breaks.map((b: any) => new Date(b.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: userTimeZone })).join(', ')
                } else if (record.breakStart) {
                    timeStr = new Date(record.breakStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: userTimeZone })
                }
                break
            case "BREAK_END":
                if (record.breaks && record.breaks.length > 0) {
                    timeStr = record.breaks.map((b: any) => b.endTime ? new Date(b.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: userTimeZone }) : 'Active').join(', ')
                } else if (record.breakEnd) {
                    timeStr = new Date(record.breakEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: userTimeZone })
                }
                break
        }

        setReferenceTime(`Current: ${timeStr}`)
    }

    const fetchRequests = async () => {
        if (!session?.user?.id) return
        setIsLoading(true)
        try {
            const res = await fetch(`/api/attendance-requests?userId=${session.user.id}`)
            if (res.ok) {
                setRequests(await res.json())
            }
        } catch (error) {
            // Error handled
        } finally {
            setIsLoading(false)
        }
    }

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

            const payload = {
                userId: session.user.id,
                // For the logical 'date' field, we always want UTC Midnight of the selected day,
                // regardless of user timezone, so it matches the canonical session date.
                date: new Date(`${dateStr}T00:00:00Z`).toISOString(),
                type: recordType,
                time: new Date(dateTimeStr).toISOString(),
                reason
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
        } else {
            setEditingId(req.id)
        }

        setSelectedDateOption(format(new Date(req.date), 'yyyy-MM-dd'))
        setRecordType(req.type)
        setTime(format(new Date(req.time), 'HH:mm'))
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
        if (dateOptions.length > 0) setSelectedDateOption(dateOptions[0].value)
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
                    <DialogTrigger asChild>
                        <Button id="tour-amend-new-btn" className="bg-red-600 hover:bg-red-700 text-white gap-2">
                            <Plus className="w-4 h-4" /> New Request
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingId ? "Edit Correction Request" : "Request Correction"}</DialogTitle>
                            <DialogDescription>
                                {editingId ? "Update your correction details." : "Submit a change for Clock In/Out or Break times."}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                            {!editingId && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Date</Label>
                                        <Select value={selectedDateOption} onValueChange={setSelectedDateOption}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {dateOptions.map(opt => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Action Type</Label>
                                        <Select value={recordType} onValueChange={setRecordType}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CLOCK_IN">Clock In</SelectItem>
                                                <SelectItem value="CLOCK_OUT">Clock Out</SelectItem>
                                                <SelectItem value="BREAK_START">Start Break</SelectItem>
                                                <SelectItem value="BREAK_END">End Break</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            {editingId && (
                                <div className="p-3 bg-muted/40 rounded-lg text-sm mb-4 border border-border/50">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Date</Label>
                                            <p className="font-medium">{format(new Date(selectedDateOption), 'MMM dd, yyyy')}</p>
                                        </div>
                                        <div>
                                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Action Type</Label>
                                            <p className="font-medium capitalize">{recordType.toLowerCase().replace('_', ' ')}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label>Correct Time</Label>
                                    {referenceTime && (
                                        <span className="text-xs text-muted-foreground font-mono bg-muted px-1 rounded">
                                            {referenceTime}
                                        </span>
                                    )}
                                </div>
                                <Input type="time" value={time} onChange={e => setTime(e.target.value)} required />
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

            <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-8 mb-4 gap-4">
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
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    <div className="flex justify-center"><Loader2 className="animate-spin text-red-600" /></div>
                                </TableCell>
                            </TableRow>
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
                                                {(!req.isArchived) && (
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleEdit(req)} title="Edit Request">
                                                            <Pencil className="h-4 w-4" />
                                                            <span className="sr-only">Edit</span>
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(req.id)} title="Cancel Request">
                                                            <Trash2 className="h-4 w-4" />
                                                            <span className="sr-only">Cancel</span>
                                                        </Button>
                                                    </div>
                                                )}
                                                {['APPROVED', 'DECLINED'].includes(req.status) && !req.isArchived && (
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
