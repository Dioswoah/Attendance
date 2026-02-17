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
import { Plus, Calendar, Clock, FileText, X, Loader2, Pencil, Trash2, Archive, ArchiveRestore } from "lucide-react"
import { format, isSameDay, subDays } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

type LeaveStatus = "PENDING" | "APPROVED" | "DECLINED"
type DurationType = "Full Day" | "Half Day" | "Part Day"

interface LeaveRequest {
    id: string
    type: string
    duration: string
    startDate: string
    endDate: string
    startTime?: string
    endTime?: string
    reason: string
    status: LeaveStatus
    createdAt: string
    declineReason?: string
    isArchived?: boolean
}

export default function LeaveRequestsPage() {
    const { data: session, status } = useSession()
    const [requests, setRequests] = useState<LeaveRequest[]>([])
    const [dialogOpen, setDialogOpen] = useState(false)
    const [filterStatus, setFilterStatus] = useState<string>("all")
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showArchived, setShowArchived] = useState(false)

    // Form state
    const [leaveType, setLeaveType] = useState<string>("SICK")
    const [duration, setDuration] = useState<DurationType>("Full Day")
    const [startDate, setStartDate] = useState<string>("")
    const [endDate, setEndDate] = useState<string>("")
    const [startTime, setStartTime] = useState<string>("09:00")
    const [endTime, setEndTime] = useState<string>("13:00")
    const [reason, setReason] = useState<string>("")
    const [editingId, setEditingId] = useState<string | null>(null)
    const [dateFilter, setDateFilter] = useState({
        start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    })

    useEffect(() => {
        if (session?.user?.id) {
            fetchLeaveRequests()
        }
    }, [session])

    const fetchLeaveRequests = async () => {
        if (!session?.user?.id) return
        setIsLoading(true)
        try {
            const res = await fetch(`/api/leaves?userId=${session.user.id}`)
            if (res.ok) {
                const data = await res.json()
                setRequests(data)
            }
        } catch (error) {
            // Error
        } finally {
            setIsLoading(false)
        }
    }

    const getStatusBadge = (status: LeaveStatus) => {
        switch (status) {
            case "APPROVED":
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-100/80 border-green-200 font-medium">Approved</Badge>
            case "DECLINED":
                return <Badge className="bg-red-100 text-red-700 hover:bg-red-100/80 border-red-200 font-medium">Declined</Badge>
            default:
                return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100/80 border-yellow-200 font-medium">Pending</Badge>
        }
    }

    const formatTimeDisplay = (time: string) => {
        if (!time) return ""
        const [hours, minutes] = time.split(":")
        const hour = Number.parseInt(hours)
        const ampm = hour >= 12 ? "PM" : "AM"
        const hour12 = hour % 12 || 12
        return `${hour12}:${minutes} ${ampm}`
    }

    const filteredRequests = requests.filter((r) => {
        const matchesStatus = filterStatus === "all" || r.status === filterStatus
        const matchesArchive = showArchived ? r.isArchived : !r.isArchived

        // Date Range Filter (based on Date Submitted)
        const reqDate = new Date(r.createdAt).setHours(0, 0, 0, 0)
        const start = new Date(dateFilter.start).setHours(0, 0, 0, 0)
        const end = new Date(dateFilter.end).setHours(23, 59, 59, 999)
        const matchesDate = reqDate >= start && reqDate <= end

        return matchesStatus && matchesArchive && matchesDate
    })

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newStart = e.target.value
        setStartDate(newStart)
        if (endDate && newStart > endDate) {
            setEndDate(newStart) // Auto-correct end date if invalid
        }
    }

    const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newEnd = e.target.value
        if (startDate && newEnd < startDate) {
            // Don't allow setting end date before start date
            toast.error("End date cannot be before start date")
            return
        }
        setEndDate(newEnd)
    }

    const handleSubmitRequest = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!session?.user?.id) return

        // Validate time range for Part Day requests
        if (duration !== 'Full Day' && startTime >= endTime) {
            toast.error("Start time must be earlier than end time")
            return
        }

        setIsSubmitting(true)
        try {
            const start = new Date(startDate)
            const end = new Date(endDate)
            const diffTime = Math.abs(end.getTime() - start.getTime())
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
            const calculatedDuration = duration === 'Full Day' && diffDays > 1 ? `${diffDays} Days` : duration

            const payload = {
                userId: session.user.id,
                startDate,
                endDate,
                type: leaveType,
                reason,
                duration: calculatedDuration,
                startTime: duration !== 'Full Day' ? new Date(`${startDate}T${startTime}:00`).toISOString() : null,
                endTime: duration !== 'Full Day' ? new Date(`${startDate}T${endTime}:00`).toISOString() : null
            }

            const url = editingId ? `/api/leaves/${editingId}` : '/api/leaves'
            const method = editingId ? 'PATCH' : 'POST'

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                setDialogOpen(false)
                resetForm()
                fetchLeaveRequests()
                toast.success(editingId ? "Leave request updated successfully!" : "Leave request submitted successfully!")
            } else {
                const data = await res.json()
                toast.error(data.error || "Failed to submit leave request")
            }
        } catch (error) {
            console.error("Failed to submit leave request:", error)
            toast.error("An error occurred while submitting the request")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleEdit = (request: LeaveRequest) => {
        // If Approved/Declined, treat as new request
        if (['APPROVED', 'DECLINED'].includes(request.status)) {
            setEditingId(null)
        } else {
            setEditingId(request.id)
        }
        setLeaveType(request.type)
        // Parse duration back to type? Simplification: if it contains "Days" it's Full Day, else it is what it matches
        if (request.duration === 'Half Day') setDuration('Half Day')
        else if (request.duration === 'Part Day') setDuration('Part Day')
        else setDuration('Full Day')

        setStartDate(request.startDate.split('T')[0])
        setEndDate(request.endDate.split('T')[0])

        if (request.startTime) setStartTime(new Date(request.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
        if (request.endTime) setEndTime(new Date(request.endTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))

        setReason(request.reason)
        setDialogOpen(true)
    }

    const handleDelete = (id: string) => {
        toast("Are you sure you want to cancel this leave request?", {
            description: "This action cannot be undone.",
            action: {
                label: "Confirm",
                onClick: async () => {
                    const deleteToast = toast.loading("Cancelling request...")
                    try {
                        const res = await fetch(`/api/leaves/${id}`, { method: 'DELETE' })
                        if (res.ok) {
                            fetchLeaveRequests()
                            toast.success("Leave request cancelled", { id: deleteToast })
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

    const handleArchive = async (id: string) => {
        try {
            const res = await fetch(`/api/leaves/${id}`, {
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
            const res = await fetch(`/api/leaves/${id}`, {
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

    const resetForm = () => {
        setEditingId(null)
        setLeaveType("SICK")
        setDuration("Full Day")
        setStartDate("")
        setEndDate("")
        setStartTime("09:00")
        setEndTime("13:00")
        setReason("")
    }

    // Loading check removed to allow Skeleton UI rendering
    // if (status === "loading" || isLoading) { ... } removed

    if (status === "unauthenticated") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <div className="bg-red-50 p-4 rounded-full">
                    <X className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold">Access Denied</h3>
                <p className="text-muted-foreground">You must be signed in to view this page.</p>
                <Button onClick={() => window.location.href = "/"}>Sign In</Button>
            </div>
        )
    }

    return (
        <div className="space-y-8 w-full">
            {/* Header */}
            <div id="tour-leaves-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Leave Requests</h1>
                    <p className="text-base text-muted-foreground mt-1">Submit and track your leave requests</p>
                </div>
                <Dialog
                    open={dialogOpen}
                    onOpenChange={(open) => {
                        setDialogOpen(open)
                        if (!open) resetForm()
                    }}
                >
                    <DialogTrigger asChild>
                        <Button id="tour-leaves-request-btn" className="h-10 px-6 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            <span>Request Leave</span>
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>{editingId ? "Edit Leave Request" : "Request Leave"}</DialogTitle>
                            <DialogDescription>
                                {editingId ? "Update your leave details." : "Submit a new leave request for approval."}
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleSubmitRequest} className="space-y-6 pt-4">
                            {/* Leave Type */}
                            <div className="space-y-2">
                                <Label>Leave Type</Label>
                                <Select value={leaveType} onValueChange={setLeaveType} required>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SICK">Sick / Personal Leave</SelectItem>
                                        <SelectItem value="VACATION">Vacation / Holiday Leave</SelectItem>
                                        <SelectItem value="BIRTHDAY">Birthday Leave</SelectItem>
                                        <SelectItem value="MATERNITY">Maternity/Paternity</SelectItem>
                                        <SelectItem value="OTHER">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Duration Parameter */}
                            <div className="space-y-2">
                                <Label>Duration</Label>
                                <div className="flex gap-2">
                                    {(['Full Day', 'Part Day'] as DurationType[]).map((type) => (
                                        <Button
                                            key={type}
                                            type="button"
                                            onClick={() => setDuration(type)}
                                            variant={duration === type ? 'default' : 'outline'}
                                            className={cn(
                                                "flex-1 h-9 text-sm font-medium transition-all",
                                                duration === type ? "bg-red-600 hover:bg-red-700 text-white" : ""
                                            )}
                                        >
                                            {type}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Date Range */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Date</Label>
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={handleStartDateChange}
                                        required
                                        className="h-10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date</Label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={handleEndDateChange}
                                        required
                                        className="h-10"
                                    />
                                </div>
                            </div>

                            {duration !== 'Full Day' && (
                                <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                                    <div className="space-y-2">
                                        <Label>From</Label>
                                        <Input
                                            type="time"
                                            value={startTime}
                                            onChange={e => {
                                                const newStartTime = e.target.value
                                                if (endTime && newStartTime >= endTime) {
                                                    toast.error("Start time must be earlier than end time")
                                                    return
                                                }
                                                setStartTime(newStartTime)
                                            }}
                                            className="h-10"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>To</Label>
                                        <Input
                                            type="time"
                                            value={endTime}
                                            onChange={e => {
                                                const newEndTime = e.target.value
                                                if (startTime && newEndTime <= startTime) {
                                                    toast.error("End time must be later than start time")
                                                    return
                                                }
                                                setEndTime(newEndTime)
                                            }}
                                            className="h-10"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Reason */}
                            <div className="space-y-2">
                                <Label>Reason</Label>
                                <Textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Please provide a reason..."
                                    className="min-h-[100px] resize-none"
                                    required
                                />
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="h-10 px-8 bg-red-600 hover:bg-red-700 text-white font-medium"
                                >
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    {editingId ? "Update Request" : "Submit Request"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filter */}
            <div id="tour-leaves-filter" className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Status:</span>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[140px] h-9 bg-white border-border rounded-lg text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="APPROVED">Approved</SelectItem>
                            <SelectItem value="DECLINED">Denied</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 border border-border rounded-lg shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">From</span>
                        <Input
                            type="date"
                            value={dateFilter.start}
                            onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                            className="h-7 w-auto min-w-[110px] border-none bg-transparent focus-visible:ring-0 text-xs font-medium p-0"
                        />
                    </div>
                    <div className="w-px h-5 bg-border" />
                    <div className="flex items-center gap-2 px-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">To</span>
                        <Input
                            type="date"
                            value={dateFilter.end}
                            onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                            className="h-7 w-auto min-w-[110px] border-none bg-transparent focus-visible:ring-0 text-xs font-medium p-0"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:ml-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowArchived(!showArchived)}
                        className={cn(
                            "text-xs font-bold uppercase tracking-widest h-9",
                            showArchived ? "text-primary bg-primary/10" : "text-muted-foreground"
                        )}
                    >
                        {showArchived ? "View Active" : "View Archived"}
                    </Button>
                </div>
            </div>

            {/* Requests List */}
            <div id="tour-leaves-grid" className="rounded-md border border-border bg-white overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                            <TableHead className="w-[200px] font-bold text-foreground">Date Submitted</TableHead>
                            <TableHead className="font-bold text-foreground">Request Details</TableHead>
                            <TableHead className="w-[150px] font-bold text-foreground">Duration</TableHead>
                            <TableHead className="w-[150px] font-bold text-foreground">Status</TableHead>
                            <TableHead className="text-right font-bold text-foreground w-[180px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell>
                                        <div className="space-y-2">
                                            <Skeleton className="h-5 w-40" />
                                            <Skeleton className="h-3 w-32" />
                                        </div>
                                    </TableCell>
                                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredRequests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Calendar className="w-8 h-8 opacity-20" />
                                        <p>No {showArchived ? 'archived' : filterStatus.toLowerCase() !== 'all' ? filterStatus.toLowerCase() : 'active'} requests found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            Object.entries(
                                filteredRequests.reduce((groups, req) => {
                                    const dateStr = format(new Date(req.createdAt), 'yyyy-MM-dd')
                                    if (!groups[dateStr]) groups[dateStr] = []
                                    groups[dateStr].push(req)
                                    return groups
                                }, {} as Record<string, LeaveRequest[]>)
                            ).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                                .map(([date, requests]) => (
                                    requests.map((request, index) => (
                                        <TableRow key={request.id} className="hover:bg-muted/50">
                                            {index === 0 && (
                                                <TableCell rowSpan={requests.length} className="align-top font-medium border-r border-border/50 bg-muted/5">
                                                    <div className="flex flex-col gap-1 sticky top-4">
                                                        <span className="text-base font-semibold">{format(new Date(date), 'MMM dd, yyyy')}</span>
                                                        <span className="text-xs text-muted-foreground font-normal">
                                                            {(() => {
                                                                const d = new Date(date)
                                                                if (isSameDay(d, new Date())) return "Today"
                                                                if (isSameDay(d, subDays(new Date(), 1))) return "Yesterday"
                                                                return format(d, 'EEEE')
                                                            })()}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                            )}
                                            <TableCell className="align-top py-4">
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-base text-foreground capitalize">
                                                            {request.type === 'SICK' ? 'Sick / Personal Leave' :
                                                                request.type === 'VACATION' ? 'Vacation / Holiday Leave' :
                                                                    request.type.toLowerCase().replace('_', ' ')}
                                                        </h3>
                                                    </div>

                                                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="w-3.5 h-3.5" />
                                                            <span className="font-medium text-foreground/80">
                                                                {request.startDate ? format(new Date(request.startDate), 'MMM dd, yyyy') : 'N/A'}
                                                                {request.startDate !== request.endDate && ` - ${request.endDate ? format(new Date(request.endDate), 'MMM dd, yyyy') : 'N/A'}`}
                                                            </span>
                                                        </div>
                                                        {request.startTime && request.endTime && (
                                                            <div className="flex items-center gap-2">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                <span>
                                                                    {(() => {
                                                                        try {
                                                                            const start = request.startTime ? formatTimeDisplay(new Date(request.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })) : 'N/A'
                                                                            const end = request.endTime ? formatTimeDisplay(new Date(request.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })) : 'N/A'
                                                                            return `${start} - ${end}`
                                                                        } catch (e) {
                                                                            return 'Time error'
                                                                        }
                                                                    })()}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <p className="text-sm text-foreground/80 pl-2 border-l-2 border-muted mt-1 italic">
                                                        "{request.reason}"
                                                    </p>

                                                    {request.status === "DECLINED" && request.declineReason && (
                                                        <div className="bg-red-50 p-2 rounded border border-red-100 mt-1">
                                                            <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Decline Reason</p>
                                                            <p className="text-xs text-red-700">"{request.declineReason}"</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top py-4">
                                                <Badge variant="outline" className="font-medium text-xs bg-muted/50 border-border text-muted-foreground whitespace-nowrap">
                                                    {request.duration}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="align-top py-4">
                                                {getStatusBadge(request.status)}
                                            </TableCell>
                                            <TableCell className="align-top text-right py-4">
                                                <div className="flex flex-col items-end gap-2">
                                                    {(!request.isArchived) && (
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleEdit(request)} title="Edit Request">
                                                                <Pencil className="h-4 w-4" />
                                                                <span className="sr-only">Edit</span>
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(request.id)} title="Cancel Request">
                                                                <Trash2 className="h-4 w-4" />
                                                                <span className="sr-only">Cancel</span>
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {['APPROVED', 'DECLINED'].includes(request.status) && !request.isArchived && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleArchive(request.id)}
                                                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                                                            title="Archive Request"
                                                        >
                                                            <Archive className="h-4 w-4" />
                                                            <span className="sr-only">Archive</span>
                                                        </Button>
                                                    )}
                                                    {request.isArchived && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleUnarchive(request.id)}
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
                                ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
