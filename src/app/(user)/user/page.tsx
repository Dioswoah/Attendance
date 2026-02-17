"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Clock, Loader2, LogOut, MapPin, CheckCircle2, LayoutDashboard, CalendarDays, FileText, Check, X, Bell, CalendarOff, Search, LogIn, Coffee, Timer, Calendar, TrendingUp, ArrowUpDown, Building2, AlertTriangle, Lock, ChevronDown, Globe, Shield, History, Users, Edit, Briefcase, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO, isWithinInterval, startOfWeek, endOfWeek } from "date-fns"
import { cn } from "@/lib/utils"
import { io } from "socket.io-client"
import { getBrowserTimezone } from "@/lib/timezone"
import { statusConfig } from "@/components/UserStatusDropdown"


export default function UserPortal() {
    const { data: session, status, update } = useSession()
    const [currentAttendance, setCurrentAttendance] = useState<any | null>(null)
    const [userAttendanceList, setUserAttendanceList] = useState<any[]>([])
    const [employees, setEmployees] = useState<any[]>([])
    const [allAttendance, setAllAttendance] = useState<any[]>([])
    const [currentTime, setCurrentTime] = useState<Date | null>(null)
    const [mounted, setMounted] = useState(false)
    const [showLocationDialog, setShowLocationDialog] = useState(false)
    const [showClockOutConfirm, setShowClockOutConfirm] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [hasAutoSwitchedStatus, setHasAutoSwitchedStatus] = useState(false)
    const [hasAutoActionRun, setHasAutoActionRun] = useState(false)
    const searchParams = useSearchParams()
    const router = useRouter()

    // Auto-switch to AVAILABLE if user is APPEAR_OFFLINE but active in the app
    // Auto-switch logic REMOVED to respect Google Chat Status
    // We do NOT want to force "Available" if Google says "Away/Offline".

    // State Declarations (Consolidated at top)
    const [userProfile, setUserProfile] = useState<any>(null)
    const [userTimeZone, setUserTimeZone] = useState(getBrowserTimezone())
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
    const [managerList, setManagerList] = useState<any[]>([])
    const [departmentList, setDepartmentList] = useState<any[]>([])
    const [onboardingLocation, setOnboardingLocation] = useState("")
    const [onboardingManager, setOnboardingManager] = useState("")
    const [onboardingDepartment, setOnboardingDepartment] = useState("")
    const [onboardingShiftStart, setOnboardingShiftStart] = useState("09:00")
    const [onboardingShiftEnd, setOnboardingShiftEnd] = useState("17:00")
    const [userRoles, setUserRoles] = useState<string[]>([])
    const [userId, setUserId] = useState<string>("")
    const [userDepartment, setUserDepartment] = useState<string>("")
    const [userDepartmentId, setUserDepartmentId] = useState<string>("")
    const [userManagerId, setUserManagerId] = useState<string | null>(null)
    const [pendingLeaves, setPendingLeaves] = useState<any[]>([])
    const [isLeaveOpen, setIsLeaveOpen] = useState(false)
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [monthlyAttendance, setMonthlyAttendance] = useState<any[]>([])
    const [teamApprovedLeaves, setTeamApprovedLeaves] = useState<any[]>([])
    const [selectedDayDetail, setSelectedDayDetail] = useState<Date | null>(null)
    const [leaveType, setLeaveType] = useState('SICK')
    const [leaveDurationType, setLeaveDurationType] = useState('Full Day')
    const [leaveStartTime, setLeaveStartTime] = useState('09:00')
    const [leaveEndTime, setLeaveEndTime] = useState('13:00')
    const [leaveStartDate, setLeaveStartDate] = useState("")
    const [leaveEndDate, setLeaveEndDate] = useState("")
    const [leaveReason, setLeaveReason] = useState("")
    const [myLeaveRequests, setMyLeaveRequests] = useState<any[]>([])
    const [myAttendanceRequests, setMyAttendanceRequests] = useState<any[]>([])
    const [workedTime, setWorkedTime] = useState("00:00:00")
    const [breakTime, setBreakTime] = useState("00:00:00")
    const [sortBy, setSortBy] = useState<string>("name")
    const [filterStatus, setFilterStatus] = useState<string>("all")
    const [filterDepartment, setFilterDepartment] = useState<string>("all")
    const [searchQuery, setSearchQuery] = useState<string>("")
    const [feedSearch, setFeedSearch] = useState("")
    const [breakTotalMs, setBreakTotalMs] = useState(0)
    const [warningTriggered, setWarningTriggered] = useState(false)
    const [limitTriggered, setLimitTriggered] = useState(false)
    const [showBreakDialog, setShowBreakDialog] = useState(false)
    const [breakDialogType, setBreakDialogType] = useState<"WARNING" | "EXCEEDED">("WARNING")
    const [customClockInTime, setCustomClockInTime] = useState("")
    const [customReason, setCustomReason] = useState("")
    const [previousTimezone, setPreviousTimezone] = useState<string | null>(null)
    const [showTimezoneWorkHoursDialog, setShowTimezoneWorkHoursDialog] = useState(false)
    const [tempWorkHoursStart, setTempWorkHoursStart] = useState("")
    const [tempWorkHoursEnd, setTempWorkHoursEnd] = useState("")
    const [scheduledStart, setScheduledStart] = useState("")
    const [scheduledEnd, setScheduledEnd] = useState("")
    const [showScheduleInput, setShowScheduleInput] = useState(false)
    const [isDeclineOpen, setIsDeclineOpen] = useState(false)
    const [declineReason, setDeclineReason] = useState("")
    const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null)
    const [calendarFilterDepartment, setCalendarFilterDepartment] = useState("all")
    const [showBreakStartDialog, setShowBreakStartDialog] = useState(false)
    const [breakReturnTime, setBreakReturnTime] = useState("")
    const [selectedLocationMode, setSelectedLocationMode] = useState<string | null>(null)
    const [locationDetails, setLocationDetails] = useState("")

    // Ref to track if we are in the initial data loading phase
    const isFirstTimezoneSync = useRef(true)

    // --- CONSOLIDATED QUICK LOAD ---
    const fetchDashboardData = async () => {
        if (status !== 'authenticated' || !session?.user?.id) return

        // Show loading only on first run
        if (!userProfile) setIsLoading(true)

        try {
            const res = await fetch('/api/user/dashboard')
            if (!res.ok) throw new Error("Failed to load dashboard")

            const data = await res.json()

            // 1. Set Profile & Timezone
            setUserProfile(data.user)
            if (data.user) {
                if (data.user.useCurrentTimezone) {
                    setUserTimeZone(getBrowserTimezone())
                } else if (data.user.selectedTimezone) {
                    setUserTimeZone(data.user.selectedTimezone)
                }

                // Set metadata states
                setUserId(data.user.id)
                setUserRoles(data.user.roles || [])
                setUserDepartment(data.user.department?.name || "Unassigned")
                setUserDepartmentId(data.user.departmentId || "")
                setUserManagerId(data.user.managerId || null)

                // Handle Manager/Admin extra data
                if (data.user.roles.includes('MANAGER') || data.user.roles.includes('ADMIN')) {
                    fetchPendingLeaves(data.user.id)
                }
            }

            // Handle Onboarding Logic
            if (data.user && data.user.location !== 'Philippines' && data.user.location !== 'Australia') {
                const isFreshAccount = data.user.createdAt ? (new Date().getTime() - new Date(data.user.createdAt).getTime() < 24 * 60 * 60 * 1000) : true
                if (isFreshAccount && !sessionStorage.getItem('onboardingSkipped')) {
                    setIsOnboardingOpen(true)
                    const [mRes, dRes] = await Promise.all([
                        fetch('/api/managers'),
                        fetch('/api/departments')
                    ]).catch(() => [null, null])

                    if (mRes && mRes.ok) setManagerList(await mRes.json())
                    if (dRes && dRes.ok) setDepartmentList(await dRes.json())
                }
            }

            // 2. Set Attendance
            setUserAttendanceList(data.attendance.mine)
            setAllAttendance(data.attendance.allToday)

            // Determine active session
            const active = data.attendance.mine.find((r: any) => !r.clockOut)
            setCurrentAttendance(active || data.attendance.mine[0] || null)

            // 3. Set Requests & Staff
            setMyLeaveRequests(data.leaves)
            setMyAttendanceRequests(data.attendanceRequests)
            setEmployees(data.staff)

        } catch (e) {
            console.error("Dashboard Quick Load Error:", e)
        } finally {
            setIsLoading(false)
        }
    }

    // Aliases for legacy interaction handlers to prevent refactoring every button
    const fetchProfile = fetchDashboardData
    const fetchAttendance = fetchDashboardData
    const fetchMyLeaveRequests = fetchDashboardData
    const fetchUserDetails = fetchDashboardData

    useEffect(() => {
        if (status === 'authenticated' && session?.user?.id) {
            fetchDashboardData()
        }
    }, [status, session?.user?.id])

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/')
        }
    }, [status, router])

    // Detect Timezone Changes and Prompt Work Hours Confirmation
    useEffect(() => {
        // If we are in the initial sync phase (profile just loaded or loading)
        // ignore the transition and just update the baseline.
        // We consider the sync "done" once we have a userProfile and a userTimeZone.
        if (isFirstTimezoneSync.current) {
            if (userProfile && userTimeZone) {
                isFirstTimezoneSync.current = false
                setPreviousTimezone(userTimeZone)
            } else if (userTimeZone) {
                // If we have a timezone but no profile yet, track it but stay in first sync
                setPreviousTimezone(userTimeZone)
            }
            return
        }

        if (userTimeZone && previousTimezone && userTimeZone !== previousTimezone) {
            // Timezone has changed - prompt user to confirm work hours
            // ONLY if the user is based in the Philippines (as per request)
            if (userProfile?.location === 'Philippines') {
                setTempWorkHoursStart(userProfile?.shiftStartTime || "09:00")
                setTempWorkHoursEnd(userProfile?.shiftEndTime || "17:00")
                setShowTimezoneWorkHoursDialog(true)
            }
        }

        // Update previous timezone
        if (userTimeZone) {
            setPreviousTimezone(userTimeZone)
        }
    }, [userTimeZone, userProfile])

    // Initialize scheduled times with user's default work hours


    const handleTimezoneWorkHoursConfirm = async () => {
        try {
            const res = await fetch('/api/user/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shiftStartTime: tempWorkHoursStart,
                    shiftEndTime: tempWorkHoursEnd
                })
            })

            if (res.ok) {
                const updated = await res.json()
                setUserProfile(updated)
                setPreviousTimezone(userTimeZone)
                setShowTimezoneWorkHoursDialog(false)
                toast.success("Work hours updated for new timezone")
            }
        } catch (error) {
            console.error("Failed to update work hours", error)
            toast.error("Failed to update work hours")
        }
    }

    const handleOnboardingSubmit = async () => {
        if (!onboardingLocation) return

        try {
            const res = await fetch('/api/user/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    location: onboardingLocation,
                    managerId: onboardingManager || 'unassigned',
                    departmentId: onboardingDepartment || null,
                    shiftStartTime: onboardingShiftStart,
                    shiftEndTime: onboardingShiftEnd
                })
            })
            if (res.ok) {
                const updated = await res.json()
                setUserProfile(updated)
                if (updated.useCurrentTimezone) {
                    setUserTimeZone(getBrowserTimezone())
                } else if (updated.selectedTimezone) {
                    setUserTimeZone(updated.selectedTimezone)
                } else {
                    if (updated.location === 'Philippines') setUserTimeZone('Asia/Manila')
                    else if (updated.location === 'Australia') setUserTimeZone('Australia/Sydney')
                }
                setIsOnboardingOpen(false)
            }
        } catch (error) {
            console.error("Onboarding failed", error)
        }
    }











    // Initialize scheduled times with user's default work hours
    useEffect(() => {
        if (userProfile?.shiftStartTime && userProfile?.shiftEndTime) {
            setScheduledStart(userProfile.shiftStartTime)
            setScheduledEnd(userProfile.shiftEndTime)
        }
    }, [userProfile])

    const handleUpdateWorkHours = async () => {
        if (!scheduledStart || !scheduledEnd) {
            toast.error("Please set both start and end times")
            return
        }

        // Optimistic UI update
        const previousProfile = userProfile ? { ...userProfile } : null
        setUserProfile((prev: any) => ({
            ...prev,
            shiftStartTime: scheduledStart,
            shiftEndTime: scheduledEnd
        }))
        setShowScheduleInput(false)

        try {
            const res = await fetch('/api/user/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shiftStartTime: scheduledStart,
                    shiftEndTime: scheduledEnd
                })
            })

            if (res.ok) {
                const updated = await res.json()
                setUserProfile(updated)
                toast.success("Work hours updated successfully")
            } else {
                // Revert on error
                setUserProfile(previousProfile)
                toast.error("Failed to update work hours")
            }
        } catch (error) {
            // Revert on error
            setUserProfile(previousProfile)
            console.error("Failed to save scheduled hours", error)
            toast.error("Failed to update work hours")
        }
    }













    // --- OPTIMISTIC STATUS CALCULATION ---
    const optimisticStatus = useMemo(() => {
        let status = currentAttendance?.status || 'clocked-out';

        // 1. Determine the timestamp of the LATEST confirmed activity from the server
        let latestRealTime = 0
        if (currentAttendance) {
            if (currentAttendance.clockIn) latestRealTime = Math.max(latestRealTime, new Date(currentAttendance.clockIn).getTime())
            if (currentAttendance.clockOut) latestRealTime = Math.max(latestRealTime, new Date(currentAttendance.clockOut).getTime())
            if (currentAttendance.breaks) {
                currentAttendance.breaks.forEach((b: any) => {
                    if (b.startTime) latestRealTime = Math.max(latestRealTime, new Date(b.startTime).getTime())
                    if (b.endTime) latestRealTime = Math.max(latestRealTime, new Date(b.endTime).getTime())
                })
            }
            // Also check breakStart/breakEnd logic if flat fields are used
            if (currentAttendance.breakStart) latestRealTime = Math.max(latestRealTime, new Date(currentAttendance.breakStart).getTime())
            if (currentAttendance.breakEnd) latestRealTime = Math.max(latestRealTime, new Date(currentAttendance.breakEnd).getTime())
        }

        // 2. Filter requests for today AND ensure they are NEWER than the latest real activity
        const todayPHT = new Date().toLocaleDateString("en-CA", { timeZone: userTimeZone })

        const validRequests = myAttendanceRequests.filter(req => {
            const reqDate = new Date(req.time || req.date)
            // Must be pending
            if (req.status !== 'PENDING') return false
            // Must be for today
            if (reqDate.toLocaleDateString("en-CA", { timeZone: userTimeZone }) !== todayPHT) return false
            // CRITICAL: Must be newer than the latest real event to affect current status
            // If we have no real record (latestRealTime===0), then any pending request counts.
            // If we have a real record, only requests physically dated AFTER that record should override it.
            return reqDate.getTime() > latestRealTime
        }).sort((a, b) => new Date(a.time || a.date).getTime() - new Date(b.time || b.date).getTime())

        // 3. Replay valid requests on top of current status
        validRequests.forEach(req => {
            if (req.type === 'CLOCK_IN') status = 'clocked-in'
            if (req.type === 'BREAK_START') status = 'on-break'
            if (req.type === 'BREAK_END') status = 'clocked-in'
            if (req.type === 'CLOCK_OUT') status = 'clocked-out'
        })

        return status
    }, [currentAttendance, myAttendanceRequests, userTimeZone])

    // 1. Initial Data Fetch & Realtime Subscription (SSE)
    useEffect(() => {
        setMounted(true)
        setCurrentTime(new Date())

        // Only load dashboard if authenticated
        if (session?.user?.id) {
            fetchDashboardData()
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
            const todayPHT = now.toLocaleDateString("en-CA", { timeZone: userTimeZone })

            const todayRecords = userAttendanceList.filter((record: any) => {
                if (!record.clockIn) return false
                const recordDate = new Date(record.clockIn)
                const recordPHT = recordDate.toLocaleDateString("en-CA", { timeZone: userTimeZone })
                return recordPHT === todayPHT
            })

            // --- OPTIMISTIC / OVERRIDE CALCULATION ---
            // Find if we have a pending CLOCK_IN for today
            const pendingClockIn = myAttendanceRequests.find((req: any) => {
                if (req.type !== 'CLOCK_IN' || req.status !== 'PENDING') return false
                const reqDate = new Date(req.time || req.date)
                return reqDate.toLocaleDateString("en-CA", { timeZone: userTimeZone }) === todayPHT
            })

            let modifiedTodayRecords = [...todayRecords]

            if (pendingClockIn) {
                const pendingTime = pendingClockIn.time || pendingClockIn.date

                if (modifiedTodayRecords.length > 0) {
                    const firstRecord = { ...modifiedTodayRecords[0] }
                    firstRecord.clockIn = pendingTime
                    // Ensure the session is treated as active if optimistic status suggests it
                    if (['clocked-in', 'on-break'].includes(optimisticStatus)) {
                        firstRecord.clockOut = null
                    }
                    firstRecord.breaks = firstRecord.breaks ? [...firstRecord.breaks] : []
                    modifiedTodayRecords[0] = firstRecord
                } else {
                    modifiedTodayRecords = [{
                        clockIn: pendingTime,
                        clockOut: null,
                        breaks: []
                    }]
                }
            } else if (modifiedTodayRecords.length > 0) {
                // Clone the first record's breaks anyway so we can inject pending breaks
                const firstRecord = { ...modifiedTodayRecords[0] }
                // Ensure active session ticks if optimistic status is active
                if (['clocked-in', 'on-break'].includes(optimisticStatus)) {
                    firstRecord.clockOut = null
                }
                firstRecord.breaks = firstRecord.breaks ? [...firstRecord.breaks] : []
                modifiedTodayRecords[0] = firstRecord
            }

            // --- INJECT PENDING BREAKS ---
            if (modifiedTodayRecords.length > 0) {
                const record = modifiedTodayRecords[0]
                const realSessionStartTs = new Date(record.clockIn).getTime()

                // Deep clone breaks to prevent mutation of the source state
                record.breaks = record.breaks ? record.breaks.map((b: any) => ({ ...b })) : []

                // 1. Pending Break Starts (Virtual Open Break)
                // DEDUPLICATE: Only take the LATEST pending break start for this session
                const allPendingStarts = myAttendanceRequests.filter((req: any) => {
                    if (req.type !== 'BREAK_START' || req.status !== 'PENDING') return false
                    const reqDate = new Date(req.time || req.date)
                    if (reqDate.toLocaleDateString("en-CA", { timeZone: userTimeZone }) !== todayPHT) return false
                    if (reqDate.getTime() < realSessionStartTs) return false
                    return true
                }).sort((a, b) => new Date(b.time || b.date).getTime() - new Date(a.time || a.date).getTime())

                const pendingBreakStart = allPendingStarts[0]
                if (pendingBreakStart) {
                    record.breaks.push({
                        startTime: pendingBreakStart.time || pendingBreakStart.date,
                        endTime: null,
                        isPending: true
                    })
                }

                // 2. Pending Break Ends (Close virtual or real open breaks)
                // DEDUPLICATE: Only take the LATEST pending break end
                const allPendingEnds = myAttendanceRequests.filter((req: any) => {
                    if (req.type !== 'BREAK_END' || req.status !== 'PENDING') return false
                    const reqDate = new Date(req.time || req.date)
                    if (reqDate.toLocaleDateString("en-CA", { timeZone: userTimeZone }) !== todayPHT) return false
                    if (reqDate.getTime() < realSessionStartTs) return false
                    return true
                }).sort((a, b) => new Date(b.time || b.date).getTime() - new Date(a.time || a.date).getTime())

                const pendingBreakEnd = allPendingEnds[0]
                if (pendingBreakEnd) {
                    const openBreak = record.breaks.find((b: any) => !b.endTime)
                    const reqDate = new Date(pendingBreakEnd.time || pendingBreakEnd.date)
                    if (openBreak && reqDate.getTime() > new Date(openBreak.startTime).getTime()) {
                        openBreak.endTime = pendingBreakEnd.time || pendingBreakEnd.date
                    }
                }
            }

            let totalWorkedMs = 0
            let totalBreakMs = 0

            modifiedTodayRecords.forEach((record: any, index: number) => {
                const start = new Date(record.clockIn)
                // Only the LATEST session should be "Active" optimistically
                const isSessionActive = index === 0 && ['clocked-in', 'on-break'].includes(optimisticStatus)
                    ? true
                    : !record.clockOut;
                const end = isSessionActive ? now : new Date(record.clockOut)

                // Calculate total breaks for this record
                let sessionBreakMs = 0
                if (record.breaks && record.breaks.length > 0) {
                    // Sort breaks by startTime ASC to identify the latest
                    const sortedBreaks = [...record.breaks].sort((a, b) =>
                        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
                    )

                    sortedBreaks.forEach((b: any, bIndex: number) => {
                        const bStart = new Date(b.startTime)
                        let bEnd: Date
                        const isLatestBreak = bIndex === sortedBreaks.length - 1

                        if (b.endTime) {
                            bEnd = new Date(b.endTime)
                        } else if (!isSessionActive) {
                            // If session ended, break must have ended too (safety fallback)
                            bEnd = end
                        } else if (optimisticStatus === 'on-break' && index === 0 && isLatestBreak) {
                            // Only tick if we are CURRENTLY supposed to be on break AND this is the latest session AND the latest break
                            bEnd = now
                        } else {
                            // If we are "Working", or this is an old session, or its a ghost open break (not latest)
                            bEnd = bStart
                        }
                        sessionBreakMs += Math.max(0, bEnd.getTime() - bStart.getTime())
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
    }, [userAttendanceList, myAttendanceRequests, optimisticStatus])

    // 3. Break Limit Monitoring Effect
    useEffect(() => {
        const checkBreakLimit = async () => {
            if (!userId) return

            // 45 minutes = 2700000 ms
            // 60 minutes = 3600000 ms
            const WARNING_MS = 45 * 60 * 1000
            const LIMIT_MS = 60 * 60 * 1000
            const today = new Date().toLocaleDateString("en-CA", { timeZone: userTimeZone })

            if (breakTotalMs >= WARNING_MS && breakTotalMs < LIMIT_MS && !warningTriggered) {
                const alreadyAck = localStorage.getItem(`break_warning_ack_${userId}_${today}`)
                if (!alreadyAck) {
                    setWarningTriggered(true)
                    setBreakDialogType("WARNING")
                    setShowBreakDialog(true)
                    // Report to server (In-app notif)
                    await fetch('/api/attendance/break-limit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'WARNING', totalBreakTime: breakTime, limit: '1 hour' })
                    })
                }
            } else if (breakTotalMs >= LIMIT_MS && !limitTriggered) {
                const alreadyAck = localStorage.getItem(`break_limit_ack_${userId}_${today}`)
                if (!alreadyAck) {
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
        }

        if (breakTotalMs > 0) {
            checkBreakLimit()
        }
    }, [breakTotalMs, warningTriggered, limitTriggered, breakTime, userId])

    // 4. Auto-Logout Notification Effect
    useEffect(() => {
        if (!userAttendanceList.length || !userId) return

        const todayPHT = new Date().toLocaleDateString("en-CA", { timeZone: userTimeZone })

        // Find the latest record from BEFORE today
        const pastRecords = userAttendanceList.filter((r: any) => {
            if (!r.clockIn) return false
            const rDate = new Date(r.clockIn).toLocaleDateString("en-CA", { timeZone: userTimeZone })
            return rDate < todayPHT
        }).sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime())

        if (pastRecords.length > 0) {
            const lastSession = pastRecords[0]

            // Check if it has a clockOut time
            if (lastSession.clockOut) {
                const cOut = new Date(lastSession.clockOut)

                // Heuristic: If existing clockOut has 59 seconds, it was likely the auto-cleanup job
                // (or a very precise/unlucky user). 
                // Given the requirement, this is the best signal we have without schema changes.
                if (cOut.getSeconds() === 59) {
                    const key = `auto_logout_notified_${lastSession.id}`
                    if (!sessionStorage.getItem(key)) {
                        toast("You forgot to clock out yesterday", {
                            description: "We've automatically clocked you out at 11:59 PM. Please amend the record if necessary.",
                            action: {
                                label: "Fix This",
                                onClick: () => window.location.href = '/user/amend-records'
                            },
                            duration: 8000,
                        })
                        sessionStorage.setItem(key, "true")
                    }
                }
            }
        }
    }, [userAttendanceList, userId, userTimeZone])

    const handleBreakAcknowledge = () => {
        if (!userId) {
            setShowBreakDialog(false)
            return
        }

        const today = new Date().toLocaleDateString("en-CA", { timeZone: userTimeZone })
        const key = breakDialogType === "WARNING"
            ? `break_warning_ack_${userId}_${today}`
            : `break_limit_ack_${userId}_${today}`

        localStorage.setItem(key, "true")
        setShowBreakDialog(false)
    }

    const formatDuration = (ms: number) => {
        if (ms < 0) ms = 0
        const seconds = Math.floor((ms / 1000) % 60)
        const minutes = Math.floor((ms / (1000 * 60)) % 60)
        const hours = Math.floor((ms / (1000 * 60 * 60)))
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: userTimeZone })
    }

    // Pending Leaves for Managers
    const fetchPendingLeaves = async (managerId: string) => {
        try {
            const res = await fetch(`/api/leaves?managerId=${managerId}&status=PENDING`)
            if (res.ok) {
                const data = await res.json()
                setPendingLeaves(data)
            }
        } catch (error) {
            console.error("Failed to fetch pending leaves", error)
        }
    }

    const handleClockInClick = () => {
        // Clear custom time/reason for normal clock in
        setCustomClockInTime("")
        setCustomReason("")
        setSelectedLocationMode(null)
        setLocationDetails("")
        setShowLocationDialog(true)
    }

    const confirmClockIn = async (mode: string) => {
        if (!session?.user?.id) return

        // Validate location details if required
        if (mode === 'ONSITE' && !locationDetails.trim()) {
            toast.error("Please provide a Location or Job Number for Onsite work")
            return
        }
        if (mode === 'OTHER' && !locationDetails.trim()) {
            toast.error("Please provide Location Details")
            return
        }

        // Optimistic UI: Update state immediately
        const now = new Date()
        const clockInISO = now.toISOString()

        // Create optimistic record
        const optimisticRecord = {
            id: `temp-${Date.now()}`,
            userId: session.user.id,
            clockIn: clockInISO,
            clockOut: null,
            breaks: [],
            status: 'clocked-in',
            mode: mode,
            locationDetails: locationDetails
        }

        // Save previous state for rollback
        const previousAttendance = currentAttendance
        const previousList = [...userAttendanceList]

        // Update local state instantly
        setCurrentAttendance(optimisticRecord)
        setUserAttendanceList([optimisticRecord, ...userAttendanceList])
        setShowLocationDialog(false)

        // We don't set isProcessing to true here to keep the UI interactive/responsive
        // But we might want to disable the button to prevent double-clicks
        setIsProcessing(true)

        try {
            // Start Amendment Logic
            if (customClockInTime && customClockInTime.trim() !== "") {
                // ... (existing amendment logic) ...
                const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: userTimeZone })
                const offset = (() => {
                    try {
                        const part = new Intl.DateTimeFormat('en-US', { timeZone: userTimeZone, timeZoneName: 'longOffset' }).formatToParts().find(p => p.type === 'timeZoneName')
                        return part?.value.replace('GMT', '') || '+00:00'
                    } catch { return '+00:00' }
                })()
                const customDateStr = `${todayStr}T${customClockInTime}:00${offset}`

                if (!customReason.trim()) {
                    toast.error("Please kindly provide a reason for this time adjustment")
                    // Revert state
                    setCurrentAttendance(previousAttendance)
                    setUserAttendanceList(previousList)
                    setIsProcessing(false)
                    return
                }

                const res = await fetch('/api/attendance-requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: session.user.id,
                        date: customDateStr,
                        time: customDateStr,
                        type: 'CLOCK_IN',
                        reason: `[${mode}${locationDetails ? `: ${locationDetails}` : ''}] ${customReason}`
                    })
                })

                if (res.ok) {
                    toast.success("Thank you! Your amendment request has been sent to your manager for review.")
                    fetchMyLeaveRequests()
                    fetchAttendance()
                } else {
                    const data = await res.json()
                    toast.error(data.error || "We encountered a small issue submitting your request. Please try again.")
                    // Revert on error
                    setCurrentAttendance(previousAttendance)
                    setUserAttendanceList(previousList)
                }
                setIsProcessing(false)
                return
            }
            // End Amendment Logic

            // Normal Clock In API Call
            const res = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: session.user.id,
                    mode,
                    locationDetails,
                    clockIn: clockInISO
                })
            })

            if (res.ok) {
                // Success! We can now fetch the real data to get the real ID, 
                // but the user already sees the "Clocked In" state so it feels instant.
                fetchAttendance()
            } else {
                const data = await res.json()
                toast.error(data.error || "We couldn't clock you in just yet. Please try again.")
                // Revert on error
                setCurrentAttendance(previousAttendance)
                setUserAttendanceList(previousList)
                fetchAttendance()
            }
        } catch (error) {
            toast.error("We encountered a small issue. Please try again.")
            // Revert on error
            setCurrentAttendance(previousAttendance)
            setUserAttendanceList(previousList)
        } finally {
            setIsProcessing(false)
        }
    }
    // --- ACTIONS ---

    const handleAction = async (action: 'clock-out' | 'start-break' | 'end-break') => {
        if (!session?.user?.id) return

        // Optimistic UI: Save state & Update immediately
        const now = new Date()
        const nowISO = now.toISOString()
        const previousAttendance = currentAttendance ? { ...currentAttendance } : null
        const previousList = [...userAttendanceList]

        // We only apply optimistic updates for normal actions, not simulated/amendment requests
        // because amendment requests don't change the "Live" status instantly anyway.
        const realStatus = currentAttendance?.status || 'clocked-out'
        const isSimulated = optimisticStatus !== realStatus

        let shouldApplyOptimistic = !isSimulated

        // Special case: If we are correcting a "simulated" state that aligns with reality
        if (isSimulated && currentAttendance?.clockIn && !currentAttendance.clockOut) {
            if (action === 'start-break' && realStatus === 'clocked-in') shouldApplyOptimistic = true
            else if (action === 'end-break' && realStatus === 'on-break') shouldApplyOptimistic = true
            else if (action === 'clock-out' && (realStatus === 'clocked-in' || realStatus === 'on-break')) shouldApplyOptimistic = true
        }

        if (shouldApplyOptimistic && currentAttendance) {
            const updatedRecord = { ...currentAttendance }

            if (action === 'start-break') {
                updatedRecord.status = 'on-break'
                // Add a new break
                const newBreak = {
                    id: `temp-break-${Date.now()}`,
                    startTime: nowISO,
                    endTime: null,
                    expectedReturnTime: breakReturnTime ? (() => {
                        const [h, m] = breakReturnTime.split(':').map(Number)
                        const d = new Date()
                        d.setHours(h, m, 0, 0)
                        return d.toISOString()
                    })() : null
                }
                updatedRecord.breaks = updatedRecord.breaks ? [...updatedRecord.breaks, newBreak] : [newBreak]
            } else if (action === 'end-break') {
                updatedRecord.status = 'clocked-in'
                // Close the open break
                if (updatedRecord.breaks && updatedRecord.breaks.length > 0) {
                    // Find last open break
                    const lastBreakIndex = updatedRecord.breaks.findIndex((b: any) => !b.endTime)
                    if (lastBreakIndex >= 0) {
                        const breaks = [...updatedRecord.breaks]
                        breaks[lastBreakIndex] = { ...breaks[lastBreakIndex], endTime: nowISO }
                        updatedRecord.breaks = breaks
                    }
                }
            } else if (action === 'clock-out') {
                updatedRecord.status = 'clocked-out'
                updatedRecord.clockOut = nowISO
                // Close any open breaks
                if (updatedRecord.breaks) {
                    updatedRecord.breaks = updatedRecord.breaks.map((b: any) =>
                        !b.endTime ? { ...b, endTime: nowISO } : b
                    )
                }
            }

            // Apply Optimistic Update
            setCurrentAttendance(updatedRecord)
            // Also update the list view
            const newList = [...userAttendanceList]
            const recordIndex = newList.findIndex(r => r.id === updatedRecord.id)
            if (recordIndex >= 0) {
                newList[recordIndex] = updatedRecord
                setUserAttendanceList(newList)
            }
        }

        setIsProcessing(true)

        try {
            // Check if we are in a "Simulated" state (where our optimistic status differs from real server status)
            // Or if we specifically have a pending Clock In (root of simulation)

            // Special check: If we are trying to End Break, but real status is 'clocked-in' (meaning Break Start was pending),
            // we must send a request.
            // Simplified: If statuses don't match, we request.
            // Also, if we have ANY pending clock-in, we force request mode to be safe.
            const pendingClockIn = myAttendanceRequests.find((req: any) => {
                if (req.type !== 'CLOCK_IN' || req.status !== 'PENDING') return false
                const reqDate = new Date(req.time || req.date)
                const todayPHT = new Date().toLocaleDateString("en-CA", { timeZone: userTimeZone })
                return reqDate.toLocaleDateString("en-CA", { timeZone: userTimeZone }) === todayPHT
            })

            // Domino Effect Prevention: 
            // If we have a REAL session (even a provisional one) and the statuses match, 
            // we should allow a direct PATCH instead of forcing another request.
            if (isSimulated && currentAttendance?.clockIn && !currentAttendance.clockOut) {
                // If it's just an amendment for an existing record, we can patch.
                // But only if we are physically trying to transition from the current server state.
                // example: server thinks I'm 'clocked-in', I want to 'start-break'.
                // If I have a pending CLOCK_IN amendment, I can still start a break on the live session.
                if (action === 'start-break' && realStatus === 'clocked-in') {
                    // This is safe to patch
                } else if (action === 'end-break' && realStatus === 'on-break') {
                    // This is safe as well
                } else if (action === 'clock-out' && (realStatus === 'clocked-in' || realStatus === 'on-break')) {
                    // Safe to clock out
                } else {
                    // Still force simulation if the gap is too large (e.g. server thinks I'm clocked out but I want to start a break)
                    // Continue with simulated request...
                    // Revert optimistic update for simulated requests as they go into pending state
                    if (shouldApplyOptimistic) {
                        setCurrentAttendance(previousAttendance)
                        setUserAttendanceList(previousList)
                    }
                }
            }

            if (isSimulated && !(currentAttendance?.clockIn && !currentAttendance.clockOut) && action !== 'clock-out') {
                // Revert if we are going into request mode (unless we handled above)
                // Actually, for clock-out we might want to show it as "Pending Clock Out" in feed, 
                // but main status might remain "Clocked In" until approved?
                // For now, simpler to revert optimistic UI if it's a request, and let the request toaster handle it.
                if (shouldApplyOptimistic) {
                    setCurrentAttendance(previousAttendance)
                    setUserAttendanceList(previousList)
                }
            }

            if (isSimulated && !(currentAttendance?.clockIn && !currentAttendance.clockOut)) {
                // Submit as Amendment Request
                let reqType = ''
                if (action === 'start-break') reqType = 'BREAK_START'
                if (action === 'end-break') reqType = 'BREAK_END'
                if (action === 'clock-out') reqType = 'CLOCK_OUT'

                const res = await fetch('/api/attendance-requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: session.user.id,
                        date: new Date().toISOString(),
                        time: new Date().toISOString(),
                        type: reqType,
                        reason: "Action taken while pending previous requests"
                    })
                })

                if (res.ok) {
                    fetchMyLeaveRequests() // Refresh pending list
                    toast.success("Amendment request sent successfully.")
                } else {
                    const data = await res.json()
                    toast.error(data.error || "We encountered a small issue submitting your request. Please try again.")
                }
            } else {
                // Normal API Call
                const body: any = { userId: session.user.id, action }
                if (action === 'start-break' && breakReturnTime) {
                    const [h, m] = breakReturnTime.split(':').map(Number)
                    const d = new Date()
                    d.setHours(h, m, 0, 0)
                    body.expectedReturnTime = d.toISOString()
                }

                const res = await fetch('/api/attendance', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                })
                if (res.ok) {
                    // Success! Fetch real data to sync up
                    fetchAttendance()
                } else {
                    // Revert on error
                    if (shouldApplyOptimistic) {
                        setCurrentAttendance(previousAttendance)
                        setUserAttendanceList(previousList)
                    }
                    toast.error("Action failed. Please try again.")
                }
            }
        } catch (error) {
            // Revert on error
            if (shouldApplyOptimistic) {
                setCurrentAttendance(previousAttendance)
                setUserAttendanceList(previousList)
            }
            toast.error("We encountered a small issue. Please try again.")
        } finally {
            setIsProcessing(false)
        }
    }

    const requestLeave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!userId) return

        // Calculate offset for the user's timezone
        const offset = (() => {
            try {
                const part = new Intl.DateTimeFormat('en-US', { timeZone: userTimeZone, timeZoneName: 'longOffset' }).formatToParts().find(p => p.type === 'timeZoneName')
                return part?.value.replace('GMT', '') || '+00:00'
            } catch { return '+00:00' }
        })()

        const start = new Date(`${leaveStartDate}T00:00:00${offset}`)
        const end = new Date(`${leaveEndDate}T00:00:00${offset}`)
        const diffTime = Math.abs(end.getTime() - start.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        const duration = `${diffDays} Day${diffDays > 1 ? 's' : ''}`

        // Optimistic UI update: Add to myLeaveRequests list instantly
        const tempRequestId = `temp-leave-${Date.now()}`
        const newLeaveRequest = {
            id: tempRequestId,
            userId,
            startDate: leaveStartDate,
            endDate: leaveEndDate,
            type: leaveType,
            reason: leaveReason,
            status: 'PENDING',
            duration: leaveDurationType === 'Full Day' && diffDays > 1 ? `${diffDays} Days` : leaveDurationType,
            startTime: leaveDurationType !== 'Full Day' ? new Date(`${leaveStartDate}T${leaveStartTime}:00${offset}`).toISOString() : null,
            endTime: leaveDurationType !== 'Full Day' ? new Date(`${leaveStartDate}T${leaveEndTime}:00${offset}`).toISOString() : null,
            createdAt: new Date().toISOString()
        }

        const previousLeaves = [...myLeaveRequests]
        setMyLeaveRequests([newLeaveRequest, ...myLeaveRequests])
        setIsLeaveOpen(false)

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
                    startTime: leaveDurationType !== 'Full Day' ? new Date(`${leaveStartDate}T${leaveStartTime}:00${offset}`).toISOString() : null,
                    endTime: leaveDurationType !== 'Full Day' ? new Date(`${leaveStartDate}T${leaveEndTime}:00${offset}`).toISOString() : null
                })
            })

            if (res.ok) {
                // Success - Clear form and fetch real data to get real ID
                setLeaveReason("")
                setLeaveStartDate("")
                setLeaveEndDate("")
                setLeaveDurationType("Full Day")
                setLeaveStartTime("09:00")
                setLeaveEndTime("13:00")
                fetchMyLeaveRequests()
                toast.success("Thank you! Your leave request has been submitted for approval.")
            } else {
                // Revert on error
                setMyLeaveRequests(previousLeaves)
                const data = await res.json()
                console.error('[Leave Request] Error response:', data);
                toast.error(data.error || "We encountered a small issue submitting your leave request. Please try again.")
            }
        } catch (error) {
            // Revert on error
            setMyLeaveRequests(previousLeaves)
            toast.error("We encountered a small issue. Please try again.")
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

    const hour = currentTime ? parseInt(currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', hour12: false, timeZone: userTimeZone })) : 0
    const greeting = !mounted ? "Loading..." : hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening"
    const formattedDate = currentTime ? currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: userTimeZone }) : "..."
    const formattedTime = currentTime ? currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: userTimeZone }) : "--:--:--"

    const displayName = (() => {
        if (!session?.user?.email) return "User"
        const dbUser = employees.find((u: any) => u.email === session.user?.email)
        return dbUser?.name?.split(' ')[0] || session.user?.name?.split(' ')[0] || "User"
    })()

    const departmentName = (session.user as any).department || "Unassigned"
    const isUnassigned = !userDepartmentId || userDepartmentId === ""

    // --- Dashboard Helpers ---
    const getStatusColor = () => {
        switch (optimisticStatus) {
            case "clocked-in": return "bg-green-100 text-green-700 border-green-200"
            case "on-break": return "bg-yellow-100 text-yellow-700 border-yellow-200"
            default: return "bg-muted text-slate-700 border-border"
        }
    }

    const getStatusText = () => {
        switch (optimisticStatus) {
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
        if (type.includes('clock-in')) return type.includes('pending') ? "bg-green-200" : "bg-green-500"
        if (type.includes('clock-out')) return type.includes('pending') ? "bg-red-200" : "bg-red-500"
        if (type.includes('break-start')) return type.includes('pending') ? "bg-yellow-200" : "bg-yellow-500"
        if (type.includes('break-end')) return type.includes('pending') ? "bg-blue-200" : "bg-blue-500"
        return "bg-slate-300"
    }

    // Staff Status Helper: Global Directory
    const myTeamList = useMemo(() => {
        // Return active employees for company-wide visibility
        return employees.filter((e: any) => !e.isArchived)
    }, [employees])

    const sortedTeamStatus = useMemo(() => {
        return myTeamList.map((member: any) => {
            // Find attendance record (today) from allAttendance (already fetched)
            const record = allAttendance.find((a: any) => a.userId === member.id)

            // Check if they are on APPROVED leave today
            const onLeaveToday = teamApprovedLeaves.find((l: any) =>
                l.userId === member.id &&
                isWithinInterval(new Date(), { start: parseISO(l.startDate), end: parseISO(l.endDate) })
            )

            let status = 'absent'
            if (record?.status === 'clocked-in') status = 'present'
            else if (record?.status === 'on-break') status = 'break'
            else if (onLeaveToday) status = 'leave'
            else if (record?.clockOut) status = 'offline'

            return { ...member, status, record }
        }).sort((a: any, b: any) => {
            const order: any = { present: 0, break: 1, leave: 2, offline: 3, absent: 4 }
            return order[a.status] - order[b.status]
        })
    }, [myTeamList, allAttendance, teamApprovedLeaves])

    // Pending Clock-In memo for display optimization
    const pendingClockInForDisplay = useMemo(() => {
        const todayPHT = new Date().toLocaleDateString("en-CA", { timeZone: userTimeZone })
        return myAttendanceRequests.find((req: any) => {
            if (req.type !== 'CLOCK_IN' || req.status !== 'PENDING') return false
            const reqDate = new Date(req.time || req.date)
            return reqDate.toLocaleDateString("en-CA", { timeZone: userTimeZone }) === todayPHT
        })
    }, [myAttendanceRequests, userTimeZone])

    // Sort logic for staff
    const sortedStaff = myTeamList
        .map((staff: any) => {
            // Find live status from all Attendance (Server truth)
            const attendanceRecord = allAttendance.find((a: any) => a.userId === staff.id)

            // OPTIMISTIC OVERRIDE: If this is the current user, use the portal's calculated optimistic status.
            // This ensures manual clock-in amendments show the user as "Clocked In" immediately in this view.
            const isMe = staff.id === userId
            const liveStatus = isMe ? optimisticStatus : (attendanceRecord ? attendanceRecord.status : 'clocked-out')

            // OPTIMISTIC LAST ACTIVE: Also show the pending time if applicable for display consistency
            let lastActive = attendanceRecord ? attendanceRecord.clockIn : (staff.lastAttendance ? staff.lastAttendance.clockIn : null)
            if (isMe && pendingClockInForDisplay && (liveStatus === 'clocked-in' || liveStatus === 'on-break')) {
                lastActive = pendingClockInForDisplay.time || pendingClockInForDisplay.date
            }

            // EXPECTED RETURN TIME: Find the active break for this user
            let expectedReturnTime = null
            if (liveStatus === 'on-break' && attendanceRecord && attendanceRecord.breaks) {
                const activeBreak = attendanceRecord.breaks.find((b: any) => !b.endTime)
                if (activeBreak) {
                    expectedReturnTime = activeBreak.expectedReturnTime
                }
            }
            if (isMe && liveStatus === 'on-break' && !expectedReturnTime) {
                // Try to find it in the optimistic record if it's me
                const optimisticBreak = currentAttendance?.breaks?.find((b: any) => !b.endTime)
                if (optimisticBreak) {
                    expectedReturnTime = optimisticBreak.expectedReturnTime
                }
            }

            return {
                ...staff,
                status: liveStatus,
                lastActive: lastActive,
                returnDate: attendanceRecord ? attendanceRecord.returnDate : null,
                expectedReturnTime: expectedReturnTime,
                selectedTimezone: staff.selectedTimezone
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
            // Priority 1: Status Grouping (Clocked In / On Break > Others)
            const priorityStatuses = ["clocked-in", "on-break"]
            const aIsPriority = priorityStatuses.includes(a.status)
            const bIsPriority = priorityStatuses.includes(b.status)

            if (aIsPriority && !bIsPriority) return -1
            if (!aIsPriority && bIsPriority) return 1

            // Priority 2: Secondary sorting based on user selection
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

    const departmentStaff = useMemo(() => {
        if (!userDepartmentId) return sortedStaff
        return sortedStaff.filter((s: any) =>
            s.departmentId === userDepartmentId ||
            (typeof s.department === 'object' && s.department?.id === userDepartmentId)
        )
    }, [sortedStaff, userDepartmentId])

    const uniqueDepartments = Array.from(new Set(
        employees
            .filter((e: any) => !e.isArchived)
            .map((e: any) => {
                if (typeof e.department === 'string') return e.department
                return e.department?.name
            })
            .filter((d): d is string => typeof d === 'string' && d.length > 0)
    )).sort()

    // --- Team Calendar Logic ---
    useEffect(() => {
        if (userDepartmentId) {
            fetchMonthlyData()
        }
    }, [userDepartmentId, currentMonth, userManagerId]) // Re-fetch when context changes

    const fetchMonthlyData = async () => {
        // Fetch Attendance and Leaves for the Department (+ Manager) for the current month
        try {
            const start = startOfMonth(currentMonth)
            const end = endOfMonth(currentMonth)

            // 1. Fetch Department Data
            const deptQuery = new URLSearchParams({
                departmentId: userDepartmentId,
                startDate: start.toISOString(),
                endDate: end.toISOString()
            })

            const [deptAttRes, deptLeaveRes] = await Promise.all([
                fetch(`/api/attendance?${deptQuery.toString()}`),
                fetch(`/api/leaves?${deptQuery.toString()}`)
            ])

            let newMonthlyAttendance: any[] = []
            let newTeamLeaves: any[] = []

            if (deptAttRes.ok) newMonthlyAttendance = await deptAttRes.json()
            if (deptLeaveRes.ok) newTeamLeaves = await deptLeaveRes.json()

            // 2. Fetch Manager Data (if not in department)
            // Note: Optimally we'd do this in one API call, but separate is easier for now
            if (userManagerId) {
                // Check if manager is already in the fetched data (by ID) to avoid duplicates
                // But simpler to just fetch specific userId and merge, filtering duplicates later
                const mgrQuery = new URLSearchParams({
                    userId: userManagerId,
                    startDate: start.toISOString(),
                    endDate: end.toISOString()
                })
                const [mgrAttRes, mgrLeaveRes] = await Promise.all([
                    fetch(`/api/attendance?${mgrQuery.toString()}`),
                    fetch(`/api/leaves?${mgrQuery.toString()}`)
                ])

                if (mgrAttRes.ok) newMonthlyAttendance = [...newMonthlyAttendance, ...(await mgrAttRes.json())]
                if (mgrLeaveRes.ok) newTeamLeaves = [...newTeamLeaves, ...(await mgrLeaveRes.json())]
            }

            // Deduplicate by ID
            const uniqueAttMap = new Map()
            newMonthlyAttendance.forEach(a => uniqueAttMap.set(a.id, a))
            setMonthlyAttendance(Array.from(uniqueAttMap.values()))

            const uniqueLeaveMap = new Map()
            newTeamLeaves.forEach(l => uniqueLeaveMap.set(l.id, l))
            setTeamApprovedLeaves(Array.from(uniqueLeaveMap.values()))

        } catch (error) {
            console.error("Failed to fetch team calendar data", error)
        }
    }

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
        const leaves = teamApprovedLeaves.filter((leave: any) =>
            isWithinInterval(date, {
                start: parseISO(leave.startDate),
                end: parseISO(leave.endDate)
            })
        ).map((l: any) => ({ type: 'leave', data: l }))

        // Attendance (Present)
        const attendance = monthlyAttendance.filter((a: any) => {
            const attDate = a.date ? a.date.split('T')[0] : (a.clockIn ? a.clockIn.split('T')[0] : null)
            return attDate === dateStr
        }).map((a: any) => ({ type: 'present', data: a }))

        const events: any[] = [...leaves, ...attendance]

        // Holidays
        if (NSW_HOLIDAYS_2026[dateStr]) {
            events.unshift({ type: 'holiday', name: NSW_HOLIDAYS_2026[dateStr], data: null })
        }

        return events
    }

    // --- Derived State for UI ---

    // Flatten attendance records into a chronological activity feed
    const activityFeed = [
        ...userAttendanceList.flatMap((record: any) => {
            const events = []

            // 1. Clock In
            if (record.clockIn) {
                events.push({
                    type: 'clock-in',
                    timestamp: record.clockIn,
                    label: 'Clocked In',
                    mode: record.mode,
                    locationDetails: record.locationDetails,
                    isPending: false
                })
            }

            // 2. Break Start
            if (record.breakStart) {
                events.push({
                    type: 'break-start',
                    timestamp: record.breakStart,
                    label: 'Started Break',
                    isPending: false
                })
            }

            // 3. Break End
            if (record.breakEnd) {
                events.push({
                    type: 'break-end',
                    timestamp: record.breakEnd,
                    label: 'Ended Break',
                    isPending: false
                })
            }

            // 4. Clock Out
            if (record.clockOut) {
                events.push({
                    type: 'clock-out',
                    timestamp: record.clockOut,
                    label: 'Clocked Out',
                    isPending: false
                })
            }

            // Handle Leaves
            if (record.mode === 'LEAVE') {
                events.push({
                    type: 'leave-start',
                    timestamp: record.date ? `${record.date}T09:00:00` : new Date().toISOString(),
                    label: `On Leave (${record.type || 'Approved'})`,
                    isPending: false
                })
            }

            return events
        }),
        // Add Pending Attendance Requests to Feed
        ...myAttendanceRequests.map((req: any) => {
            // Map request types to labels
            let label = 'Request Pending'
            let type = 'request-pending'

            if (req.type === 'CLOCK_IN') {
                label = 'Clock In Request'
                type = 'clock-in-pending'
            } else if (req.type === 'CLOCK_OUT') {
                label = 'Clock Out Request'
                type = 'clock-out-pending'
            } else if (req.type === 'BREAK_START') {
                label = 'Break Start Request'
                type = 'break-start-pending'
            } else if (req.type === 'BREAK_END') {
                label = 'Break End Request'
                type = 'break-end-pending'
            }

            return {
                type,
                timestamp: req.time || req.date, // Use the requested time
                label,
                isPending: true
            }
        })
    ]
        .filter(event => {
            // Ensure strictly TODAY'S records are shown (using PHT)
            if (!event.timestamp) return false
            const todayPHT = new Date().toLocaleDateString("en-CA", { timeZone: userTimeZone })
            const eventPHT = new Date(event.timestamp).toLocaleDateString("en-CA", { timeZone: userTimeZone })
            return eventPHT === todayPHT
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        // De-duplicate: Remove pending requests if a real event exists at the same time (within 1 min)
        .filter((event, _, allEvents) => {
            if (!event.isPending) return true

            // Check if a real event of similar type exists nearby
            const hasRealDuplicate = allEvents.some(realEvent =>
                !realEvent.isPending &&
                Math.abs(new Date(realEvent.timestamp).getTime() - new Date(event.timestamp).getTime()) < 60000 && // 1 minute tolerance
                (
                    (event.type === 'clock-in-pending' && realEvent.type === 'clock-in') ||
                    (event.type === 'clock-out-pending' && realEvent.type === 'clock-out') ||
                    (event.type === 'break-start-pending' && realEvent.type === 'break-start') ||
                    (event.type === 'break-end-pending' && realEvent.type === 'break-end')
                )
            )
            return !hasRealDuplicate
        })


    // Aliases for new UI Actions
    const clockIn = () => confirmClockIn('OFFICE')
    const clockOut = () => handleAction('clock-out')
    const breakStart = () => {
        setBreakReturnTime("")
        setShowBreakStartDialog(true)
    }
    const breakEnd = () => handleAction('end-break')
    const handleLeaveSubmit = requestLeave
    useEffect(() => {
        const action = searchParams.get('action')
        if (action === 'endBreak' && !hasAutoActionRun && session?.user?.id) {
            handleAction('end-break')
            setHasAutoActionRun(true)
            toast.info("Processing your request to end break...")
            router.replace('/user')
        }
    }, [searchParams, session, hasAutoActionRun])


    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
                <div className="h-20 w-20 rounded-[2.5rem] bg-[#8B2323] flex items-center justify-center shadow-2xl border-4 border-white/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent" />
                    <Loader2 className="h-10 w-10 animate-spin text-white relative z-10" />
                </div>
                <div className="flex flex-col items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#8B2323] animate-pulse">
                        Synchronizing Systems
                    </p>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-50">
                        Preparing your workspace
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 w-full">
            {/* Header */}
            <div id="tour-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                            timeZone: userTimeZone
                        }) : "Loading..."}
                    </p>
                </div>
                <Badge id="tour-status-badge" variant="outline" className={`${getStatusColor()} px-4 py-1.5 text-sm font-medium border`}>
                    {getStatusText()}
                </Badge>
            </div>


            {/* Dashboard Primary Row: Time Tracker + Activity Timeline */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-stretch">
                {/* Time Tracker */}
                <Card id="tour-time-tracker" className="xl:col-span-2 border-2 border-border shadow-xl shadow-slate-100/50 rounded-[2rem] overflow-hidden bg-white">
                    <CardHeader className="pb-4 border-b border-border">
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                                    <Clock className="w-5 h-5 text-primary" />
                                    Time Tracker
                                </CardTitle>
                                <CardDescription className="text-sm text-muted-foreground">Manage your attendance for today</CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                                {userProfile?.shiftStartTime && userProfile?.shiftEndTime && (
                                    <div className="flex items-center gap-3 bg-red-50/50 px-4 py-2 rounded-xl border border-red-100/50 shadow-sm shadow-red-500/5">
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-red-600/60 uppercase tracking-widest mb-0.5">Work Hours</p>
                                            <p className="text-sm font-mono font-bold text-red-900 flex items-center gap-1.5">
                                                <Briefcase className="w-3 h-3 text-red-500" />
                                                {userProfile.shiftStartTime} - {userProfile.shiftEndTime}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowScheduleInput(!showScheduleInput)}
                                            className="h-8 w-8 p-0 hover:bg-red-100/50 rounded-lg transition-all"
                                        >
                                            <Edit className="w-3.5 h-3.5 text-red-600" />
                                        </Button>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 bg-slate-50/80 px-4 py-2 rounded-xl border border-slate-200/60 shadow-sm shadow-slate-500/5">
                                    <div className="text-left">
                                        <p className="text-[9px] font-black text-slate-500/60 uppercase tracking-widest mb-0.5">Current Time</p>
                                        <p className="text-sm font-mono font-bold text-slate-700 flex items-center gap-1.5">
                                            <Globe className="w-3 h-3 text-primary/60" />
                                            {currentTime ? currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: userTimeZone }) : "--:--:--"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Edit Work Hours - Collapsible Section */}
                        {showScheduleInput && (
                            <div className="mt-4 p-4 bg-[#FFF5F5] border border-red-100 rounded-xl space-y-3 animate-in slide-in-from-top-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-[#8B2323]">Edit Work Hours</p>
                                        <p className="text-xs text-red-600/80 mt-0.5">Update your default shift timings</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowScheduleInput(false)}
                                        className="h-7 w-7 p-0 hover:bg-red-100"
                                    >
                                        <X className="w-4 h-4 text-[#8B2323]" />
                                    </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-[#8B2323]">Start Time</Label>
                                        <Input
                                            type="time"
                                            value={scheduledStart}
                                            onChange={(e) => setScheduledStart(e.target.value)}
                                            className="h-10 font-mono font-semibold border-red-200 focus:border-[#8B2323] bg-white"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-[#8B2323]">End Time</Label>
                                        <Input
                                            type="time"
                                            value={scheduledEnd}
                                            onChange={(e) => setScheduledEnd(e.target.value)}
                                            className="h-10 font-mono font-semibold border-red-200 focus:border-[#8B2323] bg-white"
                                        />
                                    </div>
                                </div>
                                <Button
                                    onClick={handleUpdateWorkHours}
                                    className="w-full h-10 bg-[#8B2323] hover:bg-[#701c1c] text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-red-900/10"
                                >
                                    <Check className="w-4 h-4 mr-2" />
                                    Save Changes
                                </Button>
                            </div>
                        )}

                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="flex flex-col gap-8">
                            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                <div className="text-center p-4 sm:p-6 rounded-xl bg-[#FDFBF7] border border-[#F2EFE9] overflow-hidden min-w-0 flex-1 hidden">
                                    <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Current Time</p>
                                    <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-mono font-medium text-foreground whitespace-nowrap tabular-nums tracking-tight">
                                        {currentTime ? currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: userTimeZone }) : "--:--:--"}
                                    </p>
                                </div>
                                {(optimisticStatus === 'clocked-in' || optimisticStatus === 'on-break') && (
                                    <div className="text-center p-4 sm:p-6 rounded-xl bg-[#EFF6F2] border border-[#E0EBE3] overflow-hidden min-w-0 flex-1">
                                        <p className="text-[10px] sm:text-xs font-bold text-[#006E3F] uppercase tracking-widest mb-3">clocked in at</p>
                                        <p className="text-xl sm:text-2xl md:text-3xl lg:text-3xl font-bold text-[#00522F] whitespace-nowrap tabular-nums">
                                            {pendingClockInForDisplay
                                                ? formatTime(new Date(pendingClockInForDisplay.time || pendingClockInForDisplay.date))
                                                : currentAttendance?.clockIn ? formatTime(new Date(currentAttendance.clockIn)) : "--:--"
                                            }
                                        </p>
                                    </div>
                                )}
                                {optimisticStatus === 'on-break' && (
                                    <div className="text-center p-4 sm:p-6 rounded-xl bg-[#FEF9F0] border border-[#F5EAD9] overflow-hidden min-w-0 flex-1">
                                        <p className="text-[10px] sm:text-xs font-bold text-[#9A7033] uppercase tracking-widest mb-3">Break Started</p>
                                        <p className="text-xl sm:text-2xl md:text-3xl lg:text-3xl font-bold text-[#765424] whitespace-nowrap tabular-nums">
                                            {(() => {
                                                if (currentAttendance?.breakStart) return formatTime(new Date(currentAttendance.breakStart))
                                                const todayPHT = new Date().toLocaleDateString("en-CA", { timeZone: userTimeZone })
                                                const pending = myAttendanceRequests.find((r: any) => r.type === 'BREAK_START' && r.status === 'PENDING' && new Date(r.time || r.date).toLocaleDateString("en-CA", { timeZone: userTimeZone }) === todayPHT)
                                                return pending ? formatTime(new Date(pending.time || pending.date)) : formatTime(new Date())
                                            })()}
                                        </p>
                                        {(() => {
                                            // Show Expected Return if available
                                            const activeBreak = currentAttendance?.breaks?.find((b: any) => !b.endTime)
                                            if (activeBreak?.expectedReturnTime) {
                                                const returnTime = new Date(activeBreak.expectedReturnTime)
                                                return (
                                                    <p className="text-[10px] sm:text-xs font-bold text-[#765424] mt-1">
                                                        Expected Return: {returnTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: userTimeZone })}
                                                    </p>
                                                )
                                            }
                                            return null
                                        })()}
                                    </div>
                                )}
                            </div>

                            {/* Scheduled Work Times Section */}


                            <div id="tour-action-buttons" className="flex flex-wrap gap-4 items-center">
                                {['clocked-out', 'on-leave'].includes(optimisticStatus) && (
                                    <div className="flex items-center shadow-lg shadow-green-900/10 rounded-xl transition-all active:scale-95 bg-[#009B5A] hover:bg-[#00874e] group">
                                        <Button onClick={handleClockInClick} disabled={isProcessing} className="gap-2 bg-transparent hover:bg-transparent text-white h-14 px-8 text-base font-semibold border-r border-green-600/30 rounded-r-none focus:ring-0">
                                            {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                                            Clock In
                                        </Button>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button disabled={isProcessing} className="px-3 h-14 bg-transparent hover:bg-[#007041] text-white rounded-l-none focus:ring-0">
                                                    <ChevronDown className="h-5 w-5" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80 p-0 rounded-2xl shadow-xl border-border overflow-hidden" align="end">
                                                <div className="bg-[#8B2323] p-4 text-center relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
                                                    <p className="text-white font-black uppercase tracking-widest text-[10px] relative z-10">Request Amendment</p>
                                                </div>
                                                <div className="p-4 space-y-4 bg-white">
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Time of Entry</Label>
                                                        <Input type="time" value={customClockInTime} onChange={(e) => setCustomClockInTime(e.target.value)} className="h-10 bg-white border-slate-200 rounded-lg font-mono font-bold text-base" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Reason</Label>
                                                        <Input placeholder="Reason for adjustment..." value={customReason} onChange={(e) => setCustomReason(e.target.value)} className="h-10 bg-white border-slate-200 rounded-lg text-xs" />
                                                    </div>
                                                    <Button onClick={() => setShowLocationDialog(true)} className="w-full h-10 bg-[#8B2323] hover:bg-[#701c1c] text-white font-bold text-xs uppercase tracking-widest rounded-lg shadow-md transition-all active:scale-95">Continue</Button>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                )}
                                {optimisticStatus === 'clocked-in' && (
                                    <>
                                        <Button onClick={breakStart} disabled={isProcessing} size="lg" variant="outline" className="gap-2 border-[#D4A056] text-[#9A7033] bg-[#FEF9F0] hover:bg-[#FFFBF5] h-12 px-8 text-base font-semibold rounded-lg flex-1 sm:flex-initial">
                                            {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Coffee className="w-5 h-5" />} Start Break
                                        </Button>
                                        <Button onClick={() => setShowClockOutConfirm(true)} disabled={isProcessing} size="lg" className="gap-2 h-12 px-8 text-base font-semibold rounded-lg shadow-sm bg-[#8B2323] hover:bg-[#701c1c] text-white flex-1 sm:flex-initial">
                                            {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="w-5 h-5" />} Clock Out
                                        </Button>
                                    </>
                                )}
                                {optimisticStatus === 'on-break' && (
                                    <Button onClick={breakEnd} disabled={isProcessing} size="lg" variant="outline" className="gap-2 border-[#D4A056] text-[#9A7033] bg-[#FEF9F0] hover:bg-[#FFFBF5] h-12 px-8 text-base font-semibold rounded-lg w-full sm:w-auto">
                                        {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Timer className="w-5 h-5" />} End Break
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Today's Activity Feed (Relocated) */}
                <Card id="tour-activity-feed" className="xl:col-span-1 border-2 border-border shadow-xl shadow-slate-100/50 rounded-[2rem] overflow-hidden bg-white flex flex-col">
                    <CardHeader className="bg-white border-b border-slate-50 p-6 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold text-foreground">Today's Activity</CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">Your session log</CardDescription>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                        <div className="p-6 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                            {activityFeed.length === 0 ? (
                                <div className="text-center py-12 px-6">
                                    <History className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-slate-400 uppercase">No activity yet</p>
                                </div>
                            ) : (
                                <div className="relative pl-2">
                                    <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-slate-100" />
                                    <div className="space-y-6 relative">
                                        {activityFeed.map((event: any, index: number) => {
                                            const timeString = (() => {
                                                try { return event.timestamp ? new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: userTimeZone }) : '--:--' } catch (e) { return '--:--' }
                                            })()
                                            let dotColorClass = "bg-slate-400";
                                            let labelClass = "text-slate-700";
                                            if (event.type.includes('clock-in')) { dotColorClass = "bg-green-500 shadow-green-100"; labelClass = "text-green-700"; }
                                            else if (event.type.includes('clock-out')) { dotColorClass = "bg-red-500 shadow-red-100"; labelClass = "text-red-700"; }
                                            else if (event.type.includes('break-start')) { dotColorClass = "bg-amber-400 shadow-amber-100"; labelClass = "text-amber-700"; }
                                            else if (event.type.includes('break-end')) { dotColorClass = "bg-blue-400 shadow-blue-100"; labelClass = "text-blue-700"; }

                                            return (
                                                <div key={index} className="relative pl-8 group">
                                                    <div className={cn("absolute left-0 top-1.5 w-[22px] h-[22px] rounded-full border-[3px] border-white shadow-md flex items-center justify-center z-10 transition-transform group-hover:scale-110", dotColorClass)}>
                                                        <div className="w-1 h-1 bg-white rounded-full opacity-50" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className={cn("text-sm font-bold", labelClass)}>
                                                            {event.label}
                                                            {event.mode && (
                                                                <span className="ml-2 text-[10px] font-black uppercase text-slate-400">
                                                                    • {event.mode.replace('_', ' ')}
                                                                    {event.locationDetails && `: ${event.locationDetails}`}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="text-xs font-medium text-slate-400 font-mono">{timeString}</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <Card id="tour-stats-worked" className="border border-border shadow-sm rounded-xl bg-[#EFF6F2]">
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

                <Card id="tour-stats-break" className="border border-border shadow-sm rounded-xl bg-[#FEF9F0]">
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

                <Card id="tour-stats-pending" className="border border-border shadow-sm rounded-xl bg-white">
                    <CardHeader className="pb-2">
                        <div className="flex flex-col gap-1">
                            <CardTitle className="text-sm font-semibold text-foreground">Pending Requests</CardTitle>
                            <p className="text-[10px] text-muted-foreground">Awaiting approval</p>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            {(() => {
                                const pendingLeaves = myLeaveRequests.filter((lr: any) => lr.status === 'PENDING').length
                                return pendingLeaves + myAttendanceRequests.length
                            })()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Requests pending</p>
                    </CardContent>
                </Card>
            </div>



            {/* Dashboard Secondary Section: Staff Table / Calendar */}
            <Tabs defaultValue="overview" className="space-y-6">


                <TabsContent value="overview" className="animate-in fade-in-50 duration-500">
                    <Card className="border-2 border-border shadow-xl shadow-slate-100/50 rounded-[2rem] overflow-hidden bg-white">
                        <CardHeader className="border-b border-border p-6 bg-muted/40 flex flex-col xl:flex-row items-center justify-between gap-4">
                            <div className="flex flex-col sm:flex-row items-center gap-6 w-full xl:w-auto">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-primary">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-bold text-foreground">Staff Availability</CardTitle>
                                        <CardDescription className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Real-time status monitor</CardDescription>
                                    </div>
                                </div>

                                <TabsList className="bg-slate-100 p-1 rounded-xl h-9 self-start sm:self-center">
                                    <TabsTrigger value="overview" className="rounded-lg px-4 h-7 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                        Staff Overview
                                    </TabsTrigger>
                                    <TabsTrigger value="calendar" className="rounded-lg px-4 h-7 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                        Leave Calendar
                                    </TabsTrigger>
                                </TabsList>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">

                            <div className="p-4 border-b border-border bg-slate-50/50 flex flex-wrap items-center gap-4">
                                <div className="relative w-full sm:w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        placeholder="Search staff..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 h-9 bg-white border-slate-200 rounded-lg text-xs font-medium focus-visible:ring-offset-0 focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
                                    />
                                </div>

                                <div className="flex-1 flex flex-wrap items-center gap-2">
                                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                                        <SelectTrigger className="h-9 w-[130px] bg-white border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 focus:ring-1 focus:ring-primary/20 shadow-sm transition-all hover:border-slate-300">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Statuses</SelectItem>
                                            <SelectItem value="clocked-in">Clocked In</SelectItem>
                                            <SelectItem value="on-break">On Break</SelectItem>
                                            <SelectItem value="clocked-out">Clocked Out</SelectItem>
                                            <SelectItem value="on-leave">On Leave</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                                        <SelectTrigger className="h-9 w-[180px] bg-white border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 focus:ring-1 focus:ring-primary/20 shadow-sm transition-all hover:border-slate-300">
                                            <SelectValue placeholder="Department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Departments</SelectItem>
                                            {uniqueDepartments.map((dept: any) => (
                                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="ml-auto flex items-center gap-2">
                                        <Select value={sortBy} onValueChange={setSortBy}>
                                            <SelectTrigger className="h-9 w-[120px] bg-transparent border-transparent hover:bg-slate-200/50 rounded-lg text-xs font-bold text-slate-500 shadow-none focus:ring-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black uppercase text-slate-300">Sort:</span>
                                                    <SelectValue />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="name">Name</SelectItem>
                                                <SelectItem value="status">Status</SelectItem>
                                                <SelectItem value="department">Department</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-[300px] pl-6 h-12 text-[10px] font-black uppercase tracking-widest text-slate-400">Employee</TableHead>
                                        <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</TableHead>
                                        <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-slate-400">Base Location</TableHead>
                                        <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-slate-400">Department</TableHead>
                                        <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right pr-24">Last Active</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedStaff.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-muted-foreground text-sm italic font-medium">
                                                No staff found matching your criteria
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        sortedStaff.map((staff: any) => {
                                            const isOnline = staff.status === 'clocked-in' || staff.status === 'on-break'
                                            // Ensure we check availabilityStatus existence, default to AVAILABLE if online
                                            const effectiveStatus = isOnline ? (staff.availabilityStatus || 'AVAILABLE') : 'APPEAR_OFFLINE'
                                            const statusConfigItem = statusConfig[effectiveStatus as keyof typeof statusConfig]

                                            return (
                                                <TableRow key={staff.id} className="group hover:bg-slate-50/80 transition-colors cursor-default border-b-slate-100">
                                                    <TableCell className="pl-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative">
                                                                <Avatar className="h-9 w-9 border-2 border-white shadow-sm group-hover:border-slate-200 transition-colors">
                                                                    <AvatarFallback className="bg-slate-100 text-slate-600 text-xs font-bold">
                                                                        {staff.name?.slice(0, 2).toUpperCase() || "EQ"}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                {/* Status Dot */}
                                                                {statusConfigItem && (
                                                                    <div className={`absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-100 z-10`} title={statusConfigItem.label}>
                                                                        <statusConfigItem.icon className={`h-3 w-3 ${statusConfigItem.color}`} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-sm font-bold text-slate-700 leading-none">{staff.name}</p>
                                                                    {/* Custom Status Message */}
                                                                    {(isOnline && (staff.customStatusMessage || (statusConfigItem && statusConfigItem.label !== 'Active'))) && (
                                                                        <span className="text-[10px] text-muted-foreground/80 font-medium px-1.5 py-0.5 bg-slate-100 rounded-full scale-90 origin-left">
                                                                            {staff.customStatusMessage || statusConfigItem?.label}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-[10px] font-medium text-slate-400 mt-1">{staff.email}</p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {getStaffStatusBadge(staff.status)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <MapPin className="h-3 w-3 text-slate-400" />
                                                                <span className="text-sm font-semibold text-slate-600">
                                                                    {staff.location || 'N/A'}
                                                                </span>
                                                            </div>
                                                            {isOnline && staff.record?.mode && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <Badge variant="outline" className="text-[9px] font-black border-slate-200 text-slate-500 uppercase px-1.5 h-5">
                                                                        {staff.record.mode}
                                                                    </Badge>
                                                                    {staff.record.locationDetails && (
                                                                        <span className="text-[10px] font-medium text-slate-400 truncate max-w-[100px]" title={staff.record.locationDetails}>
                                                                            {staff.record.locationDetails}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            <Badge variant="secondary" className="w-fit text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border-none px-2.5 py-0.5 rounded-md not-italic shadow-sm">
                                                                {typeof staff.department === 'string' ? staff.department : staff.department?.name || "Unassigned"}
                                                            </Badge>
                                                            {staff.status === 'on-break' && staff.expectedReturnTime && (
                                                                <span className="text-[9px] font-bold text-amber-600/80 uppercase tracking-widest pl-1">
                                                                    Exp. Return: {new Date(staff.expectedReturnTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: userTimeZone })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-24">
                                                        {staff.lastActive ? (
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-xs font-bold text-slate-600 font-mono">
                                                                    {new Date(staff.lastActive).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: staff.selectedTimezone || userTimeZone })}
                                                                </span>
                                                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                                                                    {new Date(staff.lastActive).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: staff.selectedTimezone || userTimeZone })}
                                                                    {staff.selectedTimezone && (
                                                                        <span className="ml-1 text-[9px] font-black text-slate-300">
                                                                            {(() => {
                                                                                try {
                                                                                    const parts = new Intl.DateTimeFormat('en-US', { timeZone: staff.selectedTimezone, timeZoneName: 'short' }).formatToParts(new Date())
                                                                                    const tz = parts.find(p => p.type === 'timeZoneName')?.value
                                                                                    // Strip "Standard Time" or "Daylight Time" if it's too long, or just keep initials if possible.
                                                                                    // Usually 'short' gives PST, EST, GMT+8 etc.
                                                                                    return tz || 'Local'
                                                                                } catch (e) { return 'Local' }
                                                                            })()}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs font-mono font-medium text-slate-400">--:--</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="calendar" className="animate-in fade-in-50 duration-500">
                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                        <Card className="xl:col-span-3 border-2 border-border shadow-xl shadow-slate-100/50 rounded-[2rem] overflow-hidden bg-white">
                            <CardHeader className="border-b border-border p-6 bg-muted/40">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col gap-1">
                                            {/* Department Filter for Calendar */}
                                            <Select value={calendarFilterDepartment} onValueChange={setCalendarFilterDepartment}>
                                                <SelectTrigger className="h-9 w-[180px] bg-white border-slate-200 rounded-lg text-xs font-bold uppercase tracking-wide text-slate-600 focus:ring-0 shadow-sm">
                                                    <SelectValue placeholder="Department" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Departments</SelectItem>
                                                    {uniqueDepartments.map((dept: any) => (
                                                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <TabsList className="bg-slate-100 p-1 rounded-xl h-9">
                                            <TabsTrigger value="overview" className="rounded-lg px-4 h-7 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                                Staff Overview
                                            </TabsTrigger>
                                            <TabsTrigger value="calendar" className="rounded-lg px-4 h-7 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                                Leave Calendar
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                                            <ChevronDown className="h-4 w-4 rotate-90" />
                                        </Button>
                                        <span className="text-sm font-bold min-w-[120px] text-center">
                                            {format(currentMonth, 'MMMM yyyy')}
                                        </span>
                                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                                            <ChevronDown className="h-4 w-4 -rotate-90" />
                                        </Button>
                                    </div>
                                </div>
                                {/* Legend */}
                                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Approved Leave</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pending Approval</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Public Holiday</span>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="grid grid-cols-7 border-b border-border bg-slate-50/50">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                        <div key={day} className="py-3 text-[10px] font-black uppercase tracking-[0.2em] text-center text-slate-400">
                                            {day}
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 auto-rows-fr">
                                    {calendarDays.map((day, i) => {
                                        const dateStr = format(day, 'yyyy-MM-dd')

                                        // 1. Paid Leaves (Approved) - Exclude SICK, Filter Dept
                                        const approvedLeaves = teamApprovedLeaves.filter((leave: any) => {
                                            if (leave.type === 'SICK' || leave.status !== 'APPROVED') return false

                                            // Dept Filter
                                            if (calendarFilterDepartment !== 'all') {
                                                const staff = employees.find((e: any) => e.id === leave.userId || e.id === leave.user?.id)
                                                const dept = staff?.department?.name || staff?.department || "Unassigned"
                                                if (dept !== calendarFilterDepartment) return false
                                            }

                                            return isWithinInterval(day, {
                                                start: parseISO(leave.startDate),
                                                end: parseISO(leave.endDate)
                                            })
                                        }).map((l: any) => ({ type: 'leave-approved', data: l }))

                                        // 2. Pending Leaves - Exclude SICK, Filter Dept
                                        const pendingLeaves = teamApprovedLeaves.filter((leave: any) => {
                                            if (leave.type === 'SICK' || leave.status !== 'PENDING') return false

                                            // Dept Filter
                                            if (calendarFilterDepartment !== 'all') {
                                                const staff = employees.find((e: any) => e.id === leave.userId || e.id === leave.user?.id)
                                                const dept = staff?.department?.name || staff?.department || "Unassigned"
                                                if (dept !== calendarFilterDepartment) return false
                                            }

                                            return isWithinInterval(day, {
                                                start: parseISO(leave.startDate),
                                                end: parseISO(leave.endDate)
                                            })
                                        }).map((l: any) => ({ type: 'leave-pending', data: l }))

                                        const events: any[] = [...approvedLeaves, ...pendingLeaves]

                                        // Holidays
                                        if (NSW_HOLIDAYS_2026[dateStr]) {
                                            events.unshift({ type: 'holiday', name: NSW_HOLIDAYS_2026[dateStr], data: null })
                                        }

                                        const isCurrentMonth = isSameMonth(day, currentMonth)
                                        const isTodayDay = isToday(day)

                                        return (
                                            <div
                                                key={i}
                                                onClick={() => setSelectedDayDetail(day)}
                                                className={cn(
                                                    "min-h-[100px] p-2 border-r border-b border-border transition-colors hover:bg-slate-50 cursor-pointer relative",
                                                    !isCurrentMonth && "bg-slate-50/30 opacity-40"
                                                )}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className={cn(
                                                        "text-xs font-bold",
                                                        isTodayDay ? "bg-[#8B2323] text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md scale-110" : "text-slate-500",
                                                        !isCurrentMonth && "text-slate-300"
                                                    )}>
                                                        {format(day, 'd')}
                                                    </span>
                                                </div>
                                                <div className="space-y-1 overflow-hidden">
                                                    {events.slice(0, 3).map((event: any, idx: number) => (
                                                        <div key={idx} className={cn(
                                                            "text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md truncate border",
                                                            event.type === 'holiday' ? "bg-red-50 text-red-600 border-red-100" :
                                                                event.type === 'leave-approved' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                                                    event.type === 'leave-pending' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                                                        "bg-slate-50 text-slate-600 border-slate-100"
                                                        )}>
                                                            {event.type === 'holiday' ? event.name : (event.data.userName || event.data.name || 'Staff')}
                                                        </div>
                                                    ))}
                                                    {events.length > 3 && (
                                                        <p className="text-[8px] font-bold text-slate-400 pl-1">+{events.length - 3} more...</p>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex flex-col gap-6 h-full">
                            {/* Team Status Card inside Calendar Tab */}
                            <Card className="border-2 border-border shadow-md rounded-[2rem] overflow-hidden bg-white h-full flex flex-col">
                                <CardHeader className="bg-slate-50/50 border-b border-border p-5">
                                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                                        <Users className="w-4 h-4 text-primary" />
                                        Team Status
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 flex-1 flex flex-col justify-center">
                                    {departmentStaff.length === 0 ? (
                                        <div className="text-center py-12 px-4 space-y-3">
                                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto border border-slate-100">
                                                <Users className="w-6 h-6 text-slate-300" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">No Data Available</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-6 rounded-[2rem] bg-green-50/50 border border-green-100 flex flex-col items-center justify-center shadow-sm">
                                                <span className="text-3xl font-black text-green-700">{departmentStaff.filter((s: any) => s.status === 'present' || s.status === 'clocked-in' || s.status === 'Working').length}</span>
                                                <span className="text-[10px] font-bold text-green-600 uppercase tracking-[0.2em] mt-2">Clocked In</span>
                                            </div>
                                            <div className="p-6 rounded-[2rem] bg-amber-50/50 border border-amber-100 flex flex-col items-center justify-center shadow-sm">
                                                <span className="text-3xl font-black text-amber-700">{departmentStaff.filter((s: any) => s.status === 'break' || s.status === 'on-break' || s.status === 'On Break').length}</span>
                                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-[0.2em] mt-2">On Break</span>
                                            </div>
                                            <div className="p-6 rounded-[2rem] bg-blue-50/50 border border-blue-100 flex flex-col items-center justify-center shadow-sm">
                                                <span className="text-3xl font-black text-blue-700">{departmentStaff.filter((s: any) => s.status === 'on-leave' || s.status === 'On Leave' || s.status === 'leave').length}</span>
                                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em] mt-2">On Leave</span>
                                            </div>
                                            <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100 flex flex-col items-center justify-center shadow-sm">
                                                <span className="text-3xl font-black text-slate-700">{departmentStaff.filter((s: any) => s.status === 'absent' || s.status === 'clocked-out' || s.status === 'Off Duty' || s.status === 'offline').length}</span>
                                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mt-2">Clocked Out</span>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Clock Out Confirmation Dialog */}
            <Dialog open={showClockOutConfirm} onOpenChange={setShowClockOutConfirm}>
                <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-[#8B2323] p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
                        <AlertTriangle className="h-12 w-12 text-white/20 mx-auto mb-4" />
                        <DialogTitle className="text-2xl font-black text-white uppercase tracking-tight relative z-10">Confirm Clock Out</DialogTitle>
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
                                className="w-full h-14 bg-[#8B2323] hover:bg-[#701c1c] text-white font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest"
                            >
                                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : "Yes, Clock Out Now"}
                            </Button>

                            <Button
                                variant="ghost"
                                onClick={() => setShowClockOutConfirm(false)}
                                className="w-full text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-slate-900"
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
                        <DialogTitle className="text-2xl font-black text-white uppercase tracking-tight relative z-10">Select Work Location</DialogTitle>
                        <DialogDescription className="text-slate-300 font-bold text-[9px] uppercase tracking-[0.3em] mt-2 relative z-10 leading-relaxed">
                            Specify your base of operations for this session
                        </DialogDescription>
                    </div>

                    <div className="p-8 space-y-4 bg-white">
                        {customClockInTime && (
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4 space-y-3">
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Time of Entry</Label>
                                    <Input
                                        type="time"
                                        value={customClockInTime}
                                        onChange={(e) => setCustomClockInTime(e.target.value)}
                                        className="h-12 bg-white border-slate-200 rounded-xl font-mono font-bold text-lg"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Amendment Reason (Optional)</Label>
                                    <Input
                                        placeholder="Required if adjusting time..."
                                        value={customReason}
                                        onChange={(e) => setCustomReason(e.target.value)}
                                        className="bg-white border-slate-200 rounded-xl text-xs"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                onClick={() => confirmClockIn('OFFICE')}
                                disabled={isProcessing}
                                variant="outline"
                                className={cn(
                                    "h-32 flex flex-col items-center justify-center gap-3 border-2 transition-all rounded-[1.5rem] group",
                                    selectedLocationMode === 'OFFICE' ? "border-slate-900 bg-slate-50 shadow-inner" : "border-[#F2EFE9] bg-[#FDFBF7] hover:border-slate-900 hover:bg-white"
                                )}
                            >
                                <div className={cn("p-3 border rounded-xl transition-colors duration-300",
                                    selectedLocationMode === 'OFFICE' ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-100 group-hover:bg-slate-900 group-hover:text-white"
                                )}>
                                    <Building2 className="w-6 h-6" />
                                </div>
                                <span className="font-black uppercase tracking-widest text-[10px] text-slate-700">In Office</span>
                            </Button>

                            <Button
                                onClick={() => confirmClockIn('WFH')}
                                disabled={isProcessing}
                                variant="outline"
                                className={cn(
                                    "h-32 flex flex-col items-center justify-center gap-3 border-2 transition-all rounded-[1.5rem] group",
                                    selectedLocationMode === 'WFH' ? "border-slate-900 bg-slate-50 shadow-inner" : "border-[#F2EFE9] bg-[#FDFBF7] hover:border-slate-900 hover:bg-white"
                                )}
                            >
                                <div className={cn("p-3 border rounded-xl transition-colors duration-300",
                                    selectedLocationMode === 'WFH' ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-100 group-hover:bg-slate-900 group-hover:text-white"
                                )}>
                                    <MapPin className="w-6 h-6" />
                                </div>
                                <span className="font-black uppercase tracking-widest text-[10px] text-slate-700">WFH</span>
                            </Button>

                            <Button
                                onClick={() => setSelectedLocationMode('ONSITE')}
                                disabled={isProcessing}
                                variant="outline"
                                className={cn(
                                    "h-32 flex flex-col items-center justify-center gap-3 border-2 transition-all rounded-[1.5rem] group",
                                    selectedLocationMode === 'ONSITE' ? "border-slate-900 bg-slate-50 shadow-inner" : "border-[#F2EFE9] bg-[#FDFBF7] hover:border-slate-900 hover:bg-white"
                                )}
                            >
                                <div className={cn("p-3 border rounded-xl transition-colors duration-300",
                                    selectedLocationMode === 'ONSITE' ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-100 group-hover:bg-slate-900 group-hover:text-white"
                                )}>
                                    <Briefcase className="w-6 h-6" />
                                </div>
                                <span className="font-black uppercase tracking-widest text-[10px] text-slate-700">Onsite</span>
                            </Button>

                            <Button
                                onClick={() => setSelectedLocationMode('OTHER')}
                                disabled={isProcessing}
                                variant="outline"
                                className={cn(
                                    "h-32 flex flex-col items-center justify-center gap-3 border-2 transition-all rounded-[1.5rem] group",
                                    selectedLocationMode === 'OTHER' ? "border-slate-900 bg-slate-50 shadow-inner" : "border-[#F2EFE9] bg-[#FDFBF7] hover:border-slate-900 hover:bg-white"
                                )}
                            >
                                <div className={cn("p-3 border rounded-xl transition-colors duration-300",
                                    selectedLocationMode === 'OTHER' ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-100 group-hover:bg-slate-900 group-hover:text-white"
                                )}>
                                    <MoreHorizontal className="w-6 h-6" />
                                </div>
                                <span className="font-black uppercase tracking-widest text-[10px] text-slate-700">Other</span>
                            </Button>
                        </div>

                        {selectedLocationMode === 'ONSITE' && (
                            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300 border-2 border-slate-900/10 p-4 rounded-3xl bg-slate-50">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Location or Job Number</Label>
                                    <Input
                                        placeholder="e.g. Westfield Knox - Job #2234332"
                                        value={locationDetails}
                                        onChange={(e) => setLocationDetails(e.target.value)}
                                        className="h-12 bg-white border-slate-200 rounded-xl font-bold text-sm"
                                        autoFocus
                                    />
                                </div>
                                <Button
                                    onClick={() => confirmClockIn('ONSITE')}
                                    disabled={!locationDetails.trim() || isProcessing}
                                    className="w-full h-12 bg-slate-900 text-white font-black rounded-xl uppercase tracking-widest text-[10px]"
                                >
                                    Confirm Onsite Clock In
                                </Button>
                            </div>
                        )}

                        {selectedLocationMode === 'OTHER' && (
                            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300 border-2 border-slate-900/10 p-4 rounded-3xl bg-slate-50">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Location Details</Label>
                                    <Input
                                        placeholder="Specify your current location..."
                                        value={locationDetails}
                                        onChange={(e) => setLocationDetails(e.target.value)}
                                        className="h-12 bg-white border-slate-200 rounded-xl font-bold text-sm"
                                        autoFocus
                                    />
                                </div>
                                <Button
                                    onClick={() => confirmClockIn('OTHER')}
                                    disabled={!locationDetails.trim() || isProcessing}
                                    className="w-full h-12 bg-slate-900 text-white font-black rounded-xl uppercase tracking-widest text-[10px]"
                                >
                                    Confirm Other Clock In
                                </Button>
                            </div>
                        )}

                        <Button
                            variant="ghost"
                            onClick={() => setShowLocationDialog(false)}
                            className="w-full text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground hover:text-slate-900 mt-2"
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
                        <DialogTitle className="text-2xl font-black text-white uppercase tracking-tight relative z-10">Request Leave</DialogTitle>
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
                                        <SelectItem value="SICK">Sick / Personal Leave</SelectItem>
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
                                    <Input type="date" value={leaveStartDate} onChange={e => setLeaveStartDate(e.target.value)} required className="h-12 bg-muted/40 border-border rounded-xl font-bold text-[10px] uppercase tracking-widest" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">End Date</Label>
                                    <Input type="date" value={leaveEndDate} onChange={e => setLeaveEndDate(e.target.value)} required className="h-12 bg-muted/40 border-border rounded-xl font-bold text-[10px] uppercase tracking-widest" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Reason</Label>
                                <Textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)} placeholder="Please detail the reason for your absence request..." className="min-h-[100px] resize-none bg-slate-50 border-slate-100 rounded-xl font-bold text-[10px] uppercase tracking-widest p-4" />
                            </div>
                        </div>
                        <Button type="submit" className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest">Submit Request</Button>
                    </form>
                </DialogContent>
            </Dialog >

            {/* Break Time Warning/Limit Dialog */}
            <Dialog open={showBreakStartDialog} onOpenChange={setShowBreakStartDialog}>
                <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-[#D4A056] p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 to-transparent" />
                        <Coffee className="h-12 w-12 text-white/30 mx-auto mb-4" />
                        <DialogTitle className="text-2xl font-black text-white uppercase tracking-tight relative z-10">
                            Start Break
                        </DialogTitle>
                        <DialogDescription className="text-white/80 font-bold text-[10px] uppercase tracking-widest mt-2 relative z-10">
                            Taking a moment to recharge?
                        </DialogDescription>
                    </div>
                    <div className="p-8 space-y-6 bg-white">
                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Expected Return Time (Optional)</Label>
                            <Input
                                type="time"
                                value={breakReturnTime}
                                onChange={(e) => setBreakReturnTime(e.target.value)}
                                className="h-12 bg-muted/40 border-border rounded-xl font-bold text-lg text-center"
                            />
                            <p className="text-[10px] text-muted-foreground text-center">
                                Providing this helps your team know when to expect you back.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                variant="outline"
                                onClick={() => setShowBreakStartDialog(false)}
                                disabled={isProcessing}
                                className="h-14 font-black uppercase tracking-widest rounded-xl"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={async () => {
                                    await handleAction('start-break');
                                    setShowBreakStartDialog(false);
                                }}
                                disabled={isProcessing}
                                className="h-14 bg-[#D4A056] hover:bg-[#b88640] text-white font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest"
                            >
                                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : "Start Break"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showBreakDialog} onOpenChange={setShowBreakDialog} >
                <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                    <div className={cn(
                        "p-8 text-center relative overflow-hidden transition-colors duration-500",
                        "bg-[#D4A056]"
                    )}>
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 to-transparent" />
                        <Coffee className="h-12 w-12 text-white/30 mx-auto mb-4" />
                        <DialogTitle className="text-2xl font-black text-white uppercase tracking-tight relative z-10">
                            {breakDialogType === "WARNING" ? "Break Schedule Update" : "Break Time Check-in"}
                        </DialogTitle>
                        <DialogDescription className="text-white/80 font-bold text-[10px] uppercase tracking-widest mt-2 relative z-10">
                            {breakDialogType === "WARNING"
                                ? "Just a gentle reminder regarding your break time"
                                : "It seems your break has extended a bit"}
                        </DialogDescription>
                    </div>
                    <div className="p-8 space-y-6 bg-white text-center">
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Break Usage</span>
                            <span className={cn(
                                "text-5xl font-black tracking-tighter",
                                "text-[#D4A056]"
                            )}>{breakTime}</span>
                        </div>

                        <p className="text-sm text-slate-500 font-medium">
                            {breakDialogType === "WARNING"
                                ? "You have about 15 minutes remaining. We just wanted to let you know so you can enjoy the rest of your break!"
                                : "We just wanted to check if you forgot to clock back in? If you need a bit more time, that is perfectly fine, just let your manager know."}
                        </p>

                        <Button
                            onClick={handleBreakAcknowledge}
                            className={cn(
                                "w-full h-14 text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg transition-all active:scale-95",
                                "bg-[#D4A056] hover:bg-[#c4934d] text-white"
                            )}
                        >
                            Thank you for the reminder
                        </Button>
                    </div>
                </DialogContent>
            </Dialog >




            {/* Onboarding Dialog */}
            < Dialog open={isOnboardingOpen} onOpenChange={undefined} >
                <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl [&>button]:hidden" onInteractOutside={(e) => e.preventDefault()}>
                    <div className="bg-[#8B2323] p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
                        <Shield className="h-12 w-12 text-white/20 mx-auto mb-4" />
                        <DialogTitle className="text-2xl font-bold text-white uppercase tracking-tight relative z-10">Set Up Your Profile</DialogTitle>
                        <DialogDescription className="text-white/60 font-medium text-[10px] uppercase tracking-widest mt-2 relative z-10">
                            Please update your details
                        </DialogDescription>
                    </div>

                    <div className="p-8 space-y-6 bg-white">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Select Your Base Location</Label>
                                <Select value={onboardingLocation} onValueChange={setOnboardingLocation}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Where are you based?" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Philippines">Philippines</SelectItem>
                                        <SelectItem value="Australia">Australia</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Select Your Department</Label>
                                <Select value={onboardingDepartment} onValueChange={setOnboardingDepartment}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Which department are you in?" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">No department</SelectItem>
                                        {departmentList.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Assign Your Manager</Label>
                                <Select value={onboardingManager} onValueChange={setOnboardingManager}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Who do you report to?" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">No specific manager</SelectItem>
                                        {managerList.map(m => (
                                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-bold">Your Work Hours</Label>
                                <p className="text-xs text-muted-foreground">Set your default work schedule</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Start Time</Label>
                                        <Input
                                            type="time"
                                            value={onboardingShiftStart}
                                            onChange={(e) => setOnboardingShiftStart(e.target.value)}
                                            className="h-11 font-mono font-semibold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">End Time</Label>
                                        <Input
                                            type="time"
                                            value={onboardingShiftEnd}
                                            onChange={(e) => setOnboardingShiftEnd(e.target.value)}
                                            className="h-11 font-mono font-semibold"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={handleOnboardingSubmit}
                                disabled={!onboardingLocation}
                                className="w-full h-12 bg-[#8B2323] hover:bg-[#701c1c] text-white font-bold uppercase tracking-widest text-xs rounded-xl shadow-lg"
                            >
                                Complete Setup
                            </Button>

                            <Button
                                variant="ghost"
                                onClick={() => {
                                    sessionStorage.setItem('onboardingSkipped', 'true')
                                    setIsOnboardingOpen(false)
                                }}
                                className="w-full text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-slate-900"
                            >
                                Skip for Now
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog >

            {/* Timezone Change - Work Hours Confirmation Dialog */}
            <Dialog open={showTimezoneWorkHoursDialog} onOpenChange={setShowTimezoneWorkHoursDialog}>
                <DialogContent className="max-w-md rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-[#8B2323] p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
                        <Globe className="h-12 w-12 text-white/30 mx-auto mb-4" />
                        <DialogTitle className="text-2xl font-bold text-white uppercase tracking-tight relative z-10">
                            Timezone Changed
                        </DialogTitle>
                        <DialogDescription className="text-white/80 font-medium text-sm mt-2 relative z-10">
                            Please confirm your work hours for the new timezone
                        </DialogDescription>
                    </div>

                    <div className="p-8 space-y-6 bg-white">
                        <div className="bg-[#FFF5F5] border border-red-100 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-[#8B2323] mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-[#8B2323] mb-1">
                                        Your timezone has changed to: <span className="font-mono">{userTimeZone}</span>
                                    </p>
                                    <p className="text-xs text-red-600/80">
                                        Please verify your work hours are correct for this timezone. Your current hours may need adjustment.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <Label className="text-sm font-bold mb-2 block">Your Work Hours</Label>
                                <p className="text-xs text-muted-foreground mb-3">
                                    Adjust these times to match your work schedule in <span className="font-semibold">{userTimeZone}</span>
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Start Time</Label>
                                        <Input
                                            type="time"
                                            value={tempWorkHoursStart}
                                            onChange={(e) => setTempWorkHoursStart(e.target.value)}
                                            className="h-11 font-mono font-semibold text-base border-2 focus:border-[#8B2323]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">End Time</Label>
                                        <Input
                                            type="time"
                                            value={tempWorkHoursEnd}
                                            onChange={(e) => setTempWorkHoursEnd(e.target.value)}
                                            className="h-11 font-mono font-semibold text-base border-2 focus:border-[#8B2323]"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={handleTimezoneWorkHoursConfirm}
                                className="w-full h-12 bg-[#8B2323] hover:bg-[#701c1c] text-white font-bold uppercase tracking-widest text-xs rounded-xl shadow-lg"
                            >
                                <Check className="w-4 h-4 mr-2" />
                                Confirm Work Hours
                            </Button>

                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setPreviousTimezone(userTimeZone)
                                    setShowTimezoneWorkHoursDialog(false)
                                }}
                                className="w-full text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-slate-900"
                            >
                                Keep Current Hours
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Day Detail Dialog (for calendar clicks) */}
            <Dialog open={!!selectedDayDetail} onOpenChange={() => setSelectedDayDetail(null)}>
                <DialogContent className="sm:max-w-md rounded-[2rem]">
                    <DialogHeader className="pb-4 border-b">
                        <DialogTitle className="font-black text-xl tracking-tight">
                            {selectedDayDetail ? format(selectedDayDetail!, 'EEEE, MMMM do') : ''}
                        </DialogTitle>
                        <DialogDescription className="font-bold uppercase tracking-widest text-[10px]">
                            Daily Activity & Events
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {selectedDayDetail && (() => {
                            const events = getEventsForDay(selectedDayDetail!)
                            if (events.length === 0) return <p className="text-sm text-center text-muted-foreground italic">No events scheduled for this day.</p>
                            return (
                                <div className="space-y-3">
                                    {events.map((e: any, i: number) => (
                                        <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className={cn("w-2 h-2 rounded-full",
                                                e.type === 'leave' ? "bg-blue-500" :
                                                    e.type === 'holiday' ? "bg-red-500" :
                                                        "bg-green-500"
                                            )} />
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-slate-800">
                                                    {e.type === 'holiday' ? e.name : e.data.userName}
                                                </p>
                                                {e.type === 'leave' && <p className="text-xs text-slate-500 font-medium">On Leave ({e.data.type})</p>}
                                                {e.type === 'present' && <p className="text-xs text-slate-500 font-medium">Present</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        })()}
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    )
}
