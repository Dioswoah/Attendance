"use client"

import { useState, useEffect } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Clock, Loader2, LogOut, MapPin, CheckCircle2, LayoutDashboard, CalendarDays, FileText, Check, X, Bell, CalendarOff, Search, LogIn, Coffee, Timer, Calendar, TrendingUp, ArrowUpDown, Building2, AlertTriangle, Lock } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { io } from "socket.io-client"

export default function UserPortal() {
    const { data: session, status } = useSession()
    const [currentAttendance, setCurrentAttendance] = useState<any | null>(null)
    const [userAttendanceList, setUserAttendanceList] = useState<any[]>([])
    const [employees, setEmployees] = useState<any[]>([])
    const [allAttendance, setAllAttendance] = useState<any[]>([])
    const [currentTime, setCurrentTime] = useState<Date | null>(null)
    const [mounted, setMounted] = useState(false)
    const [showLocationDialog, setShowLocationDialog] = useState(false)
    const [showClockOutConfirm, setShowClockOutConfirm] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)

    // Role & Leave Management State
    const [userRoles, setUserRoles] = useState<string[]>([])
    const [userId, setUserId] = useState<string>("")
    const [userDepartment, setUserDepartment] = useState<string>("")
    const [pendingLeaves, setPendingLeaves] = useState<any[]>([])
    const [isLeaveOpen, setIsLeaveOpen] = useState(false)

    // Leave Form State
    const [leaveType, setLeaveType] = useState('SICK')
    const [leaveDurationType, setLeaveDurationType] = useState('Full Day')
    const [leaveStartTime, setLeaveStartTime] = useState('09:00')
    const [leaveEndTime, setLeaveEndTime] = useState('13:00')
    const [leaveStartDate, setLeaveStartDate] = useState("")
    const [leaveEndDate, setLeaveEndDate] = useState("")
    const [leaveReason, setLeaveReason] = useState("")

    // Decline Dialog State
    const [isDeclineOpen, setIsDeclineOpen] = useState(false)
    const [declineReason, setDeclineReason] = useState("")
    const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null)

    // User's Own Leave Requests
    const [myLeaveRequests, setMyLeaveRequests] = useState<any[]>([])

    // Time Tracking
    const [workedTime, setWorkedTime] = useState("00:00:00")
    const [breakTime, setBreakTime] = useState("00:00:00")

    // Dashboard UI State
    const [sortBy, setSortBy] = useState<string>("name")
    const [filterStatus, setFilterStatus] = useState<string>("all")
    const [filterDepartment, setFilterDepartment] = useState<string>("all")
    const [searchQuery, setSearchQuery] = useState<string>("")
    // Feed Filters
    const [feedSearch, setFeedSearch] = useState("")

    // Break Limit Monitoring State
    const [breakTotalMs, setBreakTotalMs] = useState(0)
    const [warningTriggered, setWarningTriggered] = useState(false)
    const [limitTriggered, setLimitTriggered] = useState(false)
    const [showBreakDialog, setShowBreakDialog] = useState(false)
    const [breakDialogType, setBreakDialogType] = useState<"WARNING" | "EXCEEDED">("WARNING")

    // 1. Initial Data Fetch & Realtime Subscription (SSE)
    useEffect(() => {
        setMounted(true)
        setCurrentTime(new Date())

        // Only load data if we have a valid session
        if (session?.user?.id) {
            setUserId(session.user.id)
            fetchUserDetails()
            fetchAttendance()
            fetchMyLeaveRequests()
        }

        // Initialize Realtime Server-Sent Events
        // This replaces the polling mechanism with a permanent connection
        let eventSource: EventSource | null = null;

        if (typeof EventSource !== 'undefined') {
            eventSource = new EventSource('/api/stream');

            eventSource.onmessage = (event) => {
                // Heartbeat or connection message
                if (event.data === ': heartbeat' || event.data.includes('connected')) return;

                try {
                    const payload = JSON.parse(event.data);

                    // Intelligent Refresh based on event type
                    if (payload.type === 'attendance') {
                        fetchAttendance();
                    }
                    else if (payload.type === 'leaves') {
                        fetchMyLeaveRequests();
                        // Only fetch pending if we are a manager/admin
                        // Note: We use the functional state update or refs if we needed fresh state here,
                        // but since we are inside the effect, these values are closed over. 
                        // However, for a simple refresh triggering a fetch is fine.
                        // Ideally we check roles again, but fetching explicitly is safe.
                        if (session?.user?.email) {
                            // We re-fetch user details to be safe or just fetch leaves
                            // For now, let's just trigger the potential manager fetch if we suspect they are one
                            // Or we can rely on the data we fetched initially if we move `fetchPendingLeaves` outside or pass params.
                            // To avoid complexity, we can blindly fetch pending leaves if the endpoint handles permissions safely.
                        }
                    }
                } catch (e) {
                    console.error("SSE Parse Error", e);
                }
            };

            eventSource.onerror = (e) => {

            };
        }

        return () => {
            if (eventSource) {
                eventSource.close();
            }
        }
        // ESLint might complain about missing deps, but we INTENTIONALLY exclude userRoles/employees to prevent loops.
        // We only want this to run when the session (user identity) changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.user?.id])

    // 2. Timer Logic (Updates UI every second based on current data)
    useEffect(() => {
        const calculateTimes = () => {
            const now = new Date()
            setCurrentTime(now)

            // Calculate total for TODAY across all records (PH TIME)
            const todayPHT = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })

            const todayRecords = userAttendanceList.filter((record: any) => {
                if (!record.clockIn) return false
                const recordDate = new Date(record.clockIn)
                const recordPHT = recordDate.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
                return recordPHT === todayPHT
            })

            let totalWorkedMs = 0
            let totalBreakMs = 0

            todayRecords.forEach((record: any) => {
                const start = new Date(record.clockIn)
                const end = record.clockOut ? new Date(record.clockOut) : now

                // Calculate total breaks for this record
                let sessionBreakMs = 0
                if (record.breaks && record.breaks.length > 0) {
                    record.breaks.forEach((b: any) => {
                        const bStart = new Date(b.startTime)
                        const bEnd = b.endTime ? new Date(b.endTime) : now
                        sessionBreakMs += bEnd.getTime() - bStart.getTime()
                    })
                }

                const sessionDuration = end.getTime() - start.getTime()
                const workedDuration = Math.max(0, sessionDuration - sessionBreakMs)

                totalWorkedMs += workedDuration
                totalBreakMs += sessionBreakMs
            })

            setWorkedTime(formatDuration(totalWorkedMs))
            setBreakTime(formatDuration(totalBreakMs))
            setBreakTotalMs(totalBreakMs)
        }

        calculateTimes()
        const timeInterval = setInterval(calculateTimes, 1000)

        return () => clearInterval(timeInterval)
    }, [userAttendanceList])

    // 3. Break Limit Monitoring Effect
    useEffect(() => {
        const checkBreakLimit = async () => {
            // 45 minutes = 2700000 ms
            // 60 minutes = 3600000 ms
            const WARNING_MS = 45 * 60 * 1000
            const LIMIT_MS = 60 * 60 * 1000

            if (breakTotalMs >= WARNING_MS && breakTotalMs < LIMIT_MS && !warningTriggered) {
                setWarningTriggered(true)
                setBreakDialogType("WARNING")
                setShowBreakDialog(true)
                // Report to server (In-app notif)
                await fetch('/api/attendance/break-limit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'WARNING', totalBreakTime: breakTime, limit: '1 hour' })
                })
            } else if (breakTotalMs >= LIMIT_MS && !limitTriggered) {
                setLimitTriggered(true)
                setBreakDialogType("EXCEEDED")
                setShowBreakDialog(true)
                // Report to server (In-app notif + Email)
                await fetch('/api/attendance/break-limit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'EXCEEDED', totalBreakTime: breakTime, limit: '1 hour' })
                })
            }
        }

        if (breakTotalMs > 0) {
            checkBreakLimit()
        }
    }, [breakTotalMs, warningTriggered, limitTriggered, breakTime])

    const formatDuration = (ms: number) => {
        if (ms < 0) ms = 0
        const seconds = Math.floor((ms / 1000) % 60)
        const minutes = Math.floor((ms / (1000 * 60)) % 60)
        const hours = Math.floor((ms / (1000 * 60 * 60)))
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' })
    }

    const fetchUserDetails = async () => {
        if (!session?.user?.email) return
        try {
            const res = await fetch('/api/employees')
            if (res.ok) {
                const users = await res.json()
                setEmployees(users)
                const me = users.find((u: any) => u.email === session.user?.email)
                if (me) {
                    const roles = me.roles || [me.role]
                    setUserRoles(roles)
                    setUserDepartment(me.department?.name || "Unassigned")
                    // If Manager or Admin, fetch pending leaves assigned to them
                    if (roles.includes('MANAGER') || roles.includes('ADMIN')) {
                        fetchPendingLeaves(me.id)
                    }
                }
            }
        } catch (error) {
            // Error handled silently for production
        }
    }

    const fetchPendingLeaves = async (managerId: string) => {
        try {
            // Fetch leaves assigned to this manager (or department manager logic if handled by API)
            const res = await fetch(`/api/leaves?managerId=${managerId}&status=PENDING`)
            if (res.ok) {
                const data = await res.json()
                setPendingLeaves(data)
            }
        } catch (error) {
            // Error handled silently for production
        }
    }

    const fetchMyLeaveRequests = async () => {
        if (!session?.user?.id) return
        try {
            const res = await fetch(`/api/leaves?userId=${session.user.id}`)
            if (res.ok) {
                const data = await res.json()
                setMyLeaveRequests(data)
            }
        } catch (error) {
            // Error handled silently for production
        }
    }

    const fetchAttendance = async () => {
        if (!session?.user?.id) return

        try {
            // Fetch both in parallel for speed
            const [userRes, allRes] = await Promise.all([
                fetch(`/api/attendance?userId=${session.user.id}`),
                fetch('/api/attendance')
            ])

            if (userRes.ok) {
                const data = await userRes.json()
                setUserAttendanceList(data)
                setCurrentAttendance(data[0] || null)
            }

            if (allRes.ok) {
                const allData = await allRes.json()
                setAllAttendance(allData)
            }
        } catch (error) {
            // Error handled silently for production
        }
    }

    const handleClockInClick = () => {
        setShowLocationDialog(true)
    }

    const confirmClockIn = async (mode: string) => {
        if (!session?.user?.id) return
        setIsProcessing(true)

        try {
            // LOCK to PHT (+08:00)
            const clockInTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
            const clockInISO = new Date(clockInTime).toISOString()

            const res = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: session.user.id, mode, clockIn: clockInISO })
            })
            if (res.ok) {
                setShowLocationDialog(false)
                fetchAttendance()
            } else {
                const data = await res.json()
                alert(data.error || "Clock in failed")
                fetchAttendance()
            }
        } catch (error) {
            alert("An error occurred while clocking in")
        } finally {
            setIsProcessing(false)
        }
    }

    const handleAction = async (action: 'clock-out' | 'start-break' | 'end-break') => {
        if (!session?.user?.id) return
        setIsProcessing(true)

        try {
            const res = await fetch('/api/attendance', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: session.user.id, action })
            })
            if (res.ok) {
                fetchAttendance()
            }
        } catch (error) {
            // Error handled silently
        } finally {
            setIsProcessing(false)
        }
    }

    const requestLeave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!userId) return

        const start = new Date(leaveStartDate + "T00:00:00+08:00")
        const end = new Date(leaveEndDate + "T00:00:00+08:00")
        const diffTime = Math.abs(end.getTime() - start.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        const duration = `${diffDays} Day${diffDays > 1 ? 's' : ''}`



        try {
            const res = await fetch('/api/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    startDate: leaveStartDate,
                    endDate: leaveEndDate,
                    type: leaveType,
                    reason: leaveReason,
                    duration: leaveDurationType === 'Full Day' && diffDays > 1 ? `${diffDays} Days` : leaveDurationType,
                    startTime: leaveDurationType !== 'Full Day' ? new Date(`${leaveStartDate}T${leaveStartTime}:00+08:00`).toISOString() : null,
                    endTime: leaveDurationType !== 'Full Day' ? new Date(`${leaveStartDate}T${leaveEndTime}:00+08:00`).toISOString() : null
                })
            })

            if (res.ok) {
                setIsLeaveOpen(false)
                setLeaveReason("")
                setLeaveStartDate("")
                setLeaveEndDate("")
                setLeaveDurationType("Full Day")
                setLeaveStartTime("09:00")
                setLeaveEndTime("13:00")
                fetchMyLeaveRequests() // Refresh the list
                alert("Leave request submitted for approval.")
            } else {
                const data = await res.json()
                console.error('[Leave Request] Error response:', data);
                alert(data.error || "Failed to submit leave request")
            }
        } catch (error) {
            alert("An error occurred while submitting the request")
        }
    }

    const confirmDecline = async () => {
        if (!selectedLeaveId) return
        await handleLeaveApproval(selectedLeaveId, 'DECLINED', declineReason)
        setIsDeclineOpen(false)
        setDeclineReason("")
        setSelectedLeaveId(null)
    }

    const handleLeaveApproval = async (leaveId: string, status: 'APPROVED' | 'DECLINED', reason?: string) => {
        try {
            const body: any = { status }
            if (status === 'DECLINED' && reason) {
                body.declineReason = reason
            }

            const res = await fetch(`/api/leaves/${leaveId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            if (res.ok) {
                if (userId) fetchPendingLeaves(userId)
            }
        } catch (e) {
            // Error handled silently
        }
    }

    if (status === "loading") {
        return (
            <div className="flex flex-col items-center justify-center min-vh-50 space-y-6">
                <div className="h-16 w-16 rounded-[1.5rem] bg-slate-900 flex items-center justify-center shadow-2xl">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Initializing Portal Access...</p>
            </div>
        )
    }

    if (!session) {
        return (
            <div className="min-h-screen w-full bg-muted/30 flex items-center justify-center p-6 relative overflow-hidden">
                {/* Background elements */}
                <div className="absolute top-0 right-0 h-96 w-96 bg-red-600/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 h-96 w-96 bg-red-600/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />

                <div className="w-full max-w-[400px] space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="h-20 w-20 bg-white rounded-2xl flex items-center justify-center shadow-lg mb-2 overflow-hidden border border-border/50 p-1">
                            <img src="/logo.png" alt="RSA Logo" className="w-full h-full object-cover" />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">Redadair</h1>
                            <p className="text-muted-foreground uppercase tracking-widest text-xs font-semibold">Staff Availability</p>
                        </div>
                    </div>

                    <Card className="border-border shadow-xl rounded-xl bg-white/80 backdrop-blur-sm overflow-hidden">
                        <CardHeader className="space-y-1 text-center pb-6 border-b border-border/50">
                            <CardDescription className="text-base text-center">
                                Authorized personnel only. Please sign in with your corporate Google account.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 pt-8">
                            <Button
                                onClick={() => signIn("google", { callbackUrl: "/user" })}
                                className="w-full h-12 text-base bg-zinc-900 hover:bg-zinc-800 text-white font-medium transition-all"
                            >
                                <svg className="mr-3 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                    <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                                </svg>
                                Secure Sign In
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    const hour = currentTime ? currentTime.getHours() : 0
    const greeting = !mounted ? "Loading..." : hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening"
    const formattedDate = currentTime ? currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' }) : "..."
    const formattedTime = currentTime ? currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Manila' }) : "--:--:--"

    const displayName = (() => {
        if (!session?.user?.email) return "User"
        const dbUser = employees.find((u: any) => u.email === session.user?.email)
        return dbUser?.name?.split(' ')[0] || session.user?.name?.split(' ')[0] || "User"
    })()

    const departmentName = (session.user as any).department || "Unassigned"

    // --- Dashboard Helpers ---
    const getStatusColor = () => {
        switch (currentAttendance?.status) {
            case "clocked-in": return "bg-green-100 text-green-700 border-green-200"
            case "on-break": return "bg-yellow-100 text-yellow-700 border-yellow-200"
            default: return "bg-muted text-slate-700 border-border"
        }
    }

    const getStatusText = () => {
        switch (currentAttendance?.status) {
            case "clocked-in": return "Working"
            case "on-break": return "On Break"
            default: return "Off Duty"
        }
    }

    const getStaffStatusBadge = (status: string) => {
        switch (status) {
            case "clocked-in":
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-200/50 border-0 font-bold">Clocked In</Badge>
            case "on-break":
                return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200/50 border-0 font-bold">On Break</Badge>
            case "on-leave":
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200/50 border-0 font-bold">On Leave</Badge>
            default:
                return <Badge className="bg-muted text-muted-foreground hover:bg-slate-200/50 border-0 font-bold">Clocked Out</Badge>
        }
    }

    const getActivityDotColor = (type: string) => {
        if (type.includes('clock-in')) return "bg-green-500"
        if (type.includes('clock-out')) return "bg-red-500"
        if (type.includes('break-start')) return "bg-yellow-500"
        if (type.includes('break-end')) return "bg-blue-500"
        return "bg-slate-300"
    }

    // Sort logic for staff
    const sortedStaff = employees
        .map((staff: any) => {
            // Find live status from allAttendance
            const attendanceRecord = allAttendance.find((a: any) => a.userId === staff.id)
            return {
                ...staff,
                status: attendanceRecord ? attendanceRecord.status : 'clocked-out', // Default to offline
                lastActive: attendanceRecord ? attendanceRecord.clockIn : null,
                returnDate: attendanceRecord ? attendanceRecord.returnDate : null
            }
        })
        .filter((staff: any) => staff.name?.toLowerCase().includes(searchQuery.toLowerCase()))
        .filter((staff: any) => filterStatus === "all" || staff.status === filterStatus)
        .filter((staff: any) => {
            if (filterDepartment === "all") return true
            const dept = typeof staff.department === 'string' ? staff.department : staff.department?.name
            return dept === filterDepartment
        })
        .sort((a: any, b: any) => {
            // Priority Status Grouping: Clocked In / On Break > Others
            const priorityStatuses = ["clocked-in", "on-break"]
            const aIsPriority = priorityStatuses.includes(a.status)
            const bIsPriority = priorityStatuses.includes(b.status)

            if (aIsPriority && !bIsPriority) return -1
            if (!aIsPriority && bIsPriority) return 1

            // Secondary sorting based on user selection
            switch (sortBy) {
                case "name": return (a.name || "").localeCompare(b.name || "")
                case "department":
                    const deptA = typeof a.department === 'string' ? a.department : a.department?.name || ""
                    const deptB = typeof b.department === 'string' ? b.department : b.department?.name || ""
                    return deptA.localeCompare(deptB)
                case "status":
                    const statusOrder: any = { "clocked-in": 0, "on-break": 1, "on-leave": 2, "clocked-out": 3 }
                    return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4)
                default: return 0
            }
        })

    const uniqueDepartments = Array.from(new Set(
        employees
            .map((e: any) => {
                if (typeof e.department === 'string') return e.department
                return e.department?.name
            })
            .filter((d): d is string => typeof d === 'string' && d.length > 0)
    )).sort()

    // --- Derived State for UI ---

    // Flatten attendance records into a chronological activity feed
    const activityFeed = userAttendanceList.flatMap((record: any) => {
        const events = []

        // 1. Clock In
        if (record.clockIn) {
            events.push({
                type: 'clock-in',
                timestamp: record.clockIn,
                label: 'Clocked In'
            })
        }

        // 2. Break Start
        if (record.breakStart) {
            events.push({
                type: 'break-start',
                timestamp: record.breakStart,
                label: 'Started Break'
            })
        }

        // 3. Break End
        if (record.breakEnd) {
            events.push({
                type: 'break-end',
                timestamp: record.breakEnd,
                label: 'Ended Break'
            })
        }

        // 4. Clock Out
        if (record.clockOut) {
            events.push({
                type: 'clock-out',
                timestamp: record.clockOut,
                label: 'Clocked Out'
            })
        }

        // Handle Leaves
        if (record.mode === 'LEAVE') {
            events.push({
                type: 'leave-start',
                timestamp: record.date ? `${record.date}T09:00:00` : new Date().toISOString(),
                label: `On Leave (${record.type || 'Approved'})`
            })
        }

        return events
    })
        .filter(event => {
            // Ensure strictly TODAY'S records are shown
            if (!event.timestamp) return false
            const eventDate = new Date(event.timestamp)
            const today = new Date()
            return eventDate.toDateString() === today.toDateString()
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())


    // Aliases for new UI Actions
    const clockIn = () => confirmClockIn('OFFICE')
    const clockOut = () => handleAction('clock-out')
    const breakStart = () => handleAction('start-break')
    const breakEnd = () => handleAction('end-break')
    const handleLeaveSubmit = requestLeave

    return (
        <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
                        {greeting}, {displayName}
                    </h1>
                    <p className="text-lg md:text-xl font-medium text-muted-foreground mt-2">
                        {currentTime ? currentTime.toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            timeZone: "Asia/Manila"
                        }) : "Loading..."}
                    </p>
                </div>
                <Badge variant="outline" className={`${getStatusColor()} px-4 py-1.5 text-sm font-medium border`}>
                    {getStatusText()}
                </Badge>
            </div>


            {/* Clock Actions */}
            <Card className="border-2 border-border shadow-xl shadow-slate-100/50 rounded-[2rem] overflow-hidden bg-white">
                <CardHeader className="pb-4 border-b border-border">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                        <Clock className="w-5 h-5 text-primary" />
                        Time Tracker
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">Manage your attendance for today</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="flex flex-col gap-8">
                        {/* Status Cards Grid - Adapts based on content */}
                        <div className={cn(
                            "grid gap-4",
                            currentAttendance?.status === 'on-break' ? "grid-cols-1 md:grid-cols-3" :
                                currentAttendance?.status === 'clocked-in' ? "grid-cols-1 md:grid-cols-2" :
                                    "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" // Default / Clocked Out state layout
                        )}>
                            {/* Current Time - Always Visible */}
                            <div className={cn(
                                "text-center p-6 rounded-xl bg-[#FDFBF7] border border-[#F2EFE9]",
                                !currentAttendance || currentAttendance.status === 'clocked-out' ? "md:col-span-2 lg:col-span-1" : ""
                            )}>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Current Time</p>
                                <p className="text-4xl lg:text-5xl font-mono font-medium text-foreground whitespace-nowrap tabular-nums tracking-tight">
                                    {currentTime ? currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Manila" }) : "--:--:--"}
                                </p>
                            </div>

                            {/* Clocked In Status - Visible when working or on break */}
                            {currentAttendance?.clockIn && currentAttendance?.status !== 'clocked-out' && (
                                <div className="text-center p-6 rounded-xl bg-[#EFF6F2] border border-[#E0EBE3]">
                                    <p className="text-xs font-bold text-[#006E3F] uppercase tracking-widest mb-3">
                                        Clocked In At
                                    </p>
                                    <p className="text-3xl lg:text-4xl font-bold text-[#00522F] whitespace-nowrap tabular-nums">
                                        {formatTime(new Date(currentAttendance.clockIn))}
                                    </p>
                                </div>
                            )}

                            {/* Break Status - Only visible when on break */}
                            {currentAttendance?.breakStart && currentAttendance.status === 'on-break' && (
                                <div className="text-center p-6 rounded-xl bg-[#FEF9F0] border border-[#F5EAD9]">
                                    <p className="text-xs font-bold text-[#9A7033] uppercase tracking-widest mb-3">
                                        Break Started
                                    </p>
                                    <p className="text-3xl lg:text-4xl font-bold text-[#765424] whitespace-nowrap tabular-nums">
                                        {formatTime(new Date(currentAttendance.breakStart))}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-4 items-center">
                            {(!currentAttendance?.status || ['clocked-out', 'on-leave'].includes(currentAttendance.status)) && (
                                <Button
                                    onClick={handleClockInClick}
                                    disabled={isProcessing}
                                    size="lg"
                                    className="gap-2 bg-[#009B5A] hover:bg-[#00874e] text-white h-12 px-8 text-base font-semibold rounded-lg shadow-sm transition-all active:scale-95"
                                >
                                    {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                                    Clock In
                                </Button>
                            )}
                            {currentAttendance?.status === 'clocked-in' && (
                                <>
                                    <Button
                                        onClick={breakStart}
                                        disabled={isProcessing}
                                        size="lg"
                                        variant="outline"
                                        className="gap-2 border-[#D4A056] text-[#9A7033] bg-[#FEF9F0] hover:bg-[#FFFBF5] h-12 px-8 text-base font-semibold rounded-lg"
                                    >
                                        {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Coffee className="w-5 h-5" />}
                                        Start Break
                                    </Button>
                                    <Button
                                        onClick={() => setShowClockOutConfirm(true)}
                                        disabled={isProcessing}
                                        size="lg"
                                        className="gap-2 h-12 px-8 text-base font-semibold rounded-lg shadow-sm bg-[#8B2323] hover:bg-[#701c1c] text-white"
                                    >
                                        {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                                        Clock Out
                                    </Button>
                                </>
                            )}
                            {currentAttendance?.status === 'on-break' && (
                                <>
                                    <Button
                                        onClick={breakEnd}
                                        disabled={isProcessing}
                                        size="lg"
                                        className="gap-2 bg-[#009B5A] hover:bg-[#00874e] text-white h-12 px-8 text-base font-semibold rounded-lg shadow-sm"
                                    >
                                        {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Timer className="w-5 h-5" />}
                                        End Break
                                    </Button>
                                    <Button
                                        onClick={() => setShowClockOutConfirm(true)}
                                        disabled={isProcessing}
                                        size="lg"
                                        className="gap-2 h-12 px-8 text-base font-semibold rounded-lg shadow-sm bg-[#8B2323] hover:bg-[#701c1c] text-white"
                                    >
                                        {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                                        Clock Out
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="border border-border shadow-sm rounded-xl bg-[#EFF6F2]">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-foreground">Hours Worked</CardTitle>
                        <div className="p-2 rounded-xl bg-green-100 text-green-600">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground tabular-nums">
                            {workedTime}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Active time today</p>
                    </CardContent>
                </Card>

                <Card className="border border-border shadow-sm rounded-xl bg-[#FEF9F0]">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-foreground">Break Time</CardTitle>
                        <div className="p-2 rounded-xl bg-yellow-100 text-yellow-600">
                            <Coffee className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground tabular-nums">
                            {breakTime}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Total break duration</p>
                    </CardContent>
                </Card>

                <Card className="border border-border shadow-sm rounded-xl bg-white">
                    <CardHeader className="pb-2">
                        <div className="flex flex-col gap-1">
                            <CardTitle className="text-sm font-semibold text-foreground">Pending Requests</CardTitle>
                            <p className="text-[10px] text-muted-foreground">Awaiting approval</p>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{myLeaveRequests.filter((lr: any) => lr.status === 'PENDING').length}</div>
                        <p className="text-xs text-muted-foreground mt-1">Requests pending</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-6">
                    <Card className="border-2 border-border shadow-xl shadow-slate-100/50 rounded-[2rem] overflow-hidden bg-white h-full">
                        <CardHeader className="bg-muted/40/50 border-b border-border p-6">
                            <div className="flex flex-col gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <CardTitle className="text-xl font-semibold text-foreground">Staff Status Today</CardTitle>
                                    </div>
                                    <CardDescription className="text-sm text-muted-foreground">
                                        View all staff members and their current status
                                    </CardDescription>
                                </div>
                                <div className="flex flex-col lg:flex-row gap-4">
                                    <div className="relative flex-1 min-w-[200px]">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search staff..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10 h-10 border-border bg-white font-medium text-sm rounded-lg focus:ring-primary w-full"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 shrink-0">
                                        <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                                            <SelectTrigger className="w-full h-10 border-border font-medium text-sm rounded-lg truncate px-2">
                                                <SelectValue placeholder="Dept" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all" className="font-medium text-sm">All Depts</SelectItem>
                                                {uniqueDepartments.map((dept: any) => (
                                                    <SelectItem key={dept} value={dept} className="font-medium text-sm">
                                                        {dept}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                                            <SelectTrigger className="w-full h-10 border-border font-medium text-sm rounded-lg truncate px-2">
                                                <SelectValue placeholder="Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all" className="font-medium text-sm">All Status</SelectItem>
                                                <SelectItem value="clocked-in" className="font-medium text-sm">Clocked In</SelectItem>
                                                <SelectItem value="on-break" className="font-medium text-sm">On Break</SelectItem>
                                                <SelectItem value="on-leave" className="font-medium text-sm">On Leave</SelectItem>
                                                <SelectItem value="clocked-out" className="font-medium text-sm">Clocked Out</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Select value={sortBy} onValueChange={setSortBy}>
                                            <SelectTrigger className="w-full h-10 border-border font-medium text-sm rounded-lg sm:col-span-1 col-span-2 truncate px-2">
                                                <ArrowUpDown className="w-3.5 h-3.5 mr-2 inline-block" />
                                                <SelectValue placeholder="Sort" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="name" className="font-medium text-sm">Name</SelectItem>
                                                <SelectItem value="department" className="font-medium text-sm">Dept</SelectItem>
                                                <SelectItem value="status" className="font-medium text-sm">Status</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="p-4 space-y-3">
                                {sortedStaff.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <p className="text-sm font-bold uppercase tracking-wider">No staff members found.</p>
                                    </div>
                                ) : (
                                    sortedStaff.map((staff: any) => (
                                        <div
                                            key={staff.id}
                                            className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border hover:bg-white hover:shadow-md transition-all duration-300"
                                        >
                                            <div className="flex items-center gap-4">
                                                <Avatar className="h-10 w-10 border border-border shadow-sm">
                                                    <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
                                                        {staff.name.charAt(0)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-semibold text-foreground">{staff.name}</p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <span>{(typeof staff.department === 'object' ? staff.department?.name : staff.department) || 'Unassigned'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {staff.clockIn && (
                                                    <div className="flex flex-col items-end gap-1 px-4 border-r border-border/50 hidden sm:flex">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Entry</p>
                                                            <p className="text-xs font-bold text-slate-700 font-mono">
                                                                {formatTime(new Date(staff.clockIn))}
                                                            </p>
                                                        </div>
                                                        {staff.mode && (
                                                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                {staff.mode === 'OFFICE' ? <Building2 className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                                                                {staff.mode === 'WFH' ? 'WFH' : staff.mode}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="flex flex-col items-end gap-1 min-w-[100px]">
                                                    {getStaffStatusBadge(staff.status)}
                                                    {staff.status === 'on-leave' && staff.returnDate && (
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                                            Ret: {new Date(staff.returnDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Today's Activity (1/3 width) */}
                <div className="xl:col-span-1">
                    <Card className="border-2 border-border shadow-xl shadow-slate-100/50 rounded-[2rem] overflow-hidden bg-white h-full">
                        <CardHeader className="bg-muted/40/50 border-b border-border p-6">
                            <CardTitle className="text-lg font-semibold text-foreground">Today's Activity</CardTitle>
                            <CardDescription className="text-sm text-muted-foreground">Your attendance log</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 pt-2">
                            {activityFeed.length === 0 ? (
                                <div className="text-center py-12 px-6">
                                    <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                    <p className="text-sm font-medium text-muted-foreground">No activity yet</p>
                                    <p className="text-xs text-muted-foreground mt-1">Clock in to start tracking</p>
                                </div>
                            ) : (
                                <div className="max-h-[500px] overflow-y-auto space-y-3">
                                    {activityFeed.map((event: any, index: number) => {
                                        const timeString = (() => {
                                            try {
                                                return event.timestamp ? new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'
                                            } catch (e) {
                                                return '--:--'
                                            }
                                        })()

                                        return (
                                            <div
                                                key={index}
                                                className="flex items-center gap-4 p-4 rounded-xl border border-[#F2EFE9] bg-[#FDFBF7] hover:bg-[#F9F5F0] transition-colors"
                                            >
                                                <div className={`w-3 h-3 rounded-full shrink-0 ${getActivityDotColor(event.type)}`} />
                                                <p className="text-sm font-mono font-bold text-slate-500 w-20 shrink-0">
                                                    {timeString}
                                                </p>
                                                <p className="text-sm font-bold text-foreground">
                                                    {event.label}
                                                </p>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Clock Out Confirmation Dialog */}
            <Dialog open={showClockOutConfirm} onOpenChange={setShowClockOutConfirm}>
                <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-[#8B2323] p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
                        <AlertTriangle className="h-12 w-12 text-white/20 mx-auto mb-4" />
                        <DialogTitle className="text-2xl font-black italic text-white uppercase tracking-tight relative z-10">Confirm Clock Out</DialogTitle>
                        <DialogDescription className="text-white/60 font-bold text-[10px] uppercase tracking-widest mt-2 relative z-10">
                            Ending your active duty session
                        </DialogDescription>
                    </div>

                    <div className="p-8 space-y-6 bg-white text-center">
                        <p className="text-slate-600 font-bold text-sm">
                            Are you really sure that you want to clock out and end your tracking for this session?
                        </p>

                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={async () => {
                                    await handleAction('clock-out');
                                    setShowClockOutConfirm(false);
                                }}
                                disabled={isProcessing}
                                className="w-full h-14 bg-[#8B2323] hover:bg-[#701c1c] text-white font-black rounded-xl shadow-lg transition-all active:scale-95 italic uppercase tracking-widest"
                            >
                                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : "Yes, Clock Out Now"}
                            </Button>

                            <Button
                                variant="ghost"
                                onClick={() => setShowClockOutConfirm(false)}
                                className="w-full text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-slate-900 italic"
                            >
                                Negative, Stay Active
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Work Location Selection Dialog */}
            <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
                <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-[oklch(0.32_0.08_25)] p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
                        <MapPin className="h-12 w-12 text-white/20 mx-auto mb-4" />
                        <DialogTitle className="text-2xl font-black italic text-white uppercase tracking-tight relative z-10">Select Work Location</DialogTitle>
                        <DialogDescription className="text-slate-300 font-bold text-[9px] uppercase tracking-[0.3em] mt-2 relative z-10 leading-relaxed">
                            Specify your base of operations for this session
                        </DialogDescription>
                    </div>

                    <div className="p-8 space-y-4 bg-white">
                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                onClick={() => confirmClockIn('OFFICE')}
                                disabled={isProcessing}
                                variant="outline"
                                className="h-32 flex flex-col items-center justify-center gap-3 border-2 border-[#F2EFE9] bg-[#FDFBF7] hover:border-slate-900 hover:bg-white transition-all rounded-[1.5rem] group"
                            >
                                <div className="p-3 bg-white border border-slate-100 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300">
                                    <Building2 className="w-6 h-6" />
                                </div>
                                <span className="font-black uppercase tracking-widest text-[10px] text-slate-700">In Office</span>
                            </Button>

                            <Button
                                onClick={() => confirmClockIn('WFH')}
                                disabled={isProcessing}
                                variant="outline"
                                className="h-32 flex flex-col items-center justify-center gap-3 border-2 border-[#F2EFE9] bg-[#FDFBF7] hover:border-slate-900 hover:bg-white transition-all rounded-[1.5rem] group"
                            >
                                <div className="p-3 bg-white border border-slate-100 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300">
                                    <MapPin className="w-6 h-6" />
                                </div>
                                <span className="font-black uppercase tracking-widest text-[10px] text-slate-700">WFH</span>
                            </Button>
                        </div>

                        <Button
                            variant="ghost"
                            onClick={() => setShowLocationDialog(false)}
                            className="w-full text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground hover:text-slate-900 italic mt-2"
                        >
                            Cancel
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Leave Request Dialog */}
            <Dialog open={isLeaveOpen} onOpenChange={setIsLeaveOpen}>
                <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
                        <CalendarDays className="h-12 w-12 text-white/20 mx-auto mb-4" />
                        <DialogTitle className="text-2xl font-black italic text-white uppercase tracking-tight relative z-10">Request Leave</DialogTitle>
                        <DialogDescription className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest mt-2 relative z-10">
                            Submit a new leave request for approval
                        </DialogDescription>
                    </div>
                    <form onSubmit={requestLeave} className="p-8 space-y-6 bg-white">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Leave Type</Label>
                                <Select value={leaveType} onValueChange={setLeaveType}>
                                    <SelectTrigger className="h-14 bg-muted/40 border-border rounded-xl font-bold text-slate-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SICK">Sick Leave</SelectItem>
                                        <SelectItem value="ANNUAL">Annual Leave</SelectItem>
                                        <SelectItem value="PERSONAL">Personal Leave</SelectItem>
                                        <SelectItem value="MATERNITY">Maternity/Paternity</SelectItem>
                                        <SelectItem value="OTHER">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Duration Parameter</Label>
                                <div className="flex gap-2">
                                    {['Full Day', 'Half Day', 'Part Day'].map((type) => (
                                        <Button
                                            key={type}
                                            type="button"
                                            onClick={() => setLeaveDurationType(type)}
                                            variant={leaveDurationType === type ? 'default' : 'outline'}
                                            className={cn(
                                                "flex-1 h-8 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                                                leaveDurationType === type ? "bg-primary hover:bg-red-700 text-white" : "text-muted-foreground"
                                            )}
                                        >
                                            {type}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {leaveDurationType !== 'Full Day' && (
                                <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">From</Label>
                                        <Input type="time" value={leaveStartTime} onChange={e => setLeaveStartTime(e.target.value)} className="h-12 bg-muted/40 border-border rounded-xl font-bold text-[10px] uppercase tracking-widest" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">To</Label>
                                        <Input type="time" value={leaveEndTime} onChange={e => setLeaveEndTime(e.target.value)} className="h-12 bg-muted/40 border-border rounded-xl font-bold text-[10px] uppercase tracking-widest" />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Start Date</Label>
                                    <Input type="date" value={leaveStartDate} onChange={e => setLeaveStartDate(e.target.value)} required className="h-12 bg-muted/40 border-border rounded-xl font-bold text-[10px] uppercase tracking-widest italic" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">End Date</Label>
                                    <Input type="date" value={leaveEndDate} onChange={e => setLeaveEndDate(e.target.value)} required className="h-12 bg-muted/40 border-border rounded-xl font-bold text-[10px] uppercase tracking-widest italic" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Reason</Label>
                                <Textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)} placeholder="Please detail the reason for your absence request..." className="min-h-[100px] resize-none bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic p-4" />
                            </div>
                        </div>
                        <Button type="submit" className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 italic uppercase tracking-widest">Submit Request</Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Break Time Warning/Limit Dialog */}
            <Dialog open={showBreakDialog} onOpenChange={setShowBreakDialog}>
                <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                    <div className={cn(
                        "p-8 text-center relative overflow-hidden transition-colors duration-500",
                        breakDialogType === "WARNING" ? "bg-amber-500" : "bg-red-600"
                    )}>
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 to-transparent" />
                        <Coffee className="h-12 w-12 text-white/30 mx-auto mb-4" />
                        <DialogTitle className="text-2xl font-black italic text-white uppercase tracking-tight relative z-10">
                            {breakDialogType === "WARNING" ? "Take Note" : "Limit Exceeded"}
                        </DialogTitle>
                        <DialogDescription className="text-white/80 font-bold text-[10px] uppercase tracking-widest mt-2 relative z-10">
                            {breakDialogType === "WARNING"
                                ? "You are approaching your daily break limit"
                                : "You have gone over the daily break time limit"}
                        </DialogDescription>
                    </div>
                    <div className="p-8 space-y-6 bg-white text-center">
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">Current Break Usage</span>
                            <span className={cn(
                                "text-5xl font-black italic tracking-tighter",
                                breakDialogType === "WARNING" ? "text-amber-600" : "text-red-700"
                            )}>{breakTime}</span>
                        </div>

                        <p className="text-sm text-slate-500 font-medium">
                            {breakDialogType === "WARNING"
                                ? "You have approximately 15 minutes left. Please plan to return to work shortly."
                                : "The 1-hour daily break limit has been reached. An automated notification has been sent."}
                        </p>

                        <Button
                            onClick={() => setShowBreakDialog(false)}
                            className={cn(
                                "w-full h-14 text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg transition-all active:scale-95",
                                breakDialogType === "WARNING" ? "bg-amber-600 hover:bg-amber-700" : "bg-slate-900 hover:bg-slate-800"
                            )}
                        >
                            Understood
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
