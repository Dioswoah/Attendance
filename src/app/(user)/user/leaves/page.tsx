"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Calendar, Clock, FileText, X, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

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
        return matchesStatus && matchesArchive
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
            alert("End date cannot be before start date")
            return
        }
        setEndDate(newEnd)
    }

    const handleSubmitRequest = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!session?.user?.id) return

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
                alert(editingId ? "Leave request updated successfully!" : "Leave request submitted successfully!")
            } else {
                const data = await res.json()
                alert(data.error || "Failed to submit leave request")
            }
        } catch (error) {
            console.error("Failed to submit leave request:", error)
            alert("An error occurred while submitting the request")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleEdit = (request: LeaveRequest) => {
        setEditingId(request.id)
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

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to cancel this leave request?")) return

        try {
            const res = await fetch(`/api/leaves/${id}`, { method: 'DELETE' })
            if (res.ok) {
                fetchLeaveRequests()
                alert("Leave request cancelled.")
            } else {
                alert("Failed to cancel request.")
            }
        } catch (e) {
            console.error(e)
            alert("Error cancelling request.")
        }
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

    if (status === "loading" || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            </div>
        )
    }

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
        <div className="space-y-8 w-full max-w-[1800px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                        <Button className="h-10 px-6 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-2">
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
                                        <SelectItem value="SICK">Sick Leave</SelectItem>
                                        <SelectItem value="VACATION">Vacation Leave</SelectItem>
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
                                    {(['Full Day', 'Half Day', 'Part Day'] as DurationType[]).map((type) => (
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
                                            onChange={e => setStartTime(e.target.value)}
                                            className="h-10"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>To</Label>
                                        <Input
                                            type="time"
                                            value={endTime}
                                            onChange={e => setEndTime(e.target.value)}
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
            <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-muted-foreground">Filter:</span>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40 h-10 bg-white border-border rounded-lg">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="APPROVED">Approved</SelectItem>
                        <SelectItem value="DECLINED">Denied</SelectItem>
                    </SelectContent>
                </Select>
                <div className="flex items-center gap-2 ml-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowArchived(!showArchived)}
                        className={cn(
                            "text-xs font-bold uppercase tracking-widest",
                            showArchived ? "text-primary bg-primary/10" : "text-muted-foreground"
                        )}
                    >
                        {showArchived ? "View Active" : "View Archived"}
                    </Button>
                </div>
            </div>

            {/* Requests List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {filteredRequests.map((request) => (
                    <Card key={request.id} className="border border-border shadow-sm rounded-xl overflow-hidden bg-white hover:bg-muted/30 transition-all hover:shadow-md flex flex-col group">
                        <CardContent className="p-6 flex-1 flex flex-col gap-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-bold text-foreground capitalize flex items-center gap-2">
                                        {request.type.toLowerCase().replace('_', ' ')}
                                    </h3>
                                    <Badge variant="outline" className="font-medium text-xs bg-muted/50 border-border text-muted-foreground w-fit">
                                        {request.duration}
                                    </Badge>
                                </div>
                                {getStatusBadge(request.status)}
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                                    <span className="font-medium text-foreground">
                                        {request.startDate ? format(new Date(request.startDate), 'MMM dd') : 'N/A'}
                                        {' - '}
                                        {request.endDate ? format(new Date(request.endDate), 'MMM dd') : 'N/A'}
                                    </span>
                                </div>

                                {request.startTime && request.endTime && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Clock className="w-4 h-4 text-primary shrink-0" />
                                        <span className="font-medium text-foreground">
                                            {(() => {
                                                try {
                                                    const start = request.startTime ? formatTimeDisplay(new Date(request.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })) : 'N/A'
                                                    const end = request.endTime ? formatTimeDisplay(new Date(request.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })) : 'N/A'
                                                    return `${start} - ${end}`
                                                } catch (e) {
                                                    return 'Invalid Time'
                                                }
                                            })()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="bg-muted/30 p-3 rounded-lg border border-border/50 text-sm italic text-foreground/80 mt-auto">
                                "{request.reason}"
                            </div>

                            {request.status === "DECLINED" && request.declineReason && (
                                <div className="bg-red-50 p-3 rounded-lg border border-red-100 mt-2">
                                    <p className="text-xs font-bold text-red-600 mb-1 uppercase tracking-wider">Decline Reason</p>
                                    <p className="text-sm text-red-700 leading-tight">"{request.declineReason}"</p>
                                </div>
                            )}

                            <div className="pt-2 border-t border-border mt-2 flex items-center justify-between">
                                <p className="text-xs text-muted-foreground font-mono">
                                    Submitted: {request.createdAt ? format(new Date(request.createdAt), 'MMM dd, yyyy') : 'Unknown Date'}
                                </p>
                                {request.status === 'PENDING' && (
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-100" onClick={() => handleEdit(request)}>
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-100" onClick={() => handleDelete(request.id)}>
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </Button>
                                    </div>
                                )}
                                {['APPROVED', 'DECLINED'].includes(request.status) && !request.isArchived && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleArchive(request.id)}
                                        className="h-8 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                                    >
                                        Archive
                                    </Button>
                                )}
                                {request.isArchived && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleUnarchive(request.id)}
                                        className="h-8 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80"
                                    >
                                        Unarchive
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {filteredRequests.length === 0 && (
                    <Card className="border border-border shadow-sm rounded-xl bg-white col-span-full">
                        <CardContent className="p-12 text-center">
                            <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-foreground">No requests found</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                {filterStatus === "all"
                                    ? "You haven't submitted any leave requests yet."
                                    : `No ${filterStatus.toLowerCase()} requests found.`}
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
