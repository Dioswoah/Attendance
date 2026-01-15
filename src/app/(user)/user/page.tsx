"use client"

import { useState, useEffect } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Clock, Loader2, LogOut, MapPin, CheckCircle2, LayoutDashboard } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import Link from "next/link"

export default function UserPortal() {
    const { data: session, status } = useSession()
    const [currentAttendance, setCurrentAttendance] = useState<any | null>(null)
    const [allAttendance, setAllAttendance] = useState<any[]>([])
    const [currentTime, setCurrentTime] = useState(new Date())
    const [showLocationDialog, setShowLocationDialog] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)

    useEffect(() => {
        const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000)
        fetchAttendance()
        const refreshInterval = setInterval(fetchAttendance, 10000)
        return () => {
            clearInterval(timeInterval)
            clearInterval(refreshInterval)
        }
    }, [session])

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
        <div className="max-w-4xl w-full py-12 px-6 space-y-12 flex flex-col items-center animate-in fade-in duration-1000">
            {/* Main Interactive Card */}
            <Card className="w-full max-w-md shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border-none rounded-[3rem] overflow-hidden bg-white/80 backdrop-blur-md">
                <CardContent className="p-10 flex flex-col items-center space-y-10">
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
                            <div className={`absolute -bottom-1 -right-1 h-8 w-8 border-4 border-white rounded-full ${currentAttendance && currentAttendance.status !== 'clocked-out' ? 'bg-green-500 shadow-lg shadow-green-100' : 'bg-slate-300'}`} />
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
                                    "bg-white text-slate-400"
                                }`}>
                                {currentAttendance?.status === 'clocked-in' ? 'Clocked In' :
                                    currentAttendance?.status === 'on-break' ? 'On Break' :
                                        'Ready for Shift'}
                            </Badge>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="w-full pt-2">
                        {!currentAttendance || currentAttendance.status === 'clocked-out' ? (
                            <Button
                                onClick={handleClockInClick}
                                disabled={isProcessing}
                                className="w-full h-20 bg-red-600 hover:bg-red-700 text-white text-xl font-black rounded-[1.8rem] shadow-2xl shadow-red-100 transition-all active:scale-95 group italic uppercase tracking-widest"
                            >
                                <Clock className="mr-3 h-6 w-6 group-hover:rotate-12 transition-transform" />
                                {isProcessing ? "Authorizing..." : "Clock In Now"}
                            </Button>
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
                            <LogOut className="h-3.5 w-3.5" /> Sign Out Session
                        </Button>
                        <div className="h-4 w-[1px] bg-slate-100" />
                        <Link href="/admin">
                            <Button variant="ghost" className="h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-300 hover:text-red-600 transition-colors gap-2">
                                <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* Attendance List */}
            <div className="w-full space-y-8 animate-in slide-in-from-bottom-8 duration-1000">
                <div className="flex flex-col items-center text-center space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight italic uppercase">Active Workforce Feed</h2>
                    </div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] ml-1">Today's Attendance Overview</p>
                </div>

                <Card className="shadow-2xl border-none rounded-[2.5rem] overflow-hidden bg-white/50 backdrop-blur-sm">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="hover:bg-transparent border-slate-100">
                                <TableHead className="py-6 px-10 font-black text-slate-400 uppercase text-[10px] tracking-widest">Employee</TableHead>
                                <TableHead className="py-6 px-10 font-black text-slate-400 uppercase text-[10px] tracking-widest">Department</TableHead>
                                <TableHead className="py-6 px-10 font-black text-slate-400 uppercase text-[10px] tracking-widest text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allAttendance.length > 0 ? allAttendance.map(record => (
                                <TableRow key={record.id} className="border-slate-50 hover:bg-white/80 transition-all duration-300">
                                    <TableCell className="py-6 px-10">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-slate-400 font-black text-xs">
                                                {record.userName.charAt(0)}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-800 italic uppercase text-sm">{record.userName}</span>
                                                <span className="text-[10px] font-bold text-slate-400 tracking-wider">Status Verified</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-6 px-10">
                                        <span className="text-xs font-black text-slate-500 uppercase italic tracking-tighter">
                                            {record.department}
                                        </span>
                                    </TableCell>
                                    <TableCell className="py-6 px-10 text-right">
                                        <Badge variant="outline" className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border-none ${record.status === 'clocked-in' ? "bg-green-100 text-green-700 shadow-sm shadow-green-50" :
                                            record.status === 'on-break' ? "bg-orange-100 text-orange-700 shadow-sm shadow-orange-50" :
                                                "bg-slate-200 text-slate-500"
                                            }`}>
                                            {record.status.replace('-', ' ')}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="py-20 text-center">
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic font-bold">Waiting for first shift logs...</p>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </div>

            {/* Location Selection Dialog */}
            <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
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
        </div>
    )
}
