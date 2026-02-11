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
import { Plus, Clock, FileText, Loader2, Calendar, UserMinus, Pencil, Trash2, Archive, ArchiveRestore, Coffee, Edit3 } from "lucide-react"
import { format, subDays, isSameDay, parseISO, eachDayOfInterval, startOfDay, endOfDay } from "date-fns"
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
        start: format(subDays(new Date(), 2), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    })
    const [viewFilter, setViewFilter] = useState("all") // 'all', 'today', 'yesterday', 'before'

    const [actualRecords, setActualRecords] = useState<any[]>([])
    const [isLoadingRecords, setIsLoadingRecords] = useState(true)

    const filteredRequests = requests.filter(r => {
        const matchesArchive = showArchived ? r.isArchived : !r.isArchived
        if (!matchesArchive) return false

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


    useEffect(() => {
        if (session?.user?.id) {
            fetchRequests()
            fetchAttendanceHistory()
            fetchActualRecords()
        }
    }, [session, dateFilter])

    const fetchActualRecords = async () => {
        if (!session?.user?.id) return
        setIsLoadingRecords(true)
        try {
            const res = await fetch(`/api/attendance?userId=${session.user.id}&startDate=${dateFilter.start}&endDate=${dateFilter.end}`)
            if (res.ok) {
                setActualRecords(await res.json())
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoadingRecords(false)
        }
    }

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
                    <DialogContent>
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
                                <div className="flex justify-between text-xs pt-1 border-t border-border/20">
                                    <span className="text-muted-foreground uppercase font-bold tracking-wider">Correcting</span>
                                    <span className="font-semibold text-red-600">{recordType.replace('_', ' ')}</span>
                                </div>
                            </div>

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
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <div className="flex justify-center"><Loader2 className="animate-spin text-red-600" /></div>
                                    </TableCell>
                                </TableRow>
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
                                    const record = actualRecords.find(r => r.date === dateStr && r.mode !== 'LEAVE')

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
                                                {record ? (
                                                    <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-wide">
                                                        {record.mode}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground italic">No Log</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center align-middle font-mono text-sm">
                                                <div className="flex items-center justify-center gap-1.5 group/in">
                                                    <span>{record?.clockIn ? format(parseISO(record.clockIn), 'hh:mm a') : '---'}</span>
                                                    {record?.clockIn && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedDateOption(dateStr);
                                                                setRecordType("CLOCK_IN");
                                                                setReferenceTime(`Current: ${format(parseISO(record.clockIn), 'hh:mm a')}`);
                                                                setTime(format(parseISO(record.clockIn), 'HH:mm'));
                                                                setDialogOpen(true);
                                                            }}
                                                            className="text-muted-foreground hover:text-red-600 transition-colors opacity-0 group-hover/in:opacity-100"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center align-middle font-mono text-sm text-muted-foreground">
                                                <div className="flex items-center justify-center gap-1.5 group/out">
                                                    <span>{record?.clockOut ? format(parseISO(record.clockOut), 'hh:mm a') : '---'}</span>
                                                    {record?.clockOut && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedDateOption(dateStr);
                                                                setRecordType("CLOCK_OUT");
                                                                setReferenceTime(`Current: ${format(parseISO(record.clockOut), 'hh:mm a')}`);
                                                                setTime(format(parseISO(record.clockOut), 'HH:mm'));
                                                                setDialogOpen(true);
                                                            }}
                                                            className="text-muted-foreground hover:text-red-600 transition-colors opacity-0 group-hover/out:opacity-100"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center align-middle">
                                                {record?.breaks && record.breaks.length > 0 ? (
                                                    <div className="flex flex-col gap-1 items-center font-mono">
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
                                                                            setReferenceTime(`Current: ${format(parseISO(b.startTime), 'hh:mm a')}`);
                                                                            setTime(format(parseISO(b.startTime), 'HH:mm'));
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
                                                                                setReferenceTime(`Current: ${format(parseISO(b.endTime), 'hh:mm a')}`);
                                                                                setTime(format(parseISO(b.endTime), 'HH:mm'));
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
                                                    <span className="text-xs text-muted-foreground italic">None</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right align-middle border-l border-border/50 bg-muted/5">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 font-bold text-[10px] uppercase tracking-widest h-7 px-2"
                                                    onClick={() => {
                                                        setSelectedDateOption(dateStr)
                                                        // Identify default action based on record status
                                                        if (!record) setRecordType("CLOCK_IN")
                                                        else if (!record.clockOut) setRecordType("CLOCK_OUT")
                                                        else setRecordType("CLOCK_IN")

                                                        setReferenceTime(record ? "Multiple entries found. Use specific icons to amend exact times." : "No log found for this date.")
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
