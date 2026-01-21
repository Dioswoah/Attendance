"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Check, X, Calendar as CalendarIcon, Clock, AlertCircle, Loader2, ChevronLeft, ChevronRight, Users, LayoutGrid, CalendarDays } from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO, isWithinInterval, startOfWeek, endOfWeek } from "date-fns"
import { cn } from "@/lib/utils"

interface Request {
    id: string
    userId: string
    userName: string
    userImage?: string
    department?: string
    type: string
    duration?: string
    startDate: string
    endDate: string
    startTime?: string
    endTime?: string
    time?: string // For attendance
    reason: string
    status: string
    createdAt: string
    kind?: 'LEAVE' | 'ATTENDANCE'
}

export default function ManagerControlPage() {
    const { data: session, status } = useSession()

    // Requests State
    const [pendingRequests, setPendingRequests] = useState<Request[]>([])

    // Calendar & Team State
    const [approvedLeaves, setApprovedLeaves] = useState<Request[]>([])
    const [monthlyAttendance, setMonthlyAttendance] = useState<any[]>([]) // Changed from activeAttendance to all month
    const [myTeam, setMyTeam] = useState<any[]>([])
    const [todaysAttendance, setTodaysAttendance] = useState<any[]>([])
    const [currentMonth, setCurrentMonth] = useState(new Date())

    // UI State
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
    const [actionType, setActionType] = useState<"approve" | "deny" | null>(null)
    const [denyReason, setDenyReason] = useState("")
    const [denyReasonError, setDenyReasonError] = useState(false)
    const [selectedDayDetail, setSelectedDayDetail] = useState<Date | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (session?.user?.id) {
            fetchInitialData()
        }
    }, [session])

    // Re-fetch calendar data when month changes
    useEffect(() => {
        if (session?.user?.id) {
            fetchMonthlyAttendance()
        }
    }, [currentMonth, session])

    const fetchInitialData = async () => {
        if (!session?.user?.id) return
        setIsLoading(true)
        try {
            // Parallel fetch for all needed data
            const [pendingLeaveRes, pendingAttRes, approvedRes, employeesRes, attendanceRes] = await Promise.all([
                fetch(`/api/leaves?managerId=${session.user.id}&status=PENDING`),
                fetch(`/api/attendance-requests?managerId=${session.user.id}&status=PENDING`),
                fetch(`/api/leaves?managerId=${session.user.id}&status=APPROVED`),
                fetch('/api/employees'),
                fetch('/api/attendance') // For today's sidebar status
            ])

            let combinedPending: Request[] = []

            if (pendingLeaveRes.ok) {
                const leaves = await pendingLeaveRes.json()
                combinedPending = [...combinedPending, ...leaves.map((l: any) => ({ ...l, kind: 'LEAVE' }))]
            }
            if (pendingAttRes.ok) {
                const attRequests = await pendingAttRes.json()
                combinedPending = [...combinedPending, ...attRequests.map((r: any) => ({
                    ...r,
                    kind: 'ATTENDANCE',
                    userName: r.user.name,
                    userImage: r.user.image,
                    department: r.user.department?.name,
                    startDate: r.date,
                    endDate: r.date,
                    duration: 'Correction', // or show time
                    type: r.type
                }))]
            }

            setPendingRequests(combinedPending)

            if (approvedRes.ok) setApprovedLeaves(await approvedRes.json()) // Only leaves affect calendar for now, or maybe approved attendance requests should trigger re-fetch of attendance data

            let allEmployees = []
            if (employeesRes.ok) {
                allEmployees = await employeesRes.json()
                // Filter for my managed staff
                const myStaff = allEmployees.filter((emp: any) => emp.managerId === session.user?.id)
                setMyTeam(myStaff)
            }

            if (attendanceRes.ok) {
                const attData = await attendanceRes.json()
                setTodaysAttendance(attData)
            }

            // Initial monthly fetch
            fetchMonthlyAttendance()

        } catch (error) {
            // Error
        } finally {
            setIsLoading(false)
        }
    }

    const fetchMonthlyAttendance = async () => {
        if (!session?.user?.id) return
        try {
            const start = startOfMonth(currentMonth)
            const end = endOfMonth(currentMonth)
            const query = new URLSearchParams({
                managerId: session.user.id,
                startDate: start.toISOString(),
                endDate: end.toISOString()
            })

            const res = await fetch(`/api/attendance?${query.toString()}`)
            if (res.ok) {
                setMonthlyAttendance(await res.json())
            }
        } catch (error) {
            // Error
        }
    }

    // --- Action Handlers ---
    const handleAction = (request: Request, action: "approve" | "deny") => {
        setSelectedRequest(request)
        setActionType(action)
        setDenyReason("")
        setDenyReasonError(false)
    }

    const confirmAction = async () => {
        if (actionType === "deny" && !denyReason.trim()) {
            setDenyReasonError(true)
            return
        }
        if (!selectedRequest) return

        setIsSubmitting(true)
        try {
            const body: any = { status: actionType === "approve" ? "APPROVED" : "DECLINED" }
            if (actionType === "deny" && denyReason) body.declineReason = denyReason

            const endpoint = selectedRequest.kind === 'ATTENDANCE'
                ? `/api/attendance-requests/${selectedRequest.id}`
                : `/api/leaves/${selectedRequest.id}`

            const res = await fetch(endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (res.ok) {
                // Remove from pending
                setPendingRequests(prev => prev.filter(r => r.id !== selectedRequest.id))
                // If approved, add to approved list (optimistic update or re-fetch)
                if (actionType === "approve") {
                    setApprovedLeaves(prev => [...prev, { ...selectedRequest, status: 'APPROVED' }])
                }
                setSelectedRequest(null)
                setActionType(null)
            } else {
                alert("Failed to update request")
            }
        } catch (error) {
            // Action failed
        } finally {
            setIsSubmitting(false)
        }
    }

    // --- Calendar Helpers ---
    const NSW_HOLIDAYS_2026: any = {
        '2026-01-01': "New Year's Day",
        '2026-01-26': "Australia Day",
        '2026-04-03': "Good Friday",
        '2026-04-04': "Easter Saturday",
        '2026-04-05': "Easter Sunday",
        '2026-04-06': "Easter Monday",
        '2026-04-25': "Anzac Day",
        '2026-06-08': "King's Birthday",
        '2026-10-05': "Labour Day",
        '2026-12-25': "Christmas Day",
        '2026-12-26': "Boxing Day",
        '2026-12-28': "Boxing Day Holiday"
    }

    const calendarDays = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth))
        const end = endOfWeek(endOfMonth(currentMonth))
        return eachDayOfInterval({ start, end })
    }, [currentMonth])

    const getEventsForDay = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd')

        // Leaves
        const leaves = approvedLeaves.filter(leave =>
            isWithinInterval(date, {
                start: parseISO(leave.startDate),
                end: parseISO(leave.endDate)
            })
        ).map(l => ({ type: 'leave', data: l }))

        // Attendance (Present)
        const attendance = monthlyAttendance.filter((a: any) => {
            const attDate = a.date ? a.date.split('T')[0] : (a.clockIn ? a.clockIn.split('T')[0] : null)
            return attDate === dateStr
        }).map(a => ({ type: 'present', data: a }))

        const events: any[] = [...leaves, ...attendance]

        // Holidays
        if (NSW_HOLIDAYS_2026[dateStr]) {
            events.unshift({ type: 'holiday', name: NSW_HOLIDAYS_2026[dateStr], data: null })
        }

        return events
    }

    const getDayStatus = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd')
        const isHoliday = NSW_HOLIDAYS_2026[dateStr]
        const isWeekend = ['Sat', 'Sun'].includes(format(date, 'EEE'))

        return myTeam.map(member => {
            // Find approved leave
            const leave = approvedLeaves.find(l =>
                l.userId === member.id &&
                isWithinInterval(date, {
                    start: parseISO(l.startDate),
                    end: parseISO(l.endDate)
                })
            )

            // Find attendance
            const attendance = monthlyAttendance.find(a => {
                const attDate = a.date ? a.date.split('T')[0] : (a.clockIn ? a.clockIn.split('T')[0] : null)
                return a.userId === member.id && attDate === dateStr
            })

            let status = 'absent'
            if (leave) status = 'leave'
            else if (attendance) status = 'present'
            else if (isHoliday) status = 'holiday'
            else if (isWeekend) status = 'weekend'

            return { ...member, status, leave, attendance }
        })
    }

    // --- Team Status Helpers ---
    const sortedTeam = useMemo(() => {
        return [...myTeam].map(member => {
            // Find attendance record
            const record = todaysAttendance.find((a: any) => a.userId === member.id)
            // Determine status
            // Check if they are on APPROVED leave today
            const onLeaveToday = approvedLeaves.find(l =>
                l.userId === member.id &&
                isWithinInterval(new Date(), { start: parseISO(l.startDate), end: parseISO(l.endDate) })
            )

            let status = 'absent'
            if (record?.status === 'clocked-in') status = 'present'
            else if (record?.status === 'on-break') status = 'break'
            else if (onLeaveToday) status = 'leave'
            else if (record?.clockOut) status = 'offline'

            return { ...member, status, record }
        }).sort((a, b) => {
            const order: any = { present: 0, break: 1, leave: 2, offline: 3, absent: 4 }
            return order[a.status] - order[b.status]
        })
    }, [myTeam, todaysAttendance, approvedLeaves])


    // Filter Pending Requests
    const filteredRequests = pendingRequests.filter(r =>
        r.userName.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (status === "loading" || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading Manager Dashboard...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto p-2">

            {/* Page Header is handled inside Tabs mainly, but we can put a global title */}

            <Tabs defaultValue="requests" className="w-full space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Manager Control</h1>
                        <p className="text-muted-foreground mt-1">Review requests and monitor team availability</p>
                    </div>
                    <TabsList className="h-12 bg-white border border-border p-1 w-full md:w-auto shadow-sm gap-1 rounded-xl">
                        <TabsTrigger value="requests" className="h-10 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm font-medium transition-all">
                            Pending Requests
                            {pendingRequests.length > 0 && (
                                <span className="ml-2 bg-white/20 text-current px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                                    {pendingRequests.length}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="h-10 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm font-medium transition-all">
                            Team Calendar
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* --- REQUESTS TAB --- */}
                <TabsContent value="requests" className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-border shadow-sm">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-yellow-600" />
                            <h2 className="font-semibold text-foreground">Pending Approvals</h2>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search requests..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-muted/30 border-border"
                            />
                        </div>
                    </div>

                    <div className="grid gap-4">
                        {filteredRequests.length === 0 ? (
                            <Card className="border-dashed shadow-none bg-muted/30">
                                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                        <Check className="w-8 h-8 text-green-500" />
                                    </div>
                                    <h3 className="text-lg font-semibold">All Caught Up!</h3>
                                    <p className="text-muted-foreground">No pending leave requests at this time.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            filteredRequests.map(request => (
                                <Card key={request.id} className="group hover:shadow-md transition-all border-border bg-white overflow-hidden">
                                    <div className="flex flex-col lg:flex-row">
                                        {/* Status Strip */}
                                        <div className="lg:w-1 bg-yellow-500/50" />

                                        <CardContent className="flex-1 p-6">
                                            <div className="flex flex-col lg:flex-row gap-6 items-start">
                                                <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                                    <AvatarFallback className="bg-slate-900 text-white font-bold">{request.userName.charAt(0)}</AvatarFallback>
                                                </Avatar>

                                                <div className="flex-1 space-y-4">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                        <div>
                                                            <h3 className="font-bold text-lg text-foreground">{request.userName}</h3>
                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{request.department || 'Team Member'}</p>
                                                        </div>
                                                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200">
                                                            Needs Review
                                                        </Badge>
                                                    </div>

                                                    <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                        <div className="bg-muted/30 p-3 rounded-lg">
                                                            <p className="text-xs text-muted-foreground mb-1">Leave Type</p>
                                                            <p className="font-semibold capitalize">{request.type.toLowerCase().replace('_', ' ')}</p>
                                                        </div>
                                                        <div className="bg-muted/30 p-3 rounded-lg">
                                                            <p className="text-xs text-muted-foreground mb-1">Duration/Time</p>
                                                            <p className="font-semibold">
                                                                {request.kind === 'ATTENDANCE' && request.time
                                                                    ? format(new Date(request.time), 'hh:mm a')
                                                                    : request.duration}
                                                            </p>
                                                        </div>
                                                        <div className="bg-muted/30 p-3 rounded-lg col-span-2">
                                                            <p className="text-xs text-muted-foreground mb-1">Date Range</p>
                                                            <div className="flex items-center gap-2 font-medium">
                                                                <CalendarIcon className="w-4 h-4 text-primary" />
                                                                {format(parseISO(request.startDate), 'MMM dd, yyyy')}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                                                        <p className="text-sm italic text-slate-600">"{request.reason}"</p>
                                                    </div>
                                                </div>

                                                <div className="flex lg:flex-col gap-2 pt-2 lg:pt-0">
                                                    <Button
                                                        onClick={() => handleAction(request, "approve")}
                                                        className="bg-green-600 hover:bg-green-700 text-white shadow-sm w-full sm:w-auto"
                                                    >
                                                        <Check className="w-4 h-4 mr-2" /> Approve
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleAction(request, "deny")}
                                                        variant="ghost"
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full sm:w-auto"
                                                    >
                                                        <X className="w-4 h-4 mr-2" /> Deny
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>

                {/* --- CALENDAR TAB --- */}
                <TabsContent value="calendar" className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

                        {/* Main Calendar View */}
                        <Card className="xl:col-span-3 border border-border shadow-sm bg-white overflow-hidden rounded-2xl">
                            <CardHeader className="border-b border-border bg-muted/10 p-4 flex flex-row items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <h2 className="text-xl font-bold text-foreground">
                                        {format(currentMonth, 'MMMM yyyy')}
                                    </h2>
                                    <div className="flex items-center gap-1 bg-white border border-border rounded-lg p-1 shadow-sm">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                                            className="h-7 w-7"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                                            className="h-7 w-7"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-blue-100 border border-blue-300"></div> Leave
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-red-100 border border-red-300"></div> Holiday
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="grid grid-cols-7 border-b border-border bg-slate-50">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                        <div key={day} className="py-2 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                            {day}
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 auto-rows-fr">
                                    {calendarDays.map((day, i) => {
                                        const events = getEventsForDay(day)
                                        const isCurrentMonth = isSameMonth(day, currentMonth)
                                        const isTodayDate = isToday(day)

                                        return (
                                            <div
                                                key={day.toISOString()}
                                                onClick={() => setSelectedDayDetail(day)}
                                                className={cn(
                                                    "min-h-[120px] p-2 border-b border-r border-border transition-all hover:bg-muted/50 cursor-pointer active:scale-[0.98] relative",
                                                    !isSameMonth(day, currentMonth) && "opacity-40 bg-muted/5",
                                                    isToday(day) && "bg-blue-50/20"
                                                )}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className={cn(
                                                        "text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full transition-colors",
                                                        isToday(day) ? "bg-primary text-white shadow-sm" : "text-muted-foreground group-hover:text-foreground"
                                                    )}>
                                                        {format(day, 'd')}
                                                    </span>
                                                    {isToday(day) && (
                                                        <Badge variant="outline" className="text-[9px] px-1 h-4 bg-primary/10 text-primary border-primary/20 font-bold uppercase tracking-wider">Today</Badge>
                                                    )}
                                                </div>

                                                <div className="space-y-1 overflow-hidden">
                                                    {/* Prioritize Holiday */}
                                                    {NSW_HOLIDAYS_2026[format(day, 'yyyy-MM-dd')] && (
                                                        <div className="text-[10px] bg-red-50 text-red-600 px-1.5 py-1 rounded border border-red-100 truncate font-bold flex items-center gap-1">
                                                            <div className="w-1 h-1 rounded-full bg-red-600" />
                                                            {NSW_HOLIDAYS_2026[format(day, 'yyyy-MM-dd')]}
                                                        </div>
                                                    )}

                                                    {/* Show up to 2 personnel events */}
                                                    {events.filter(e => e.type !== 'holiday').slice(0, 2).map((event: any, idx: number) => (
                                                        <div
                                                            key={idx}
                                                            className={cn(
                                                                "text-[10px] px-1.5 py-1 rounded border truncate font-medium flex items-center gap-1",
                                                                event.type === 'leave' ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                            )}
                                                        >
                                                            <div className={cn("w-1 h-1 rounded-full", event.type === 'leave' ? "bg-blue-600" : "bg-emerald-600")} />
                                                            {event.data.userName.split(' ')[0]}
                                                            {event.type === 'leave' && <span className="opacity-60 text-[8px]">({event.data.type === 'ANNUAL' ? 'AL' : 'SL'})</span>}
                                                        </div>
                                                    ))}

                                                    {/* +N More logic */}
                                                    {events.filter(e => e.type !== 'holiday').length > 2 && (
                                                        <div className="text-[10px] font-bold text-muted-foreground flex items-center justify-center py-1 bg-muted/30 rounded-md border border-dashed border-border mt-1">
                                                            +{events.filter(e => e.type !== 'holiday').length - 2} Staff
                                                        </div>
                                                    )}

                                                    {['Sat', 'Sun'].includes(format(day, 'EEE')) && events.length === 0 && (
                                                        <div className="text-[10px] text-center text-muted-foreground/50 font-medium py-1">
                                                            Weekend
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Side Panel: Team Status Today */}
                        <div className="space-y-6">
                            <Card className="border border-border shadow-sm bg-white overflow-hidden h-full rounded-2xl flex flex-col">
                                <CardHeader className="border-b border-border bg-muted/10 p-5">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-5 h-5 text-primary" />
                                        <div>
                                            <CardTitle className="text-base font-bold">Team Status</CardTitle>
                                            <CardDescription className="text-xs">
                                                {format(new Date(), 'EEEE, MMMM do')}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    {/* Stats */}
                                    <div className="flex items-center gap-2 mt-4 text-xs font-medium">
                                        <div className="bg-green-100 text-green-700 px-2 py-1 rounded-md border border-green-200">
                                            {sortedTeam.filter(m => m.status === 'present').length} Present
                                        </div>
                                        <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md border border-blue-200">
                                            {sortedTeam.filter(m => m.status === 'leave').length} Leave
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px]">
                                    <div className="divide-y divide-border">
                                        {sortedTeam.length === 0 ? (
                                            <div className="p-8 text-center text-muted-foreground text-sm">
                                                No team members found.
                                            </div>
                                        ) : (
                                            sortedTeam.map(member => (
                                                <div key={member.id} className="p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                                                    <div className="relative">
                                                        <Avatar className="h-9 w-9 border border-border">
                                                            <AvatarFallback className="text-xs">{member.name.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className={cn(
                                                            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white",
                                                            member.status === 'present' ? "bg-green-500" :
                                                                member.status === 'break' ? "bg-yellow-500" :
                                                                    member.status === 'leave' ? "bg-blue-500" :
                                                                        "bg-slate-300"
                                                        )} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold truncate">{member.name}</p>
                                                        <p className="text-[10px] text-muted-foreground truncate">{member.email}</p>
                                                    </div>
                                                    <Badge variant="outline" className={cn(
                                                        "text-[9px] px-1.5 h-5 capitalize border-0 font-bold",
                                                        member.status === 'present' ? "bg-green-100 text-green-700" :
                                                            member.status === 'break' ? "bg-yellow-100 text-yellow-700" :
                                                                member.status === 'leave' ? "bg-blue-100 text-blue-700" :
                                                                    "bg-slate-100 text-slate-500"
                                                    )}>
                                                        {member.status}
                                                    </Badge>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Action Dialog (Keep existing) */}
            <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{actionType === "approve" ? "Approve Request" : "Deny Request"}</DialogTitle>
                        <DialogDescription>
                            {actionType === "approve"
                                ? `Confirm approval for ${selectedRequest?.userName}'s leave request`
                                : "Please provide a reason for the denial."}
                        </DialogDescription>
                    </DialogHeader>
                    {actionType === "deny" && (
                        <div className="py-4">
                            <Label htmlFor="reason" className="text-xs font-bold mb-2 block">Reason</Label>
                            <Textarea
                                id="reason"
                                value={denyReason}
                                onChange={e => setDenyReason(e.target.value)}
                                placeholder="E.g. Insufficient leave balance..."
                                className={cn(denyReasonError && "border-red-500")}
                            />
                            {denyReasonError && <p className="text-xs text-red-500 mt-1">Required</p>}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedRequest(null)}>Cancel</Button>
                        <Button
                            onClick={confirmAction}
                            disabled={isSubmitting}
                            className={cn(actionType === "approve" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white")}
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Day Details Dialog */}
            <Dialog open={!!selectedDayDetail} onOpenChange={() => setSelectedDayDetail(null)}>
                <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="bg-[oklch(0.32_0.08_25)] text-white p-6 relative overflow-hidden">
                        {/* Decorative Background Element */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl" />

                        <div className="flex items-center justify-between relative z-10">
                            <div className="space-y-1">
                                <DialogTitle className="text-xl font-bold flex items-center gap-2 tracking-tight uppercase">
                                    <CalendarDays className="w-5 h-5 text-amber-500" />
                                    {selectedDayDetail && format(selectedDayDetail, 'EEEE, MMMM do')}
                                </DialogTitle>
                                <DialogDescription className="text-slate-300/80 text-[10px] font-bold uppercase tracking-widest">
                                    Team Deployment Roster
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-50/50">
                        {selectedDayDetail && getDayStatus(selectedDayDetail).map((member) => (
                            <div key={member.id} className="bg-white border border-slate-200 p-3.5 rounded-xl flex items-center justify-between hover:border-[var(--primary)]/30 transition-all group shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Avatar className="h-10 w-10 border-2 border-slate-100 shadow-sm group-hover:border-[var(--primary)]/20 transition-all">
                                            <AvatarFallback className="bg-slate-900 text-white font-black text-xs">{member.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className={cn(
                                            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm",
                                            member.status === 'present' ? "bg-emerald-500" :
                                                member.status === 'leave' ? "bg-blue-500" :
                                                    member.status === 'holiday' ? "bg-red-500" :
                                                        "bg-slate-300"
                                        )} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-900 tracking-tight">{member.name}</span>
                                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">{member.email}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Badge className={cn(
                                        "text-[9px] font-bold px-2.5 py-1 rounded-md border shadow-sm transition-all uppercase tracking-tighter",
                                        member.status === 'present' ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" :
                                            member.status === 'leave' ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" :
                                                member.status === 'holiday' ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" :
                                                    "bg-slate-50 text-slate-500 border-slate-200"
                                    )}>
                                        {member.status === 'present' ? 'Present' :
                                            member.status === 'leave' ? 'On Leave' :
                                                member.status === 'holiday' ? 'Holiday' : 'Absent'}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
                        <Button
                            variant="outline"
                            onClick={() => setSelectedDayDetail(null)}
                            className="font-bold text-xs uppercase tracking-widest border-2 border-slate-900 hover:bg-slate-900 hover:text-white transition-all rounded-lg px-8 h-9"
                        >
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
