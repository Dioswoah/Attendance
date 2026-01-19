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
}

export default function LeaveRequestsPage() {
    const { data: session, status } = useSession()
    const [requests, setRequests] = useState<LeaveRequest[]>([])
    const [dialogOpen, setDialogOpen] = useState(false)
    const [filterStatus, setFilterStatus] = useState<string>("all")
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Form state
    const [leaveType, setLeaveType] = useState<string>("SICK")
    const [duration, setDuration] = useState<DurationType>("Full Day")
    const [startDate, setStartDate] = useState<string>("")
    const [endDate, setEndDate] = useState<string>("")
    const [startTime, setStartTime] = useState<string>("09:00")
    const [endTime, setEndTime] = useState<string>("13:00")
    const [reason, setReason] = useState<string>("")

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
            console.error("Failed to fetch leave requests:", error)
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

    const filteredRequests = filterStatus === "all"
        ? requests
        : requests.filter((r) => r.status === filterStatus)

    const handleSubmitRequest = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!session?.user?.id) return

        setIsSubmitting(true)
        try {
            const start = new Date(startDate)
            const end = new Date(endDate)
            const diffTime = Math.abs(end.getTime() - start.getTime())
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

            const res = await fetch('/api/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: session.user.id,
                    startDate,
                    endDate,
                    type: leaveType,
                    reason,
                    duration: duration === 'Full Day' && diffDays > 1 ? `${diffDays} Days` : duration,
                    startTime: duration !== 'Full Day' ? new Date(`${startDate}T${startTime}:00`).toISOString() : null,
                    endTime: duration !== 'Full Day' ? new Date(`${startDate}T${endTime}:00`).toISOString() : null
                })
            })

            if (res.ok) {
                setDialogOpen(false)
                resetForm()
                fetchLeaveRequests()
                alert("Leave request submitted successfully!")
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

    const resetForm = () => {
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

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
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
                            <DialogTitle>Request Leave</DialogTitle>
                            <DialogDescription>
                                Submit a new leave request for approval.
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
                                        <SelectItem value="VACATION">Vacation</SelectItem>
                                        <SelectItem value="PERSONAL">Personal</SelectItem>
                                        <SelectItem value="EMERGENCY">Emergency</SelectItem>
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
                                        onChange={(e) => setStartDate(e.target.value)}
                                        required
                                        className="h-10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date</Label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
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
                                    Submit Request
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
            </div>

            {/* Requests List */}
            <div className="space-y-4">
                {filteredRequests.map((request) => (
                    <Card key={request.id} className="border border-border shadow-sm rounded-xl overflow-hidden bg-white hover:bg-muted/30 transition-colors">
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-3 flex-1">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h3 className="text-lg font-semibold text-foreground capitalize">{request.type.toLowerCase().replace('_', ' ')}</h3>
                                        <Badge variant="outline" className="font-normal text-xs bg-muted/50 border-border text-muted-foreground">
                                            {request.duration}
                                        </Badge>
                                        {getStatusBadge(request.status)}
                                    </div>

                                    <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-primary/70" />
                                            <span className="font-medium text-foreground">
                                                {request.startDate ? format(new Date(request.startDate), 'MMM dd') : 'N/A'}
                                                {' - '}
                                                {request.endDate ? format(new Date(request.endDate), 'MMM dd') : 'N/A'}
                                            </span>
                                        </span>
                                        {request.startTime && request.endTime && (
                                            <span className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-primary/70" />
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
                                            </span>
                                        )}
                                        <span className="flex items-center gap-2 text-xs">
                                            <span>Submitted:</span>
                                            {request.createdAt ? format(new Date(request.createdAt), 'MMM dd, yyyy') : 'Unknown Date'}
                                        </span>
                                    </div>

                                    <div className="bg-muted/30 p-3 rounded-lg border border-border/50 max-w-3xl">
                                        <p className="text-sm text-foreground italic">"{request.reason}"</p>
                                    </div>

                                    {request.status === "DECLINED" && request.declineReason && (
                                        <div className="bg-red-50 p-3 rounded-lg border border-red-100 max-w-3xl">
                                            <p className="text-xs font-semibold text-red-600 mb-1">Decline Reason:</p>
                                            <p className="text-sm text-red-700">"{request.declineReason}"</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {filteredRequests.length === 0 && (
                    <Card className="border border-border shadow-sm rounded-xl bg-white">
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
