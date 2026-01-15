"use client"

import { useState, useEffect } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Clock, Loader2, LogOut, MapPin, CheckCircle2, LayoutDashboard, CalendarDays, FileText, Check, X, Bell, CalendarOff } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { format } from "date-fns"

export default function UserPortal() {
    const { data: session, status } = useSession()
    const [currentAttendance, setCurrentAttendance] = useState<any | null>(null)
    const [allAttendance, setAllAttendance] = useState<any[]>([])
    const [currentTime, setCurrentTime] = useState(new Date())
    const [showLocationDialog, setShowLocationDialog] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)

    // Role & Leave Management State
    const [userRole, setUserRole] = useState<string>("")
    const [userId, setUserId] = useState<string>("")
    const [userDepartment, setUserDepartment] = useState<string>("")
    const [pendingLeaves, setPendingLeaves] = useState<any[]>([])
    const [isLeaveOpen, setIsLeaveOpen] = useState(false)

    // Leave Form State
    const [leaveType, setLeaveType] = useState("SICK")
    const [leaveStartDate, setLeaveStartDate] = useState("")
    const [leaveEndDate, setLeaveEndDate] = useState("")
    const [leaveReason, setLeaveReason] = useState("")

    useEffect(() => {
        const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000)

        if (session?.user?.id) {
            setUserId(session.user.id)
            fetchAttendance()

            const sessUser = session.user as any
            if (sessUser.role) {
                setUserRole(sessUser.role)
                setUserDepartment(sessUser.department || "Unassigned")
                if (sessUser.role === 'MANAGER') {
                    fetchPendingLeaves(session.user.id)
                }
            } else {
                fetchUserDetails()
            }
        }

        const refreshInterval = setInterval(() => {
            if (session?.user?.id) fetchAttendance()
        }, 10000)

        return () => {
            clearInterval(timeInterval)
            clearInterval(refreshInterval)
        }
    }, [session])

    const fetchUserDetails = async () => {
        if (!session?.user?.email) return
        try {
            const res = await fetch('/api/employees')
            if (res.ok) {
                const users = await res.json()
                const me = users.find((u: any) => u.email === session.user?.email)
                if (me) {
                    setUserRole(me.role)
                    setUserDepartment(me.department?.name || "Unassigned")
                    // If Manager, fetch pending leaves assigned to them
                    if (me.role === 'MANAGER') {
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

    const fetchAttendance = async () => {
        if (!session?.user?.id) return

        try {
            const res = await fetch(`/api/attendance?userId=${session.user.id}`)
            if (res.ok) {
                const data = await res.json()
                setCurrentAttendance(data[0] || null)
            }

            const liveRes = await fetch('/api/attendance')
            if (liveRes.ok) {
                setAllAttendance(await liveRes.json())
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
            }
        } catch (error) {
            console.error("Clock in failed:", error)
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
                    duration
                })
            })
            if (res.ok) {
                setIsLeaveOpen(false)
                setLeaveReason("")
                setLeaveStartDate("")
                setLeaveEndDate("")
                alert("Leave request submitted for approval.")
            }
        } catch (error) {
            console.error("Failed to request leave")
        }
    }

    const handleLeaveApproval = async (leaveId: string, status: 'APPROVED' | 'DENIED') => {
        try {
            const res = await fetch(`/api/leaves/${leaveId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            })
            if (res.ok) {
                // Refresh pending leaves by passing the current user ID (manager's ID)
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
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Initializing Portal Access...</p>
            </div>
        )
    }

    if (!session) {
        return (
            <div className="max-w-md w-full animate-in fade-in zoom-in duration-700">
                <Card className="border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[2.5rem] overflow-hidden bg-white/80 backdrop-blur-xl">
                    <CardHeader className="bg-slate-50/50 p-10 border-b border-slate-100 text-center space-y-4">
                        <div className="mx-auto h-20 w-20 bg-red-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-red-100">
                            <Clock className="h-10 w-10 text-white" />
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">Redadair</h1>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Time & Attendance System</p>
                        </div>
                    </CardHeader>
                    <CardContent className="p-12 text-center space-y-8">
                        <p className="text-slate-500 font-bold text-sm tracking-wide leading-relaxed px-4">
                            Authorized personnel only. Please sign in with your company Google account to manage your attendance.
                        </p>
                        <Button
                            onClick={() => signIn("google")}
                            className="w-full h-16 bg-slate-900 hover:bg-black text-white text-lg font-black rounded-2xl shadow-xl shadow-slate-200 transition-all active:scale-95 flex gap-4 italic uppercase tracking-widest"
                        >
                            <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Secure Sign In
                        </Button>
                        <div className="pt-4 flex justify-center">
                            <Link href="/admin-login">
                                <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-red-600 transition-colors">Administrator Access</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const hour = currentTime.getHours()
    const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening"
    const formattedDate = currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    const displayName = session.user?.name?.split(' ')[0] || "User"
    const departmentName = (session.user as any).department || "Unassigned"

    return (
        <div className={`grid gap-8 w-full ${userRole === 'MANAGER' ? 'grid-cols-1 xl:grid-cols-3 max-w-[95vw]' : 'grid-cols-1 lg:grid-cols-2 max-w-6xl'}`}>

            {/* 1. Profile & Clock Card */}
            <div className="space-y-6 flex flex-col items-center h-full">
                <Card className="w-full h-full shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border-none rounded-[3rem] overflow-hidden bg-white/80 backdrop-blur-md flex flex-col">
                    <CardContent className="p-10 flex flex-col items-center space-y-10 flex-grow justify-center">
                        {/* Header Section */}
                        <div className="flex flex-col items-center space-y-5 text-center w-full">
                            <div className="relative group">
                                <div className="h-24 w-24 rounded-full border-4 border-slate-50 overflow-hidden shadow-2xl transition-transform group-hover:scale-105 duration-500">
                                    {session.user?.image ? (
                                        <img src={session.user.image} alt="Profile" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="h-full w-full bg-slate-900 flex items-center justify-center text-white text-3xl font-black italic">
                                            {session.user?.name?.charAt(0) || "U"}
                                        </div>
                                    )}
                                </div>
                                <div className={`absolute -bottom-1 -right-1 h-8 w-8 border-4 border-white rounded-full ${currentAttendance && currentAttendance.status !== 'clocked-out' && currentAttendance.status !== 'on-leave' ? 'bg-green-500 shadow-lg shadow-green-100' : 'bg-slate-300'}`} />
                            </div>
                            <div className="space-y-1.5">
                                <h2 className="text-3xl font-black italic text-slate-900 tracking-tight leading-none uppercase">
                                    {greeting}, {displayName}
                                </h2>
                                <p className="text-red-600 font-extrabold uppercase tracking-[0.25em] text-[10px]">
                                    DEPARTMENT: {departmentName}
                                </p>
                            </div>
                        </div>

                        {/* Clock Display */}
                        <div className="w-full bg-slate-50 py-8 px-8 rounded-[2.5rem] border border-slate-100 flex flex-col items-center space-y-2 group hover:bg-slate-100/50 hover:border-slate-200 transition-all duration-500">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">{formattedDate}</p>
                            <p className="text-5xl font-black text-slate-800 tracking-tighter tabular-nums italic">{formattedTime}</p>
                            <div className="mt-4">
                                <Badge variant="outline" className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-none ${currentAttendance?.status === 'clocked-in' ? "bg-green-100 text-green-700" :
                                    currentAttendance?.status === 'on-break' ? "bg-orange-100 text-orange-700" :
                                        currentAttendance?.status === 'on-leave' ? "bg-blue-100 text-blue-700" :
                                            "bg-white text-slate-400"
                                    }`}>
                                    {currentAttendance?.status === 'clocked-in' ? 'Clocked In' :
                                        currentAttendance?.status === 'on-break' ? 'On Break' :
                                            currentAttendance?.status === 'on-leave' ? 'On Leave' :
                                                'Ready for Shift'}
                                </Badge>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="w-full pt-2">
                            {currentAttendance?.status === 'on-leave' ? (
                                <div className="w-full bg-blue-50 py-6 rounded-2xl border-2 border-blue-100 flex flex-col items-center justify-center text-center space-y-2 animate-in zoom-in-95 duration-500">
                                    <CalendarOff className="h-8 w-8 text-blue-500 mb-2" />
                                    <span className="text-lg font-black text-blue-700 uppercase italic">On Leave</span>
                                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Enjoy your time off</span>
                                </div>
                            ) : !currentAttendance || currentAttendance.status === 'clocked-out' ? (
                                <div className="flex gap-4">
                                    <Button
                                        onClick={handleClockInClick}
                                        disabled={isProcessing}
                                        className="flex-[2] h-20 bg-red-600 hover:bg-red-700 text-white text-xl font-black rounded-[1.8rem] shadow-2xl shadow-red-100 transition-all active:scale-95 group italic uppercase tracking-widest"
                                    >
                                        <Clock className="mr-3 h-6 w-6 group-hover:rotate-12 transition-transform" />
                                        {isProcessing ? "..." : "Clock In"}
                                    </Button>
                                    <Button
                                        onClick={() => setIsLeaveOpen(true)}
                                        className="flex-1 h-20 bg-white border-2 border-slate-50 hover:border-red-600 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-[1.8rem] shadow-sm transition-all active:scale-95 flex flex-col items-center justify-center gap-1 group"
                                    >
                                        <CalendarDays className="h-6 w-6 group-hover:scale-110 transition-transform" />
                                        <span className="text-[8px] font-black uppercase tracking-widest">Leave</span>
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-5 w-full">
                                    <div className="flex gap-4 w-full">
                                        <Button
                                            onClick={() => handleAction(currentAttendance.status === 'on-break' ? 'end-break' : 'start-break')}
                                            variant="outline"
                                            disabled={isProcessing}
                                            className={`flex-1 h-18 rounded-2xl border-2 font-black text-sm uppercase tracking-widest italic transition-all ${currentAttendance.status === 'on-break'
                                                ? 'border-yellow-500 text-yellow-700 bg-yellow-50 shadow-lg shadow-yellow-100'
                                                : 'border-slate-50 bg-slate-50 text-slate-600 hover:bg-red-50 hover:border-red-100 hover:text-red-600'
                                                }`}
                                        >
                                            {currentAttendance.status === 'on-break' ? 'Resume' : 'Start Break'}
                                        </Button>
                                        <Button
                                            onClick={() => handleAction('clock-out')}
                                            disabled={isProcessing || currentAttendance.status === 'on-break'}
                                            className="flex-[1.5] h-18 bg-red-500 hover:bg-red-600 text-white font-black text-sm uppercase tracking-widest italic rounded-2xl shadow-xl shadow-red-100 transition-all active:scale-95 px-8"
                                        >
                                            Clock Out
                                        </Button>
                                    </div>
                                    <div className="flex items-center justify-center gap-2.5">
                                        <MapPin className="h-3 w-3 text-red-600" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stationed at:</span>
                                        <span className="text-[10px] font-black text-slate-800 uppercase italic">{currentAttendance.mode}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer / Account */}
                        <div className="flex items-center gap-6 pt-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => signOut()}
                                className="text-slate-300 hover:text-red-500 font-black text-[10px] uppercase tracking-widest gap-2 rounded-xl transition-colors"
                            >
                                <LogOut className="h-3.5 w-3.5" /> Sign Out
                            </Button>

                            {userRole === 'ADMIN' && (
                                <>
                                    <div className="h-4 w-[1px] bg-slate-100" />
                                    <Link href="/admin">
                                        <Button variant="ghost" className="h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-300 hover:text-red-600 transition-colors gap-2">
                                            <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
                                        </Button>
                                    </Link>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 2. Manager Controls (Conditional) */}
            {userRole === 'MANAGER' && (
                <div className="space-y-6 h-full flex flex-col animate-in slide-in-from-bottom-8 duration-1000 delay-200">
                    <div className="flex flex-col items-center text-center space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                            <h2 className="text-xl font-black text-slate-900 tracking-tight italic uppercase">Manager Controls</h2>
                        </div>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.4em]">Pending Requests</p>
                    </div>

                    <Card className="flex-grow shadow-2xl border-none rounded-[3rem] overflow-hidden bg-white/50 backdrop-blur-sm flex flex-col">
                        <div className="flex-grow overflow-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50 sticky top-0 z-10">
                                    <TableRow className="hover:bg-transparent border-slate-100">
                                        <TableHead className="py-4 px-6 font-black text-slate-400 uppercase text-[9px] tracking-widest">Details</TableHead>
                                        <TableHead className="py-4 px-6 font-black text-slate-400 uppercase text-[9px] tracking-widest text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pendingLeaves.length > 0 ? pendingLeaves.map(leave => (
                                        <TableRow key={leave.id} className="border-slate-50 hover:bg-white/80 transition-all duration-300">
                                            <TableCell className="py-6 px-6">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">
                                                            {leave.userImage ? <img src={leave.userImage} className="w-full h-full rounded-full object-cover" /> : leave.userName.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-slate-800 italic uppercase text-xs">{leave.userName}</span>
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{leave.type} • {leave.duration}</span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                        <p className="text-[10px] font-bold text-slate-600 italic leading-snug">"{leave.reason}"</p>
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-2">{format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd')}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-6 px-6 text-right align-top">
                                                <div className="flex flex-col gap-2">
                                                    <Button size="sm" className="h-8 w-full rounded-lg bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-colors text-[9px] font-black uppercase tracking-widest" onClick={() => handleLeaveApproval(leave.id, 'APPROVED')}>
                                                        Approve
                                                    </Button>
                                                    <Button size="sm" className="h-8 w-full rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors text-[9px] font-black uppercase tracking-widest" onClick={() => handleLeaveApproval(leave.id, 'DENIED')}>
                                                        Deny
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="py-12 text-center">
                                                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic">No pending requests</p>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            )}

            {/* 3. Workforce Feed Details */}
            <div className="space-y-6 h-full flex flex-col animate-in slide-in-from-bottom-8 duration-1000 delay-300">
                <div className="flex flex-col items-center text-center space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                        <h2 className="text-xl font-black text-slate-900 tracking-tight italic uppercase">Workforce Feed</h2>
                    </div>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.4em]">Live Verification</p>
                </div>

                <Card className="flex-grow shadow-2xl border-none rounded-[3rem] overflow-hidden bg-white/50 backdrop-blur-sm flex flex-col">
                    <div className="flex-grow overflow-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50 sticky top-0 z-10">
                                <TableRow className="hover:bg-transparent border-slate-100">
                                    <TableHead className="py-4 px-6 font-black text-slate-400 uppercase text-[9px] tracking-widest">Personnel</TableHead>
                                    <TableHead className="py-4 px-6 font-black text-slate-400 uppercase text-[9px] tracking-widest text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allAttendance.length > 0 ? allAttendance.map(record => (
                                    <TableRow key={record.id} className="border-slate-50 hover:bg-white/80 transition-all duration-300">
                                        <TableCell className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-slate-400 font-black text-[10px]">
                                                    {record.userName.charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-800 italic uppercase text-xs">{record.userName}</span>
                                                    <span className="text-[8px] font-bold text-slate-400 tracking-wider uppercase">{record.department}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4 px-6 text-right">
                                            <Badge variant="outline" className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border-none ${record.status === 'clocked-in' ? "bg-green-100 text-green-700 shadow-sm shadow-green-50" :
                                                record.status === 'on-break' ? "bg-orange-100 text-orange-700 shadow-sm shadow-orange-50" :
                                                    record.status === 'on-leave' ? "bg-blue-100 text-blue-700 shadow-sm shadow-blue-50" :
                                                        "bg-slate-200 text-slate-500"
                                                }`}>
                                                {record.status.replace('-', ' ')}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="py-12 text-center">
                                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic">Waiting for logs...</p>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>

            {/* Leave Request Dialog */}
            <Dialog open={isLeaveOpen} onOpenChange={setIsLeaveOpen}>
                <DialogContent className="sm:max-w-[450px] border-none rounded-[3rem] p-0 overflow-hidden shadow-2xl">
                    <div className="bg-red-600 p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 h-32 w-32 bg-white/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
                        <DialogHeader className="space-y-1 relative z-10">
                            <DialogTitle className="text-2xl font-black italic tracking-tighter uppercase leading-none">Request Leave</DialogTitle>
                            <DialogDescription className="text-red-100 font-bold uppercase tracking-widest text-[9px]">
                                Submit absence request for approval
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <form onSubmit={requestLeave} className="p-8 space-y-6 bg-white">
                        <div className="grid grid-cols-1 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Leave Type</Label>
                                <Select value={leaveType} onValueChange={setLeaveType}>
                                    <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-black text-[9px] uppercase tracking-widest text-slate-500">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                        <SelectItem value="SICK" className="font-bold uppercase italic text-[9px] tracking-widest">Sick Leave</SelectItem>
                                        <SelectItem value="VACATION" className="font-bold uppercase italic text-[9px] tracking-widest">Vacation</SelectItem>
                                        <SelectItem value="PERSONAL" className="font-bold uppercase italic text-[9px] tracking-widest">Personal</SelectItem>
                                        <SelectItem value="EMERGENCY" className="font-bold uppercase italic text-[9px] tracking-widest">Emergency</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Start Date</Label>
                                    <Input type="date" value={leaveStartDate} onChange={e => setLeaveStartDate(e.target.value)} required className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">End Date</Label>
                                    <Input type="date" value={leaveEndDate} onChange={e => setLeaveEndDate(e.target.value)} required className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest italic" />
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

            {/* Location Selection Dialog */}
            <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
                {/* ... existing location dialog content ... */}
                <DialogContent className="sm:max-w-[450px] border-none rounded-[3rem] p-0 overflow-hidden shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-500">
                    <div className="bg-red-600 p-10 text-white relative">
                        <div className="absolute top-0 right-0 h-40 w-40 bg-white/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
                        <DialogHeader className="space-y-3 relative z-10">
                            <DialogTitle className="text-3xl font-black italic tracking-tighter uppercase leading-none">Select Location</DialogTitle>
                            <DialogDescription className="text-red-100 font-bold uppercase tracking-widest text-[10px]">
                                Choose your work location for today
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <div className="p-10 grid grid-cols-1 gap-5 bg-white">
                        <Button
                            onClick={() => confirmClockIn("OFFICE")}
                            variant="outline"
                            disabled={isProcessing}
                            className="h-20 rounded-[1.5rem] border-2 border-slate-50 bg-slate-50/50 hover:border-red-600 hover:bg-red-600 hover:text-white text-slate-700 font-black text-lg flex items-center justify-start px-8 gap-6 transition-all duration-500 group"
                        >
                            <div className="h-12 w-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-2xl group-hover:scale-110 transition-transform border border-slate-100">🏢</div>
                            <div className="flex flex-col items-start">
                                <span className="uppercase italic tracking-tighter text-lg leading-none">On-Site Office</span>
                                <span className="text-[10px] font-bold text-slate-400 group-hover:text-white/50 transition-colors uppercase mt-1">Main Facility</span>
                            </div>
                        </Button>
                        <Button
                            onClick={() => confirmClockIn("WFH")}
                            variant="outline"
                            disabled={isProcessing}
                            className="h-20 rounded-[1.5rem] border-2 border-slate-50 bg-slate-50/50 hover:border-red-600 hover:bg-red-600 hover:text-white text-slate-700 font-black text-lg flex items-center justify-start px-8 gap-6 transition-all duration-500 group"
                        >
                            <div className="h-12 w-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-2xl group-hover:scale-110 transition-transform border border-slate-100">🏠</div>
                            <div className="flex flex-col items-start">
                                <span className="uppercase italic tracking-tighter text-lg leading-none">Remote Node</span>
                                <span className="text-[10px] font-bold text-slate-400 group-hover:text-white/50 transition-colors uppercase mt-1">Work From Home</span>
                            </div>
                        </Button>
                        <Button
                            onClick={() => confirmClockIn("OTHER")}
                            variant="outline"
                            disabled={isProcessing}
                            className="h-20 rounded-[1.5rem] border-2 border-slate-50 bg-slate-50/50 hover:border-red-600 hover:bg-red-600 hover:text-white text-slate-700 font-black text-lg flex items-center justify-start px-8 gap-6 transition-all duration-500 group"
                        >
                            <div className="h-12 w-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-2xl group-hover:scale-110 transition-transform border border-slate-100">📍</div>
                            <div className="flex flex-col items-start">
                                <span className="uppercase italic tracking-tighter text-lg leading-none">Field Terminal</span>
                                <span className="text-[10px] font-bold text-slate-400 group-hover:text-white/50 transition-colors uppercase mt-1">Other Locations</span>
                            </div>
                        </Button>

                        <div className="pt-6">
                            <Button variant="ghost" className="w-full text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-red-500" onClick={() => setShowLocationDialog(false)}>
                                Abort Authorization
                            </Button>
                        </div>

                        {isProcessing && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-500 z-50">
                                <div className="flex flex-col items-center gap-5">
                                    <div className="h-16 w-16 rounded-[1.5rem] bg-slate-900 flex items-center justify-center shadow-2xl">
                                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-black text-slate-900 text-xs italic uppercase tracking-widest">Identifying Presence...</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Syncing with Cloud Node</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    )
}
