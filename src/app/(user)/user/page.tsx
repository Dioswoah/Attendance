"use client"

import { useState, useEffect } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Clock, Loader2, LogOut, MapPin, CheckCircle2, LayoutDashboard, CalendarDays, FileText, Check, X, Bell, CalendarOff, Search, LogIn, Coffee, Timer, Calendar, TrendingUp, ArrowUpDown } from "lucide-react"
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

    // 1. Initial Data Fetch & Socket Setup
    useEffect(() => {
        setMounted(true)
        setCurrentTime(new Date())

        if (session?.user?.id) {
            setUserId(session.user.id)
            fetchUserDetails()
            fetchAttendance()
            fetchMyLeaveRequests()
        }

        const socket = io({
            path: '/api/socket/io',
        })

        socket.on("update-data", () => {
            if (session?.user?.id) {
                fetchAttendance()
                fetchMyLeaveRequests()
                if (userRoles.includes('MANAGER') || userRoles.includes('ADMIN')) {
                    const me = employees.find((u: any) => u.email === session.user?.email)
                    if (me) fetchPendingLeaves(me.id)
                }
            }
        })

        return () => {
            socket.disconnect()
        }
    }, [session]) // Only re-run if session changes

    // 2. Timer Logic (Updates UI every second based on current data)
    useEffect(() => {
        const calculateTimes = () => {
            const now = new Date()
            setCurrentTime(now)

            // Calculate total for TODAY across all records
            const todayRecords = userAttendanceList.filter((record: any) => {
                const recordDate = new Date(record.clockIn)
                return recordDate.toDateString() === now.toDateString()
            })

            let totalWorkedMs = 0
            let totalBreakMs = 0

            todayRecords.forEach((record: any) => {
                const start = new Date(record.clockIn)
                const end = record.clockOut ? new Date(record.clockOut) : now

                let breakDuration = 0
                if (record.breakStart) {
                    const bStart = new Date(record.breakStart)
                    const bEnd = record.breakEnd ? new Date(record.breakEnd) : now
                    breakDuration = bEnd.getTime() - bStart.getTime()
                }

                const sessionDuration = end.getTime() - start.getTime()
                const workedDuration = sessionDuration - breakDuration

                totalWorkedMs += workedDuration
                totalBreakMs += breakDuration
            })

            setWorkedTime(formatDuration(totalWorkedMs))
            setBreakTime(formatDuration(totalBreakMs))
        }

        calculateTimes()
        const timeInterval = setInterval(calculateTimes, 1000)

        return () => clearInterval(timeInterval)
    }, [userAttendanceList])

    const formatDuration = (ms: number) => {
        if (ms < 0) ms = 0
        const seconds = Math.floor((ms / 1000) % 60)
        const minutes = Math.floor((ms / (1000 * 60)) % 60)
        const hours = Math.floor((ms / (1000 * 60 * 60)))
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
            console.error("Failed to fetch user details")
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
            console.error("Failed to fetch pending leaves")
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
            console.error("Failed to fetch my leave requests")
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
            console.error("Fetch attendance error:", error)
        }
    }

    const handleClockInClick = () => {
        setShowLocationDialog(true)
    }

    const confirmClockIn = async (mode: string) => {
        if (!session?.user?.id) return
        setIsProcessing(true)

        try {
            const res = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: session.user.id, mode })
            })
            if (res.ok) {
                setShowLocationDialog(false)
                fetchAttendance()
            } else {
                const data = await res.json()
                alert(data.error || "Clock in failed")
                fetchAttendance() // Sync state just in case we are desynced
            }
        } catch (error) {
            console.error("Clock in failed:", error)
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
            console.error(`${action} failed:`, error)
        } finally {
            setIsProcessing(false)
        }
    }

    const requestLeave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!userId) return

        const start = new Date(leaveStartDate)
        const end = new Date(leaveEndDate)
        const diffTime = Math.abs(end.getTime() - start.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        const duration = `${diffDays} Day${diffDays > 1 ? 's' : ''}`

        console.log('[Leave Request] Submitting leave request...', { userId, leaveStartDate, leaveEndDate, leaveType, leaveReason });

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
                    startTime: leaveDurationType !== 'Full Day' ? new Date(`${leaveStartDate}T${leaveStartTime}:00`).toISOString() : null,
                    endTime: leaveDurationType !== 'Full Day' ? new Date(`${leaveStartDate}T${leaveEndTime}:00`).toISOString() : null
                })
            })
            console.log('[Leave Request] Response status:', res.status);
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
            console.error("[Leave Request] Failed to request leave:", error)
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
            console.error("Failed to update leave status")
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
            <div className="min-h-screen w-full flex items-center justify-center bg-muted/20 p-4">
                <Card className="w-full max-w-md border border-border shadow-lg rounded-xl overflow-hidden bg-white">
                    <CardHeader className="flex flex-col items-center justify-center p-12 text-center space-y-6 pb-6 border-b border-border">
                        <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-105">
                            <Clock className="h-8 w-8 text-primary-foreground" />
                        </div>
                        <div className="space-y-1.5">
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">Redadair</h1>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Attendance System</p>
                        </div>
                    </CardHeader>
                    <CardContent className="p-12 text-center space-y-8">
                        <p className="text-muted-foreground font-medium text-sm leading-relaxed max-w-[280px] mx-auto">
                            Authorized personnel only. Please sign in with your corporate Google account.
                        </p>

                        <Button
                            onClick={() => signIn("google")}
                            className="w-full h-12 bg-foreground hover:bg-foreground/90 text-background text-sm font-semibold rounded-lg shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Secure Sign In
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const hour = currentTime ? currentTime.getHours() : 0
    const greeting = !mounted ? "Loading..." : hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening"
    const formattedDate = currentTime ? currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : "..."
    const formattedTime = currentTime ? currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "--:--:--"

    const displayName = session.user?.name?.split(' ')[0] || "User"
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
                lastActive: attendanceRecord ? attendanceRecord.clockIn : null
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
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())


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
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        {greeting}, {displayName}
                    </h1>
                    <p className="text-base text-muted-foreground mt-1">
                        {currentTime ? currentTime.toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        }) : "Loading..."}
                    </p>
                </div>
                <Badge variant="outline" className={`${getStatusColor()} px-4 py-1.5 text-sm font-medium border`}>
                    {getStatusText()}
                </Badge>
            </div>
            {/* Debug Info */}
            <p className="text-xs text-muted-foreground font-mono">Debug ID: {userId} | Status: {status}</p>

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
                                    {currentTime ? currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}
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
                                    onClick={clockIn}
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
                                        onClick={clockOut}
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
                                        onClick={clockOut}
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
                {/* Staff Status Today (2/3 width) */}
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
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search staff..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10 h-10 border-border bg-white font-medium text-sm rounded-lg focus:ring-primary"
                                        />
                                    </div>
                                    <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                                        <SelectTrigger className="w-full md:w-[180px] h-10 border-border font-medium text-sm rounded-lg">
                                            <SelectValue placeholder="Department" />
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
                                        <SelectTrigger className="w-full md:w-[180px] h-10 border-border font-medium text-sm rounded-lg">
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
                                        <SelectTrigger className="w-full md:w-[140px] h-10 border-border font-medium text-sm rounded-lg">
                                            <ArrowUpDown className="w-3.5 h-3.5 mr-2" />
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
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[500px] overflow-y-auto p-4 space-y-3">
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
                                                    <div className="text-right hidden sm:block">
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Clock In</p>
                                                        <p className="text-xs font-bold text-slate-700 font-mono">
                                                            {formatTime(new Date(staff.clockIn))}
                                                        </p>
                                                    </div>
                                                )}
                                                {getStaffStatusBadge(staff.status)}
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

            {/* Hidden Dialogs needed for logic to work */}
            <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Location Check</DialogTitle>
                        <DialogDescription>Verifying your location...</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                    <form onSubmit={handleLeaveSubmit} className="p-8 space-y-6 bg-white">
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
        </div>
    )
}
