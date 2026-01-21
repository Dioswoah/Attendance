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
import { Plus, Clock, FileText, Loader2, Calendar } from "lucide-react"
import { format, subDays } from "date-fns"
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
}

export default function AmendRecordsPage() {
    const { data: session } = useSession()
    const [requests, setRequests] = useState<AttendanceRequest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

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
                if (record.clockIn) timeStr = format(new Date(record.clockIn), 'hh:mm a')
                break
            case "CLOCK_OUT":
                if (record.clockOut) timeStr = format(new Date(record.clockOut), 'hh:mm a')
                break
            case "BREAK_START":
                // Check breaks array for latest or just show main if simplified
                if (record.breaks && record.breaks.length > 0) {
                    timeStr = record.breaks.map((b: any) => format(new Date(b.startTime), 'hh:mm a')).join(', ')
                } else if (record.breakStart) {
                    timeStr = format(new Date(record.breakStart), 'hh:mm a')
                }
                break
            case "BREAK_END":
                if (record.breaks && record.breaks.length > 0) {
                    timeStr = record.breaks.map((b: any) => b.endTime ? format(new Date(b.endTime), 'hh:mm a') : 'Active').join(', ')
                } else if (record.breakEnd) {
                    timeStr = format(new Date(record.breakEnd), 'hh:mm a')
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
            const targetDate = new Date(dateStr)

            // Construct DateTime for the "time"
            // We need to combine targetDate (YYYY-MM-DD) with time (HH:MM)
            const dateTimeStr = `${dateStr}T${time}:00`

            const payload = {
                userId: session.user.id,
                date: targetDate.toISOString(),
                type: recordType,
                time: new Date(dateTimeStr).toISOString(),
                reason
            }

            const res = await fetch('/api/attendance-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                setDialogOpen(false)
                resetForm()
                fetchRequests()
            } else {
                alert("Failed to submit request")
            }
        } catch (error) {
            console.error(error)
            alert("Error submitting request")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Cancel this request?")) return
        try {
            const res = await fetch(`/api/attendance-requests/${id}`, { method: 'DELETE' })
            if (res.ok) fetchRequests()
        } catch (e) { /* Error handled */ }
    }

    const resetForm = () => {
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

    return (
        <div className="space-y-8 w-full max-w-[1200px] mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Amend Records</h1>
                    <p className="text-muted-foreground mt-1">Request corrections for your attendance logs.</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-red-600 hover:bg-red-700 text-white gap-2">
                            <Plus className="w-4 h-4" /> New Request
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Request Correction</DialogTitle>
                            <DialogDescription>Submit a change for Clock In/Out or Break times.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
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
                                <Button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white">
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Submit Request
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4">
                {isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-red-600" /></div>
                ) : requests.length === 0 ? (
                    <Card className="bg-muted/30 border-dashed shadow-none">
                        <CardContent className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                            <FileText className="w-10 h-10 mb-2 opacity-20" />
                            <p>No amendment requests found.</p>
                        </CardContent>
                    </Card>
                ) : (
                    requests.map(req => (
                        <Card key={req.id} className="overflow-hidden">
                            <CardContent className="p-4 flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-base capitalize">{req.type.toLowerCase().replace('_', ' ')}</h3>
                                        <span className="text-xs text-muted-foreground">
                                            on {format(new Date(req.date), 'MMM dd, yyyy')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-foreground/80">
                                        <Clock className="w-4 h-4 text-red-600" />
                                        <span className="font-mono font-medium">
                                            {new Date(req.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground italic">"{req.reason}"</p>
                                    {req.declineReason && <p className="text-xs text-red-600 font-semibold mt-1">Declined: {req.declineReason}</p>}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    {getStatusBadge(req.status)}
                                    {req.status === 'PENDING' && (
                                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-8 text-xs" onClick={() => handleDelete(req.id)}>
                                            Cancel
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}
