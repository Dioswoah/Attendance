"use client"

import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import useSWR, { mutate } from "swr"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { Search, Check, X, Calendar as CalendarIcon, Clock, AlertCircle, Loader2, ChevronLeft, ChevronRight, Users, LayoutGrid, List, ListChecks, History, CalendarDays, Plus, MessageSquare, Trash2, Filter, Download, Building2, TrendingUp, CheckCircle2, Edit, LogIn, LogOut, MapPin, ChevronDown, ArrowRight, FileEdit, FilePlus2 } from "lucide-react"
import * as XLSX from 'xlsx'
import { prepareTimeForExport, formatWithTimezone, getBrowserTimezone } from "@/lib/timezone"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO, isWithinInterval, startOfWeek, endOfWeek, subDays } from "date-fns"
import { cn } from "@/lib/utils"
import { StaffPerformanceCard } from "@/components/performance/StaffPerformanceCard"
import { calculateTardiness, calculateUserPerformanceMetrics } from "@/lib/performance-utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell } from 'recharts'
import { Skeleton } from "@/components/ui/skeleton"

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
    declineReason?: string
    userTimeZone?: string
    targetId?: string
    targetAttendance?: any
}

export default function ManagerControlPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()

    // Sync active tab with search params
    const activeTab = searchParams.get('tab') || 'requests'

    const handleTabChange = (val: string) => {
        router.push(`/user/manager?tab=${val}`, { scroll: false })
    }

    // Requests State
    const [pendingRequests, setPendingRequests] = useState<Request[]>([])
    const [requestHistory, setRequestHistory] = useState<Request[]>([])

    // Calendar & Team State
    const [approvedLeaves, setApprovedLeaves] = useState<Request[]>([])
    const [monthlyAttendance, setMonthlyAttendance] = useState<any[]>([]) // Changed from activeAttendance to all month
    const [myTeam, setMyTeam] = useState<any[]>([])
    const [todaysAttendance, setTodaysAttendance] = useState<any[]>([])
    const [currentMonth, setCurrentMonth] = useState(new Date())

    // Department Filter State
    const [managerDepartments, setManagerDepartments] = useState<any[]>([])
    const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])
    const [selectedEmploymentLocations, setSelectedEmploymentLocations] = useState<string[]>([])

    // UI State
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
    const [actionType, setActionType] = useState<"approve" | "deny" | null>(null)
    const [denyReason, setDenyReason] = useState("")
    const [denyReasonError, setDenyReasonError] = useState(false)
    const [selectedDayDetail, setSelectedDayDetail] = useState<Date | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [reportStartDate, setReportStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [reportEndDate, setReportEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [viewerTimeZone, setViewerTimeZone] = useState(getBrowserTimezone())
    const [reportTimezone, setReportTimezone] = useState("Australia/Sydney")
    const [isGeneratingReport, setIsGeneratingReport] = useState(false)
    const [performanceRange, setPerformanceRange] = useState("7") // Days
    const [performanceData, setPerformanceData] = useState<any[]>([])
    const [rawPerformanceData, setRawPerformanceData] = useState<any[]>([])
    const [isFetchingPerformance, setIsFetchingPerformance] = useState(false)
    const [perfStartDate, setPerfStartDate] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"))
    const [perfEndDate, setPerfEndDate] = useState(format(new Date(), "yyyy-MM-dd"))

    // Work Hours Edit State
    // Work Hours Edit State
    const [editingMember, setEditingMember] = useState<any>(null)
    const [editShiftStart, setEditShiftStart] = useState("09:00")
    const [editShiftEnd, setEditShiftEnd] = useState("17:00")

    // Performance Log View State
    const [selectedStaffForLogs, setSelectedStaffForLogs] = useState<any | null>(null)

    // View Mode State (Card vs Table)
    const [viewMode, setViewMode] = useState<'card' | 'table'>('card')
    const [perfViewMode, setPerfViewMode] = useState<'card' | 'table'>('card')

    // Report Selection State
    const [reportSelectedStaff, setReportSelectedStaff] = useState<string[]>([])

    // Grant Leave State
    const [grantLeaveEmpId, setGrantLeaveEmpId] = useState("")
    const [grantLeaveStart, setGrantLeaveStart] = useState(format(new Date(), "yyyy-MM-dd"))
    const [grantLeaveEnd, setGrantLeaveEnd] = useState(format(new Date(), "yyyy-MM-dd"))
    const [grantLeaveType, setGrantLeaveType] = useState("SICK")
    const [grantLeaveDuration, setGrantLeaveDuration] = useState("Full Day")
    const [grantLeaveStartTime, setGrantLeaveStartTime] = useState("09:00")
    const [grantLeaveEndTime, setGrantLeaveEndTime] = useState("18:00")
    const [grantLeaveReason, setGrantLeaveReason] = useState("")
    const [isGrantingLeave, setIsGrantingLeave] = useState(false)
    const [leaveFilter, setLeaveFilter] = useState<'all' | 'today'>('all')

    // fetchInitialData removed
    // useEffect(() => {
    //    if (session?.user?.id) {
    //        fetchInitialData()
    //    }
    // }, [session])

    // Re-fetch calendar data when month changes
    // Re-fetch calendar data when month changes
    // AUTOMATED BY SWR DEPENDENCY ON currentMonth
    // useEffect(() => {
    //    if (session?.user?.id) {
    //        fetchMonthlyAttendance()
    //    }
    // }, [currentMonth, session])

    useEffect(() => {
        if (session?.user) {
            const tz = (session.user as any).useCurrentTimezone
                ? getBrowserTimezone()
                : (session.user as any).selectedTimezone || getBrowserTimezone()
            setViewerTimeZone(tz)
            setReportTimezone(tz)
        }
    }, [session])

    // --- SWR Hooks for Data Fetching ---
    const fetcher = (url: string) => fetch(url).then(async res => {
        if (!res.ok) throw new Error('Failed to fetch')
        return res.json()
    })

    const uid = session?.user?.id

    // 1. Departments
    const { data: departmentsData } = useSWR(uid ? '/api/departments' : null, fetcher)

    // 2. Employees (Staff)
    const { data: employeesData } = useSWR(uid ? '/api/employees' : null, fetcher)

    // 3. Pending Leaves
    const { data: pendingLeavesData, mutate: mutatePendingLeaves } = useSWR(uid ? `/api/leaves?managerId=${uid}&status=PENDING` : null, fetcher)

    // 4. Pending Attendance Requests
    const { data: pendingAttendanceData, mutate: mutatePendingAttendance } = useSWR(uid ? `/api/attendance-requests?managerId=${uid}&status=PENDING` : null, fetcher)

    // 5. Approved Leaves
    const { data: approvedLeavesData, mutate: mutateApprovedLeaves } = useSWR(uid ? `/api/leaves?managerId=${uid}&status=APPROVED` : null, fetcher)

    // 6. Request History
    const { data: historyLeavesData, mutate: mutateHistoryLeaves } = useSWR(uid ? `/api/leaves?managerId=${uid}&status=APPROVED,DECLINED` : null, fetcher)
    const { data: historyAttendanceData, mutate: mutateHistoryAttendance } = useSWR(uid ? `/api/attendance-requests?managerId=${uid}&status=APPROVED,DECLINED` : null, fetcher)

    // 7. Today's Attendance (for sidebar status)
    const { data: todayAttendanceData } = useSWR(uid ? '/api/attendance' : null, fetcher)

    // 8. Monthly Attendance (Calendar)
    const monthlyStart = startOfMonth(currentMonth).toISOString()
    const monthlyEnd = endOfMonth(currentMonth).toISOString()
    const { data: monthlyAttendanceData } = useSWR(
        uid ? `/api/attendance?managerId=${uid}&startDate=${monthlyStart}&endDate=${monthlyEnd}` : null,
        fetcher
    )

    // --- State Synchronization Effects ---

    // Sync Departments & Manager Departments


    // Sync My Team (depends on Employees + Manager Departments)
    useEffect(() => {
        if (employeesData && uid) {
            // 1. Identify departments I manage directly (Owned Departments)
            const ownedDepts = departmentsData
                ? departmentsData.filter((d: any) => d.managerId === uid)
                : []
            const ownedDeptIds = ownedDepts.map((d: any) => d.id)

            // 2. Filter employees: either directly reported to me OR in my owned departments
            const myStaff = employeesData.filter((emp: any) =>
                emp.managerId === uid ||
                (emp.departmentId && ownedDeptIds.includes(emp.departmentId))
            )

            setMyTeam(myStaff)

            // 3. Determine all relevant departments for the dropdown filters
            // Start with owned departments
            const relevantDeptsMap = new Map()
            ownedDepts.forEach((d: any) => relevantDeptsMap.set(d.id, d))

            // Add departments from direct reports (who might be in other departments)
            // Ensure we use the full department object attached to the employee
            myStaff.forEach((emp: any) => {
                if (emp.department) {
                    relevantDeptsMap.set(emp.department.id, emp.department)
                }
            })

            // Convert back to array and sort
            const allManagerDepts = Array.from(relevantDeptsMap.values())
            allManagerDepts.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""))

            setManagerDepartments(allManagerDepts)
        }
    }, [employeesData, departmentsData, uid])

    // Sync Pending Requests (Combine Leaves + Attendance)
    useEffect(() => {
        if (pendingLeavesData || pendingAttendanceData) {
            let combined: Request[] = []

            if (pendingLeavesData) {
                combined = [...combined, ...pendingLeavesData.map((l: any) => ({ ...l, kind: 'LEAVE' }))]
            }
            if (pendingAttendanceData) {
                combined = [...combined, ...pendingAttendanceData.map((r: any) => ({
                    ...r,
                    kind: 'ATTENDANCE',
                    userName: r.user.name,
                    userImage: r.user.image,
                    department: r.user.department?.name,
                    startDate: r.date,
                    endDate: r.date,
                    duration: 'Correction',
                    type: r.type,
                    userTimeZone: r.user.selectedTimezone
                }))]
            }
            setPendingRequests(combined)
            // If we have data, we are not loading anymore
            if (pendingLeavesData && pendingAttendanceData) setIsLoading(false)
        }
    }, [pendingLeavesData, pendingAttendanceData])

    // Sync History
    useEffect(() => {
        if (historyLeavesData || historyAttendanceData) {
            let combined: Request[] = []
            if (historyLeavesData) {
                combined = [...combined, ...historyLeavesData.map((l: any) => ({ ...l, kind: 'LEAVE' }))]
            }
            if (historyAttendanceData) {
                combined = [...combined, ...historyAttendanceData.map((r: any) => ({
                    ...r,
                    kind: 'ATTENDANCE',
                    userName: r.user.name,
                    userImage: r.user.image,
                    department: r.user.department?.name,
                    startDate: r.date,
                    endDate: r.date,
                    duration: 'Correction',
                    type: r.type,
                    userTimeZone: r.user.selectedTimezone
                }))]
            }
            // Sort by createdAt desc
            combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            setRequestHistory(combined)
        }
    }, [historyLeavesData, historyAttendanceData])

    // Sync Approved Leaves
    useEffect(() => {
        if (approvedLeavesData) setApprovedLeaves(approvedLeavesData)
    }, [approvedLeavesData])

    // Sync Today's Attendance
    useEffect(() => {
        if (todayAttendanceData) setTodaysAttendance(todayAttendanceData)
    }, [todayAttendanceData])

    // Sync Monthly Attendance
    useEffect(() => {
        if (monthlyAttendanceData) setMonthlyAttendance(monthlyAttendanceData)
    }, [monthlyAttendanceData])


    // Manually trigger performance fetch when myTeam is ready (kept as manual/effect-based for now)
    // useEffect(() => { ... } is already handling this below

    // Legacy support functions
    const fetchMonthlyAttendance = () => { } // Handled by SWR
    const fetchInitialData = () => { } // Handled by SWR and Effects

    useEffect(() => {
        if (session?.user?.id && myTeam.length > 0) {
            fetchPerformanceData()
        }
    }, [perfStartDate, perfEndDate, selectedDepartments, myTeam.length, session?.user?.id, pendingAttendanceData])

    const fetchPerformanceData = async () => {
        if (!session?.user?.id || myTeam.length === 0) return
        setIsFetchingPerformance(true)
        try {
            const start = new Date(perfStartDate)
            start.setUTCHours(0, 0, 0, 0)
            const end = new Date(perfEndDate)
            end.setUTCHours(23, 59, 59, 999)

            // Filter team by selected department
            let filteredTeam = myTeam
            if (selectedDepartments.length > 0 && !selectedDepartments.includes('all')) {
                filteredTeam = myTeam.filter(emp => selectedDepartments.includes(emp.departmentId))
            }

            if (filteredTeam.length === 0) {
                setPerformanceData([])
                return
            }

            const staffIds = filteredTeam.map(e => e.id)
            const query = new URLSearchParams({
                userIds: staffIds.join(','),
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                includeAll: 'true'
            })

            const res = await fetch(`/api/attendance?${query.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setRawPerformanceData(data)

                // Aggregate by date
                const days = eachDayOfInterval({ start, end })
                const chartData = days.map(day => {
                    const dateStr = format(day, "yyyy-MM-dd")

                    // 1. Get Actual Attendance
                    const actualAtt = data.filter((a: any) => a.date === dateStr)
                    const usersWithActual = new Set(actualAtt.map((a: any) => a.userId))

                    // 2. Get Pending Attendance (Virtual Records)
                    // We only care about CLOCK_IN requests for users who don't have a record yet
                    const pendingForDay = (pendingAttendanceData || []).filter((req: any) => {
                        if (req.type !== 'CLOCK_IN' || req.status !== 'PENDING') return false
                        if (!staffIds.includes(req.user?.id || req.userId)) return false
                        if (usersWithActual.has(req.user?.id || req.userId)) return false

                        // Check date match
                        const reqDate = new Date(req.time || req.date)
                        return format(reqDate, "yyyy-MM-dd") === dateStr
                    })

                    const virtualAtt = pendingForDay.map((req: any) => ({
                        userId: req.user?.id || req.userId,
                        status: 'present', // Treat as present for stats
                        clockIn: req.time || req.date,
                        scheduledStart: null,
                        isVirtual: true // Marker if needed
                    }))

                    // 3. Combine
                    const dayAtt = [...actualAtt, ...virtualAtt]

                    // Logic: Use shiftStartTime if available for that record
                    const presentCount = dayAtt.filter((a: any) => a.status !== 'on-leave').length

                    // Calculate tardiness using individual user work hours
                    const lateCount = dayAtt.filter((a: any) => {
                        if (!a.clockIn || a.status === 'on-leave') return false

                        // Find the user for this attendance record
                        const user = filteredTeam.find(u => u.id === a.userId)
                        if (!user) return false

                        // Use scheduled time from attendance or user's default shift time
                        const expectedStart = a.scheduledStart || user.shiftStartTime || "09:00"
                        const clockInDate = new Date(a.clockIn)

                        const [sHour, sMin] = expectedStart.split(':').map(Number)
                        const actualTime = clockInDate.getHours() * 60 + clockInDate.getMinutes()
                        const expectedTime = sHour * 60 + sMin

                        // 5 minute grace period
                        return actualTime > (expectedTime + 5)
                    }).length

                    return {
                        date: format(day, "MMM dd"),
                        fullDate: dateStr,
                        basePresent: presentCount,
                        present: presentCount - lateCount, // "Net" present (on-time)
                        late: lateCount,
                        absent: filteredTeam.length - presentCount
                    }
                })
                setPerformanceData(chartData)
            }
        } catch (error) {
            console.error("Performance fetch error:", error)
        } finally {
            setIsFetchingPerformance(false)
        }
    }

    // fetchMonthlyAttendance replaced by SWR logic above

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
                const request = selectedRequest // Save reference
                setPendingRequests(prev => prev.filter(r => r.id !== request.id))
                // Add to history
                setRequestHistory(prev => [{ ...request, status: actionType === "approve" ? "APPROVED" : "DECLINED" }, ...prev])
                // If approved, add to approved list (optimistic update or re-fetch)
                if (actionType === "approve") {
                    setApprovedLeaves(prev => [...prev, { ...request, status: 'APPROVED' }])
                }
                setSelectedRequest(null)
                setActionType(null)

                // Trigger Background Revalidation
                if (request.kind === 'ATTENDANCE') {
                    mutatePendingAttendance()
                    mutateHistoryAttendance()
                } else {
                    mutatePendingLeaves()
                    mutateHistoryLeaves()
                }
                mutateApprovedLeaves()
            } else {
                alert("Failed to update request")
            }
        } catch (error) {
            // Action failed
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteHistory = async (request: Request) => {
        if (!confirm(`Are you sure you want to delete this ${request.kind?.toLowerCase() || 'leave'} record? This will notify the administrators.`)) return

        setIsSubmitting(true)
        try {
            const endpoint = request.kind === 'ATTENDANCE'
                ? `/api/attendance-requests/${request.id}`
                : `/api/leaves/${request.id}`

            const res = await fetch(endpoint, { method: 'DELETE' })
            if (res.ok) {
                setRequestHistory(prev => prev.filter(r => r.id !== request.id))
            } else {
                alert("Failed to delete record")
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleGrantLeave = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!grantLeaveEmpId) {
            toast.error("Please select a staff member")
            return
        }
        if (new Date(grantLeaveEnd) < new Date(grantLeaveStart)) {
            toast.error("End date cannot be before start date")
            return
        }
        if (grantLeaveDuration !== 'Full Day' && grantLeaveEndTime <= grantLeaveStartTime) {
            toast.error("End time must be after start time")
            return
        }

        setIsGrantingLeave(true)
        try {
            const res = await fetch('/api/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: grantLeaveEmpId,
                    startDate: grantLeaveStart,
                    endDate: grantLeaveEnd,
                    type: grantLeaveType,
                    reason: grantLeaveReason,
                    duration: grantLeaveDuration,
                    status: 'APPROVED',
                    startTime: grantLeaveDuration !== 'Full Day' ? new Date(`${grantLeaveStart}T${grantLeaveStartTime}:00`).toISOString() : null,
                    endTime: grantLeaveDuration !== 'Full Day' ? new Date(`${grantLeaveStart}T${grantLeaveEndTime}:00`).toISOString() : null
                })
            })

            if (res.ok) {
                toast.success("Leave record created successfully")
                setGrantLeaveEmpId("")
                setGrantLeaveStart(format(new Date(), "yyyy-MM-dd"))
                setGrantLeaveEnd(format(new Date(), "yyyy-MM-dd"))
                setGrantLeaveType("SICK")
                setGrantLeaveDuration("Full Day")
                setGrantLeaveStartTime("09:00")
                setGrantLeaveEndTime("18:00")
                setGrantLeaveReason("")
                mutateApprovedLeaves()
                mutateHistoryLeaves()
            } else {
                const data = await res.json()
                toast.error(data.error || "Failed to create leave record")
            }
        } catch {
            toast.error("An error occurred")
        } finally {
            setIsGrantingLeave(false)
        }
    }

    const openEditWorkHours = (member: any) => {
        setEditingMember(member)
        setEditShiftStart(member.shiftStartTime || "09:00")
        setEditShiftEnd(member.shiftEndTime || "17:00")
    }

    const handleSaveWorkHours = async () => {
        if (!editingMember) return
        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/employees/${editingMember.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shiftStartTime: editShiftStart,
                    shiftEndTime: editShiftEnd
                })
            })

            if (res.ok) {
                // Update local state
                const updated = await res.json()
                setMyTeam(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
                setEditingMember(null)
                // Optionally refresh performance data
                fetchPerformanceData()
            } else {
                alert("Failed to update work hours")
            }
        } catch (error) {
            console.error("Failed to update work hours", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    // --- Filter Data First (Before Using in Functions) ---
    // Filter Team Members
    const filteredTeam = useMemo(() => {
        let filtered = myTeam

        // Department Filter
        if (selectedDepartments.length > 0 && !selectedDepartments.includes('all')) {
            filtered = filtered.filter(member => selectedDepartments.includes(member.departmentId))
        }

        // Employment Location Filter
        if (selectedEmploymentLocations.length > 0) {
            filtered = filtered.filter(member => selectedEmploymentLocations.includes(member.employmentLocation))
        }

        return filtered
    }, [myTeam, selectedDepartments, selectedEmploymentLocations])

    // Filter Approved Leaves
    const filteredApprovedLeaves = useMemo(() => {
        let leaves = approvedLeaves

        // Department Filter
        if (selectedDepartments.length > 0 && !selectedDepartments.includes('all')) {
            leaves = leaves.filter(leave => {
                const member = myTeam.find(m => m.id === leave.userId)
                return member && selectedDepartments.includes(member.departmentId)
            })
        }

        // Employment Location Filter
        if (selectedEmploymentLocations.length > 0) {
            leaves = leaves.filter(leave => {
                const member = myTeam.find(m => m.id === leave.userId)
                return member && selectedEmploymentLocations.includes(member.employmentLocation)
            })
        }

        return leaves
    }, [approvedLeaves, myTeam, selectedDepartments, selectedEmploymentLocations])

    // Filter Monthly Attendance
    const filteredMonthlyAttendance = useMemo(() => {
        let attendance = monthlyAttendance

        // Department Filter
        if (selectedDepartments.length > 0 && !selectedDepartments.includes('all')) {
            attendance = attendance.filter(att => {
                const member = myTeam.find(m => m.id === att.userId)
                return member && selectedDepartments.includes(member.departmentId)
            })
        }

        // Employment Location Filter
        if (selectedEmploymentLocations.length > 0) {
            attendance = attendance.filter(att => {
                const member = myTeam.find(m => m.id === att.userId)
                return member && selectedEmploymentLocations.includes(member.employmentLocation)
            })
        }

        return attendance
    }, [monthlyAttendance, myTeam, selectedDepartments, selectedEmploymentLocations])

    // Filter Pending Requests
    const filteredRequests = pendingRequests.filter(r => {
        const matchesSearch = r.userName.toLowerCase().includes(searchQuery.toLowerCase())
        const member = myTeam.find(m => m.id === r.userId)

        const matchesDepartment = selectedDepartments.length === 0 || selectedDepartments.includes('all') || (member && selectedDepartments.includes(member.departmentId))
        const matchesLocation = selectedEmploymentLocations.length === 0 || (member && selectedEmploymentLocations.includes(member.employmentLocation))

        return matchesSearch && matchesDepartment && matchesLocation
    })

    // Filter Request History
    const filteredHistory = requestHistory.filter(r => {
        const member = myTeam.find(m => m.id === r.userId)

        const matchesDepartment = selectedDepartments.length === 0 || selectedDepartments.includes('all') || (member && selectedDepartments.includes(member.departmentId))
        const matchesLocation = selectedEmploymentLocations.length === 0 || (member && selectedEmploymentLocations.includes(member.employmentLocation))

        return matchesDepartment && matchesLocation
    })

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

        // Leave only — attendance is intentionally excluded from this calendar view
        const events: any[] = filteredApprovedLeaves.filter(leave =>
            isWithinInterval(date, {
                start: parseISO(leave.startDate.slice(0, 10)),
                end: parseISO(leave.endDate.slice(0, 10))
            })
        ).map(l => ({ type: 'leave', data: l }))

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

        return filteredTeam.map(member => {
            // Find approved leave
            const leave = filteredApprovedLeaves.find(l =>
                l.userId === member.id &&
                isWithinInterval(date, {
                    start: parseISO(l.startDate.slice(0, 10)),
                    end: parseISO(l.endDate.slice(0, 10))
                })
            )

            // Find attendance
            const attendance = filteredMonthlyAttendance.find(a => {
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
    const todayDateStr = format(new Date(), 'yyyy-MM-dd')

    const sortedTeam = useMemo(() => {
        return [...filteredTeam].map(member => {
            // Find attendance record
            const record = todaysAttendance.find((a: any) => a.userId === member.id)
            // Check if on APPROVED leave today using date-string comparison (avoids isWithinInterval midnight edge case)
            const onLeaveToday = filteredApprovedLeaves.find(l =>
                l.userId === member.id &&
                l.startDate.slice(0, 10) <= todayDateStr &&
                l.endDate.slice(0, 10) >= todayDateStr
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
    }, [filteredTeam, todaysAttendance, filteredApprovedLeaves])



    // Future approved leaves (start date is strictly after today)
    const upcomingTeamLeaves = useMemo(() => {
        return filteredApprovedLeaves
            .filter(leave => leave.startDate.slice(0, 10) > todayDateStr)
            .sort((a, b) => a.startDate.slice(0, 10).localeCompare(b.startDate.slice(0, 10)))
    }, [filteredApprovedLeaves, todayDateStr])

    // Leaves active specifically today
    const onLeaveTodayLeaves = useMemo(() => {
        return filteredApprovedLeaves.filter(l =>
            l.startDate.slice(0, 10) <= todayDateStr &&
            l.endDate.slice(0, 10) >= todayDateStr
        )
    }, [filteredApprovedLeaves, todayDateStr])

    // Loading check removed to allow Skeleton UI rendering
    // if (status === "loading" || isLoading) { ... } removed

    return (
        <div className="space-y-8 w-full">

            {/* Page Header is handled inside Tabs mainly, but we can put a global title */}

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-8">
                <div id="tour-manager-header" className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Manager Control</h1>
                        <p className="text-muted-foreground mt-1">Review requests and monitor team availability</p>
                    </div>

                    <TabsList className="bg-slate-100/50 border border-slate-200 p-1 h-12 rounded-2xl gap-1">
                        <TabsTrigger value="requests" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm px-4 h-10 rounded-xl transition-all text-xs font-black uppercase tracking-wider">
                            <ListChecks className="w-4 h-4 mr-2" />
                            Requests
                        </TabsTrigger>
                        <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm px-4 h-10 rounded-xl transition-all text-xs font-black uppercase tracking-wider">
                            <History className="w-4 h-4 mr-2" />
                            History
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm px-4 h-10 rounded-xl transition-all text-xs font-black uppercase tracking-wider">
                            <CalendarDays className="w-4 h-4 mr-2" />
                            Calendar
                        </TabsTrigger>
                        <TabsTrigger value="performance" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm px-4 h-10 rounded-xl transition-all text-xs font-black uppercase tracking-wider">
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Performance
                        </TabsTrigger>
                        <TabsTrigger value="reports" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm px-4 h-10 rounded-xl transition-all text-xs font-black uppercase tracking-wider">
                            <Download className="w-4 h-4 mr-2" />
                            Reports
                        </TabsTrigger>
                        <TabsTrigger value="grant-leave" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm px-4 h-10 rounded-xl transition-all text-xs font-black uppercase tracking-wider">
                            <FilePlus2 className="w-4 h-4 mr-2" />
                            Grant Leave
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* --- REQUESTS TAB --- */}
                <TabsContent value="requests" className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                    <div id="tour-manager-pending" className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 rounded-xl border border-border shadow-sm gap-4">
                        <div className="flex items-center gap-2">
                            <ListChecks className="w-5 h-5 text-yellow-600" />
                            <h2 className="font-semibold text-foreground">Pending Approvals</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            {managerDepartments.length > 1 && (
                                <div className="flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-muted-foreground" />
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="h-9 w-auto px-3 min-w-[140px] justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 border-slate-200 bg-white hover:bg-slate-50">
                                                <span className="truncate max-w-[100px]">
                                                    {selectedDepartments.length === 0 ? "Departments" : selectedDepartments.length === managerDepartments.length ? "All Depts" : `${selectedDepartments.length} Selected`}
                                                </span>
                                                <ChevronDown className="h-3 w-3 ml-2 opacity-50" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-56 p-2" align="start">
                                            <DropdownMenuLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Filter Departments</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <div className="max-h-[300px] overflow-y-auto space-y-1">
                                                <div className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md cursor-pointer"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (selectedDepartments.length === managerDepartments.length) {
                                                            setSelectedDepartments([]);
                                                        } else {
                                                            setSelectedDepartments(managerDepartments.map(d => d.id));
                                                        }
                                                    }}>
                                                    <Checkbox
                                                        checked={selectedDepartments.length === managerDepartments.length && managerDepartments.length > 0}
                                                        id="dept-all-pending"
                                                    />
                                                    <label htmlFor="dept-all-pending" className="text-xs font-bold cursor-pointer flex-1">Select All</label>
                                                </div>
                                                <DropdownMenuSeparator />
                                                {managerDepartments.map((dept) => (
                                                    <div key={dept.id} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md cursor-pointer"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (selectedDepartments.includes(dept.id)) {
                                                                setSelectedDepartments(selectedDepartments.filter(id => id !== dept.id));
                                                            } else {
                                                                setSelectedDepartments([...selectedDepartments, dept.id]);
                                                            }
                                                        }}>
                                                        <Checkbox id={`dept-${dept.id}-pending`} checked={selectedDepartments.includes(dept.id)} />
                                                        <label htmlFor={`dept-${dept.id}-pending`} className="text-xs font-medium cursor-pointer flex-1 truncate">{dept.name}</label>
                                                    </div>
                                                ))}
                                            </div>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}
                            <div className="relative flex-1 sm:flex-initial sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search requests..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 bg-muted/30 border-border"
                                />
                            </div>
                            {/* View Toggle Buttons */}
                            <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg">
                                <Button
                                    variant={viewMode === 'card' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('card')}
                                    className="h-7 px-2"
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('table')}
                                    className="h-7 px-2"
                                >
                                    <List className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <Card key={i} className="border-border bg-white overflow-hidden">
                                    <div className="flex flex-col lg:flex-row">
                                        <div className="lg:w-1 bg-slate-200" />
                                        <CardContent className="flex-1 p-6">
                                            <div className="flex flex-col lg:flex-row gap-6 items-start">
                                                <Skeleton className="h-12 w-12 rounded-full" />
                                                <div className="flex-1 space-y-4 w-full">
                                                    <div className="flex justify-between w-full">
                                                        <div className="space-y-2">
                                                            <Skeleton className="h-6 w-32" />
                                                            <Skeleton className="h-4 w-24" />
                                                        </div>
                                                        <Skeleton className="h-6 w-24" />
                                                    </div>
                                                    <div className="grid sm:grid-cols-4 gap-4">
                                                        <Skeleton className="h-16 w-full rounded-lg" />
                                                        <Skeleton className="h-16 w-full rounded-lg" />
                                                        <Skeleton className="h-16 w-full rounded-lg col-span-2" />
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </div>
                                </Card>
                            ))
                        ) : filteredRequests.length === 0 ? (
                            <Card className="border-dashed shadow-none bg-muted/30">
                                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                        <Check className="w-8 h-8 text-green-500" />
                                    </div>
                                    <h3 className="text-lg font-semibold">All Caught Up!</h3>
                                    <p className="text-muted-foreground">No pending leave requests at this time.</p>
                                </CardContent>
                            </Card>
                        ) : viewMode === 'card' ? (
                            // Card View — split into Amendment Requests + Approval Requests
                            <div className="space-y-8">
                                {/* === AMENDMENT REQUESTS === */}
                                {filteredRequests.filter(r => r.kind === 'ATTENDANCE').length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 px-1">
                                            <div className="h-4 w-1 bg-orange-400 rounded-full" />
                                            <FileEdit className="w-4 h-4 text-orange-500" />
                                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Amendment Requests</h3>
                                            <Badge className="bg-orange-100 text-orange-700 border-orange-200 shadow-none text-[10px] font-bold">
                                                {filteredRequests.filter(r => r.kind === 'ATTENDANCE').length}
                                            </Badge>
                                        </div>
                                        <div className="grid gap-4">
                                            {filteredRequests.filter(r => r.kind === 'ATTENDANCE').map(request => {
                                                const ta = request.targetAttendance
                                                const currentTime = ta ? (
                                                    request.type === 'CLOCK_IN' ? ta.clockIn :
                                                    request.type === 'CLOCK_OUT' ? ta.clockOut :
                                                    request.type === 'BREAK_START' ? ta.breakStart :
                                                    request.type === 'BREAK_END' ? ta.breakEnd : null
                                                ) : null
                                                return (
                                                    <Card key={request.id} className="group hover:shadow-md transition-all border-border bg-white overflow-hidden">
                                                        <div className="flex flex-col lg:flex-row">
                                                            <div className="lg:w-1 bg-orange-400" />
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
                                                                            <div className="flex flex-col items-end gap-1 self-start sm:self-auto">
                                                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Request Type</p>
                                                                                <Badge variant="outline" className={currentTime
                                                                                    ? "border-orange-300 text-orange-700 bg-orange-50 font-bold text-[10px]"
                                                                                    : "border-violet-300 text-violet-700 bg-violet-50 font-bold text-[10px]"
                                                                                }>
                                                                                    {currentTime ? "Amend Record" : "Missed Entry"}
                                                                                </Badge>
                                                                            </div>
                                                                        </div>

                                                                        {/* Amendment type + date */}
                                                                        <div className="flex flex-wrap items-center gap-3 text-sm">
                                                                            <Badge variant="outline" className="font-bold uppercase text-xs tracking-wider border-orange-200 text-orange-700 bg-orange-50">
                                                                                {request.type.replace(/_/g, ' ')}
                                                                            </Badge>
                                                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                                                <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                                                                                <span className="font-medium text-xs">{format(parseISO(request.startDate), 'MMM dd, yyyy')}</span>
                                                                            </div>
                                                                        </div>

                                                                        {/* Current → Requested comparison */}
                                                                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                                                            <div>
                                                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Currently Recorded</p>
                                                                                {currentTime ? (
                                                                                    <div>
                                                                                        <p className="font-bold text-slate-700 text-sm">{formatWithTimezone(new Date(currentTime), viewerTimeZone, 'time')}</p>
                                                                                        <p className="text-[9px] text-slate-400 mt-0.5">Staff: {formatWithTimezone(new Date(currentTime), (request as any).userTimeZone || 'UTC', 'time')}</p>
                                                                                    </div>
                                                                                ) : (
                                                                                    <p className="text-xs text-slate-400 italic">Not recorded</p>
                                                                                )}
                                                                            </div>
                                                                            <ArrowRight className="w-5 h-5 text-slate-300" />
                                                                            <div className="text-right">
                                                                                <p className="text-[10px] font-black uppercase tracking-wider text-orange-500 mb-1.5">Requested Change</p>
                                                                                {request.time && (
                                                                                    <div>
                                                                                        <p className="font-bold text-orange-700 text-sm">{formatWithTimezone(new Date(request.time), viewerTimeZone, 'time')}</p>
                                                                                        <p className="text-[9px] text-orange-400 mt-0.5">Staff: {formatWithTimezone(new Date(request.time), (request as any).userTimeZone || 'UTC', 'time')}</p>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {request.reason && (
                                                                            <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                                                                                <p className="text-sm italic text-slate-600">"{request.reason}"</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex lg:flex-col gap-2 pt-2 lg:pt-0">
                                                                        <Button onClick={() => handleAction(request, "approve")} className="bg-green-600 hover:bg-green-700 text-white shadow-sm w-full sm:w-auto">
                                                                            <Check className="w-4 h-4 mr-2" /> Approve
                                                                        </Button>
                                                                        <Button onClick={() => handleAction(request, "deny")} variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full sm:w-auto">
                                                                            <X className="w-4 h-4 mr-2" /> Deny
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </div>
                                                    </Card>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* === APPROVAL REQUESTS (Leave) === */}
                                {filteredRequests.filter(r => r.kind === 'LEAVE').length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 px-1">
                                            <div className="h-4 w-1 bg-blue-400 rounded-full" />
                                            <CalendarDays className="w-4 h-4 text-blue-500" />
                                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Approval Requests</h3>
                                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 shadow-none text-[10px] font-bold">
                                                {filteredRequests.filter(r => r.kind === 'LEAVE').length}
                                            </Badge>
                                        </div>
                                        <div className="grid gap-4">
                                            {filteredRequests.filter(r => r.kind === 'LEAVE').map(request => (
                                                <Card key={request.id} className="group hover:shadow-md transition-all border-border bg-white overflow-hidden">
                                                    <div className="flex flex-col lg:flex-row">
                                                        <div className="lg:w-1 bg-blue-400" />
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
                                                                    </div>
                                                                    <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                                        <div className="bg-muted/30 p-3 rounded-lg">
                                                                            <p className="text-xs text-muted-foreground mb-1">Leave Type</p>
                                                                            <p className="font-semibold capitalize">{request.type.toLowerCase().replace(/_/g, ' ')}</p>
                                                                        </div>
                                                                        <div className="bg-muted/30 p-3 rounded-lg">
                                                                            <p className="text-xs text-muted-foreground mb-1">Duration/Time</p>
                                                                            <p className="font-semibold">
                                                                                {request.startTime
                                                                                    ? `${request.duration} (${formatWithTimezone(new Date(request.startTime), viewerTimeZone, 'time')})`
                                                                                    : request.duration}
                                                                            </p>
                                                                            {request.startTime && (
                                                                                <p className="text-[9px] text-muted-foreground mt-0.5">
                                                                                    Staff: {formatWithTimezone(new Date(request.startTime), (request as any).userTimeZone || 'UTC', 'time')}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                        <div className="bg-muted/30 p-3 rounded-lg col-span-2">
                                                                            <p className="text-xs text-muted-foreground mb-1">Date Range</p>
                                                                            <div className="flex items-center gap-2 font-medium">
                                                                                <CalendarIcon className="w-4 h-4 text-primary" />
                                                                                {format(parseISO(request.startDate), 'MMM dd, yyyy')}
                                                                                {request.startDate !== request.endDate && (
                                                                                    <> — {format(parseISO(request.endDate), 'MMM dd, yyyy')}</>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    {request.reason && (
                                                                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                                                                            <p className="text-sm italic text-slate-600">"{request.reason}"</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex lg:flex-col gap-2 pt-2 lg:pt-0">
                                                                    <Button onClick={() => handleAction(request, "approve")} className="bg-green-600 hover:bg-green-700 text-white shadow-sm w-full sm:w-auto">
                                                                        <Check className="w-4 h-4 mr-2" /> Approve
                                                                    </Button>
                                                                    <Button onClick={() => handleAction(request, "deny")} variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full sm:w-auto">
                                                                        <X className="w-4 h-4 mr-2" /> Deny
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Table View — split into two tables
                            <div className="space-y-8">
                                {/* Amendment Requests Table */}
                                {filteredRequests.filter(r => r.kind === 'ATTENDANCE').length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 px-1">
                                            <div className="h-4 w-1 bg-orange-400 rounded-full" />
                                            <FileEdit className="w-4 h-4 text-orange-500" />
                                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Amendment Requests</h3>
                                        </div>
                                        <Card className="border-border bg-white overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead className="bg-orange-50 border-b border-orange-100">
                                                        <tr>
                                                            <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Staff</th>
                                                            <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Amendment Type</th>
                                                            <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Date</th>
                                                            <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Currently Recorded</th>
                                                            <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Requested Change</th>
                                                            <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Reason</th>
                                                            <th className="text-right p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {filteredRequests.filter(r => r.kind === 'ATTENDANCE').map(request => {
                                                            const ta = request.targetAttendance
                                                            const currentTime = ta ? (
                                                                request.type === 'CLOCK_IN' ? ta.clockIn :
                                                                request.type === 'CLOCK_OUT' ? ta.clockOut :
                                                                request.type === 'BREAK_START' ? ta.breakStart :
                                                                request.type === 'BREAK_END' ? ta.breakEnd : null
                                                            ) : null
                                                            return (
                                                                <tr key={request.id} className="hover:bg-slate-50/50 transition-colors">
                                                                    <td className="p-4">
                                                                        <div className="flex items-center gap-3">
                                                                            <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                                                                                <AvatarFallback className="bg-slate-900 text-white font-bold text-xs">{request.userName.charAt(0)}</AvatarFallback>
                                                                            </Avatar>
                                                                            <div>
                                                                                <p className="font-semibold text-sm text-foreground">{request.userName}</p>
                                                                                <p className="text-xs text-muted-foreground">{request.department || 'Team Member'}</p>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-4">
                                                                        <Badge variant="outline" className="font-bold uppercase text-[10px] border-orange-200 text-orange-700 bg-orange-50">
                                                                            {request.type.replace(/_/g, ' ')}
                                                                        </Badge>
                                                                    </td>
                                                                    <td className="p-4 text-sm font-medium text-foreground">
                                                                        {format(parseISO(request.startDate), 'MMM dd, yyyy')}
                                                                    </td>
                                                                    <td className="p-4">
                                                                        {currentTime ? (
                                                                            <div>
                                                                                <p className="text-sm font-semibold text-slate-700">{formatWithTimezone(new Date(currentTime), viewerTimeZone, 'time')}</p>
                                                                                <p className="text-[9px] text-slate-400">Staff: {formatWithTimezone(new Date(currentTime), (request as any).userTimeZone || 'UTC', 'time')}</p>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-xs text-slate-400 italic">Not recorded</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-4">
                                                                        {request.time && (
                                                                            <div>
                                                                                <p className="text-sm font-bold text-orange-700">{formatWithTimezone(new Date(request.time), viewerTimeZone, 'time')}</p>
                                                                                <p className="text-[9px] text-orange-400">Staff: {formatWithTimezone(new Date(request.time), (request as any).userTimeZone || 'UTC', 'time')}</p>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-4">
                                                                        <p className="text-sm text-slate-600 italic line-clamp-2 max-w-[200px]">"{request.reason}"</p>
                                                                    </td>
                                                                    <td className="p-4">
                                                                        <div className="flex items-center justify-end gap-2">
                                                                            <Button onClick={() => handleAction(request, "approve")} size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8">
                                                                                <Check className="w-3 h-3 mr-1" /> Approve
                                                                            </Button>
                                                                            <Button onClick={() => handleAction(request, "deny")} size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8">
                                                                                <X className="w-3 h-3 mr-1" /> Deny
                                                                            </Button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </Card>
                                    </div>
                                )}

                                {/* Approval Requests Table */}
                                {filteredRequests.filter(r => r.kind === 'LEAVE').length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 px-1">
                                            <div className="h-4 w-1 bg-blue-400 rounded-full" />
                                            <CalendarDays className="w-4 h-4 text-blue-500" />
                                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Approval Requests</h3>
                                        </div>
                                        <Card className="border-border bg-white overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead className="bg-blue-50 border-b border-blue-100">
                                                        <tr>
                                                            <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Staff</th>
                                                            <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Leave Type</th>
                                                            <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Date Range</th>
                                                            <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Duration</th>
                                                            <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Reason</th>
                                                            <th className="text-right p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {filteredRequests.filter(r => r.kind === 'LEAVE').map(request => (
                                                            <tr key={request.id} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="p-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                                                                            <AvatarFallback className="bg-slate-900 text-white font-bold text-xs">{request.userName.charAt(0)}</AvatarFallback>
                                                                        </Avatar>
                                                                        <div>
                                                                            <p className="font-semibold text-sm text-foreground">{request.userName}</p>
                                                                            <p className="text-xs text-muted-foreground">{request.department || 'Team Member'}</p>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4">
                                                                    <Badge variant="outline" className="font-medium capitalize">
                                                                        {request.type.toLowerCase().replace(/_/g, ' ')}
                                                                    </Badge>
                                                                </td>
                                                                <td className="p-4 text-sm font-medium text-foreground">
                                                                    {format(parseISO(request.startDate), 'MMM dd, yyyy')}
                                                                    {request.startDate !== request.endDate && (
                                                                        <> — {format(parseISO(request.endDate), 'MMM dd')}</>
                                                                    )}
                                                                </td>
                                                                <td className="p-4 text-sm text-slate-600">{request.duration}</td>
                                                                <td className="p-4">
                                                                    <p className="text-sm text-slate-600 italic line-clamp-2 max-w-[200px]">"{request.reason}"</p>
                                                                </td>
                                                                <td className="p-4">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <Button onClick={() => handleAction(request, "approve")} size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8">
                                                                            <Check className="w-3 h-3 mr-1" /> Approve
                                                                        </Button>
                                                                        <Button onClick={() => handleAction(request, "deny")} size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8">
                                                                            <X className="w-3 h-3 mr-1" /> Deny
                                                                        </Button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </Card>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* --- HISTORY TAB --- */}
                <TabsContent value="history" className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 rounded-xl border border-border shadow-sm gap-4">
                        <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-blue-600" />
                            <h2 className="font-semibold text-foreground">Decision Archive</h2>
                        </div>
                        {managerDepartments.length > 1 && (
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-muted-foreground" />
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="h-9 w-auto px-3 min-w-[140px] justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 border-slate-200 bg-white hover:bg-slate-50">
                                            <span className="truncate max-w-[100px]">
                                                {selectedDepartments.length === 0 ? "Departments" : selectedDepartments.length === managerDepartments.length ? "All Depts" : `${selectedDepartments.length} Selected`}
                                            </span>
                                            <ChevronDown className="h-3 w-3 ml-2 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-56 p-2" align="start">
                                        <DropdownMenuLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Filter Departments</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <div className="max-h-[300px] overflow-y-auto space-y-1">
                                            <div className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md cursor-pointer"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (selectedDepartments.length === managerDepartments.length) {
                                                        setSelectedDepartments([]);
                                                    } else {
                                                        setSelectedDepartments(managerDepartments.map(d => d.id));
                                                    }
                                                }}>
                                                <Checkbox
                                                    checked={selectedDepartments.length === managerDepartments.length && managerDepartments.length > 0}
                                                    id="dept-all-history"
                                                />
                                                <label htmlFor="dept-all-history" className="text-xs font-bold cursor-pointer flex-1">Select All</label>
                                            </div>
                                            <DropdownMenuSeparator />
                                            {managerDepartments.map((dept) => (
                                                <div key={dept.id} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md cursor-pointer"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (selectedDepartments.includes(dept.id)) {
                                                            setSelectedDepartments(selectedDepartments.filter(id => id !== dept.id));
                                                        } else {
                                                            setSelectedDepartments([...selectedDepartments, dept.id]);
                                                        }
                                                    }}>
                                                    <Checkbox id={`dept-${dept.id}-history`} checked={selectedDepartments.includes(dept.id)} />
                                                    <label htmlFor={`dept-${dept.id}-history`} className="text-xs font-medium cursor-pointer flex-1 truncate">{dept.name}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </div>

                    <div className="grid gap-4">
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <Card key={i} className="border-border bg-white overflow-hidden">
                                    <div className="flex flex-col lg:flex-row">
                                        <div className="lg:w-1 bg-slate-200" />
                                        <CardContent className="flex-1 p-6">
                                            <div className="flex flex-col lg:flex-row gap-6 items-start">
                                                <Skeleton className="h-12 w-12 rounded-full" />
                                                <div className="flex-1 space-y-4 w-full">
                                                    <div className="flex justify-between w-full">
                                                        <div className="space-y-2">
                                                            <Skeleton className="h-6 w-32" />
                                                            <Skeleton className="h-4 w-24" />
                                                        </div>
                                                        <Skeleton className="h-6 w-24" />
                                                    </div>
                                                    <div className="grid sm:grid-cols-4 gap-4">
                                                        <Skeleton className="h-16 w-full rounded-lg" />
                                                        <Skeleton className="h-16 w-full rounded-lg" />
                                                        <Skeleton className="h-16 w-full rounded-lg col-span-2" />
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </div>
                                </Card>
                            ))
                        ) : filteredHistory.length === 0 ? (
                            <Card className="border-dashed shadow-none bg-muted/30">
                                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                                    <h3 className="text-lg font-semibold">No History</h3>
                                    <p className="text-muted-foreground">You haven't approved or denied any requests yet.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            filteredHistory.map(request => (
                                <Card key={request.id} className="group hover:shadow-md transition-all border-border bg-white overflow-hidden opacity-90">
                                    <div className="flex flex-col lg:flex-row">
                                        <div className={cn("lg:w-1", request.status === 'APPROVED' ? "bg-green-500" : "bg-red-500")} />
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
                                                        <Badge variant="outline" className={cn(
                                                            "font-bold",
                                                            request.status === 'APPROVED' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                                                        )}>
                                                            {request.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                        <div className="bg-muted/30 p-3 rounded-lg">
                                                            <p className="text-xs text-muted-foreground mb-1">{request.kind === 'ATTENDANCE' ? 'Amendment Type' : 'Leave Type'}</p>
                                                            <p className="font-semibold capitalize">{request.type.toLowerCase().replace(/_/g, ' ')}</p>
                                                        </div>
                                                        <div className="bg-muted/30 p-3 rounded-lg">
                                                            <p className="text-xs text-muted-foreground mb-1">{request.kind === 'ATTENDANCE' ? 'Corrected Time' : 'Duration / Time'}</p>
                                                            <div className="flex flex-col">
                                                                <p className="font-semibold">
                                                                    {request.kind === 'ATTENDANCE' && request.time
                                                                        ? formatWithTimezone(new Date(request.time), viewerTimeZone, 'time')
                                                                        : (request.kind === 'LEAVE' && request.startTime
                                                                            ? `${request.duration} (${formatWithTimezone(new Date(request.startTime), viewerTimeZone, 'time')})`
                                                                            : request.duration)}
                                                                </p>
                                                                {((request.kind === 'ATTENDANCE' && request.time) || (request.kind === 'LEAVE' && request.startTime)) && (
                                                                    <p className="text-[8px] text-muted-foreground font-medium uppercase tracking-widest">
                                                                        {viewerTimeZone === (request as any).userTimeZone ? 'Local' : (request as any).userTimeZone?.split('/').pop()?.replace('_', ' ')}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="bg-muted/30 p-3 rounded-lg col-span-2">
                                                            <p className="text-xs text-muted-foreground mb-1">Date Range</p>
                                                            <div className="flex items-center gap-2 font-medium">
                                                                <CalendarIcon className="w-4 h-4 text-primary" />
                                                                {format(parseISO(request.startDate), 'MMM dd, yyyy')}
                                                                {request.startDate !== request.endDate && (
                                                                    <> - {format(parseISO(request.endDate), 'MMM dd, yyyy')}</>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                                                        <p className="text-sm italic text-slate-600">"{request.reason}"</p>
                                                    </div>
                                                </div>

                                                <div className="flex lg:flex-col gap-2 pt-2 lg:pt-0">
                                                    <Button
                                                        onClick={() => {
                                                            setSelectedRequest(request)
                                                            setActionType(request.status === 'APPROVED' ? 'deny' : 'approve')
                                                            setDenyReason(request.declineReason || "")
                                                        }}
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                    >
                                                        <MessageSquare className="w-4 h-4 mr-2" /> Modify
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleDeleteHistory(request)}
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
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
                            <CardHeader className="border-b border-border bg-muted/10 p-4 flex flex-col gap-4">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
                                    {managerDepartments.length > 1 && (
                                        <div className="flex items-center gap-2">
                                            <Filter className="w-4 h-4 text-muted-foreground" />
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" className="h-9 w-auto px-3 min-w-[140px] justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 border-slate-200 bg-white hover:bg-slate-50">
                                                        <span className="truncate max-w-[100px]">
                                                            {selectedDepartments.length === 0 ? "Departments" : selectedDepartments.length === managerDepartments.length ? "All Depts" : `${selectedDepartments.length} Selected`}
                                                        </span>
                                                        <ChevronDown className="h-3 w-3 ml-2 opacity-50" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent className="w-56 p-2" align="start">
                                                    <DropdownMenuLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Filter Departments</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <div className="max-h-[300px] overflow-y-auto space-y-1">
                                                        <div className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md cursor-pointer"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                if (selectedDepartments.length === managerDepartments.length) {
                                                                    setSelectedDepartments([]);
                                                                } else {
                                                                    setSelectedDepartments(managerDepartments.map(d => d.id));
                                                                }
                                                            }}>
                                                            <Checkbox
                                                                checked={selectedDepartments.length === managerDepartments.length && managerDepartments.length > 0}
                                                                id="dept-all-calendar"
                                                            />
                                                            <label htmlFor="dept-all-calendar" className="text-xs font-bold cursor-pointer flex-1">Select All</label>
                                                        </div>
                                                        <DropdownMenuSeparator />
                                                        {managerDepartments.map((dept) => (
                                                            <div key={dept.id} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md cursor-pointer"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    if (selectedDepartments.includes(dept.id)) {
                                                                        setSelectedDepartments(selectedDepartments.filter(id => id !== dept.id));
                                                                    } else {
                                                                        setSelectedDepartments([...selectedDepartments, dept.id]);
                                                                    }
                                                                }}>
                                                                <Checkbox id={`dept-${dept.id}-calendar`} checked={selectedDepartments.includes(dept.id)} />
                                                                <label htmlFor={`dept-${dept.id}-calendar`} className="text-xs font-medium cursor-pointer flex-1 truncate">{dept.name}</label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    )}
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
                            <CardContent className="p-0 overflow-x-auto">
                                {isLoading ? (
                                    <div className="p-6">
                                        <div className="grid grid-cols-7 gap-4 mb-4">
                                            {Array.from({ length: 7 }).map((_, i) => (
                                                <Skeleton key={i} className="h-6 w-full rounded-md" />
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-7 gap-4 auto-rows-fr">
                                            {Array.from({ length: 35 }).map((_, i) => (
                                                <Skeleton key={i} className="h-24 w-full rounded-xl" />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="min-w-[800px]">
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
                                                                    {event.type === 'leave' && <span className="opacity-60 text-[8px]">({({
                                                                        SICK: 'SL', VACATION: 'VL', ANNUAL: 'AL',
                                                                        BIRTHDAY: 'BL', MATERNITY: 'ML', OTHER: 'OTH'
                                                                    } as Record<string,string>)[event.data.type] || event.data.type?.slice(0,3)})</span>}
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
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Side Panel: Team Leave Schedule */}
                        <div className="space-y-6">
                            <Card className="border border-border shadow-sm bg-white overflow-hidden h-full rounded-2xl flex flex-col">
                                <CardHeader className="border-b border-border bg-muted/10 p-5">
                                    <div className="flex items-center gap-2">
                                        <CalendarDays className="w-5 h-5 text-primary" />
                                        <div>
                                            <CardTitle className="text-base font-bold">Team Leave Schedule</CardTitle>
                                            <CardDescription className="text-xs">Upcoming &amp; current approved leave</CardDescription>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-4 text-xs font-medium">
                                        <button
                                            type="button"
                                            onClick={() => setLeaveFilter(f => f === 'all' ? 'all' : 'all')}
                                            className={cn(
                                                "px-2 py-1 rounded-md border transition-all",
                                                leaveFilter === 'all'
                                                    ? "bg-blue-600 text-white border-blue-600"
                                                    : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
                                            )}
                                        >
                                            {upcomingTeamLeaves.length} upcoming
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLeaveFilter(f => f === 'today' ? 'all' : 'today')}
                                            className={cn(
                                                "px-2 py-1 rounded-md border transition-all",
                                                leaveFilter === 'today'
                                                    ? "bg-amber-500 text-white border-amber-500"
                                                    : "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200"
                                            )}
                                        >
                                            {onLeaveTodayLeaves.length} on leave today
                                        </button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px]">
                                    {leaveFilter === 'today' && (
                                        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                                            On Leave Today
                                        </div>
                                    )}
                                    <div className="divide-y divide-border">
                                        {isLoading ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <div key={i} className="p-4 flex items-center gap-3">
                                                    <Skeleton className="h-9 w-9 rounded-full" />
                                                    <div className="flex-1 space-y-2">
                                                        <Skeleton className="h-4 w-24" />
                                                        <Skeleton className="h-3 w-32" />
                                                    </div>
                                                    <Skeleton className="h-5 w-16 rounded-md" />
                                                </div>
                                            ))
                                        ) : (() => {
                                            const displayLeaves = leaveFilter === 'today' ? onLeaveTodayLeaves : upcomingTeamLeaves
                                            const typeColors: Record<string, string> = {
                                                SICK: 'bg-rose-100 text-rose-700',
                                                VACATION: 'bg-sky-100 text-sky-700',
                                                BIRTHDAY: 'bg-purple-100 text-purple-700',
                                                MATERNITY: 'bg-pink-100 text-pink-700',
                                                OTHER: 'bg-slate-100 text-slate-600',
                                            }
                                            const typeLabel: Record<string, string> = {
                                                SICK: 'Sick',
                                                VACATION: 'Vacation',
                                                BIRTHDAY: 'Birthday',
                                                MATERNITY: 'Parental',
                                                OTHER: 'Other',
                                            }
                                            if (displayLeaves.length === 0) return (
                                                <div className="p-8 text-center text-muted-foreground text-sm">
                                                    <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                    {leaveFilter === 'today' ? 'No one on leave today.' : 'No upcoming leave scheduled.'}
                                                </div>
                                            )
                                            return displayLeaves.map(leave => {
                                                const startDate = parseISO(leave.startDate.slice(0, 10))
                                                const endDate = parseISO(leave.endDate.slice(0, 10))
                                                const isActive = leave.startDate.slice(0, 10) <= todayDateStr && leave.endDate.slice(0, 10) >= todayDateStr
                                                const dateLabel = isSameDay(startDate, endDate)
                                                    ? format(startDate, 'MMM d')
                                                    : `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d')}`
                                                return (
                                                    <div key={leave.id} className="p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                                                        <Avatar className="h-9 w-9 border border-border shrink-0">
                                                            <AvatarFallback className="text-xs">{leave.userName?.charAt(0) || '?'}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold truncate">{leave.userName}</p>
                                                            <p className="text-[10px] text-muted-foreground font-medium">
                                                                {dateLabel}{isActive && leaveFilter !== 'today' ? ' · Today' : ''}
                                                            </p>
                                                        </div>
                                                        <Badge variant="outline" className={cn(
                                                            "text-[9px] px-1.5 h-5 border-0 font-bold shrink-0",
                                                            typeColors[leave.type] || typeColors.OTHER
                                                        )}>
                                                            {typeLabel[leave.type] || leave.type}
                                                        </Badge>
                                                    </div>
                                                )
                                            })
                                        })()}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* --- PERFORMANCE TAB --- */}
                <TabsContent value="performance" className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <Card className="border border-border shadow-sm bg-white overflow-hidden rounded-2xl">
                        <CardHeader className="border-b border-border bg-muted/10 p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <TrendingUp className="w-6 h-6 text-primary" />
                                    <div>
                                        <CardTitle>Department Performance</CardTitle>
                                        <CardDescription>Monitor attendance trends and punctuality</CardDescription>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-2 bg-white border border-border px-3 py-1.5 rounded-lg shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <Label className="text-[10px] uppercase text-muted-foreground font-black">From</Label>
                                            <Input
                                                type="date"
                                                value={perfStartDate}
                                                onChange={e => setPerfStartDate(e.target.value)}
                                                className="h-7 w-[120px] p-1 text-xs border-none focus-visible:ring-0"
                                            />
                                        </div>
                                        <div className="w-px h-4 bg-border" />
                                        <div className="flex items-center gap-2">
                                            <Label className="text-[10px] uppercase text-muted-foreground font-black">To</Label>
                                            <Input
                                                type="date"
                                                value={perfEndDate}
                                                onChange={e => setPerfEndDate(e.target.value)}
                                                className="h-7 w-[120px] p-1 text-xs border-none focus-visible:ring-0"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex bg-white rounded-md shadow-sm">
                                        {/* Employment Location Filter */}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="h-9 w-auto px-3 min-w-[140px] justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 border-slate-200 bg-white hover:bg-slate-50 rounded-r-none border-r-0">
                                                    <span className="truncate max-w-[100px]">
                                                        {selectedEmploymentLocations.length === 0 || selectedEmploymentLocations.length === 2 ? "Location" : selectedEmploymentLocations.join(", ")}
                                                    </span>
                                                    <MapPin className="h-3 w-3 ml-2 opacity-50" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent className="w-48 p-2" align="start">
                                                <DropdownMenuLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Emp. Location</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <div className="space-y-1">
                                                    {['Philippines', 'Australia'].map((loc) => (
                                                        <div key={loc} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md cursor-pointer"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                if (selectedEmploymentLocations.includes(loc)) {
                                                                    setSelectedEmploymentLocations(selectedEmploymentLocations.filter(l => l !== loc));
                                                                } else {
                                                                    setSelectedEmploymentLocations([...selectedEmploymentLocations, loc]);
                                                                }
                                                            }}>
                                                            <Checkbox id={`loc-${loc}-perf`} checked={selectedEmploymentLocations.includes(loc)} />
                                                            <label htmlFor={`loc-${loc}-perf`} className="text-xs font-medium cursor-pointer flex-1">{loc}</label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        {/* Department Filter */}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="h-9 w-auto px-3 min-w-[140px] justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 border-slate-200 bg-white hover:bg-slate-50 rounded-l-none">
                                                    <span className="truncate max-w-[100px]">
                                                        {selectedDepartments.length === 0 ? "Departments" : selectedDepartments.length === managerDepartments.length ? "All Depts" : `${selectedDepartments.length} Selected`}
                                                    </span>
                                                    <ChevronDown className="h-3 w-3 ml-2 opacity-50" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent className="w-56 p-2" align="start">
                                                <DropdownMenuLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Filter Departments</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <div className="max-h-[300px] overflow-y-auto space-y-1">
                                                    <div className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md cursor-pointer"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (selectedDepartments.length === managerDepartments.length) {
                                                                setSelectedDepartments([]);
                                                            } else {
                                                                setSelectedDepartments(managerDepartments.map(d => d.id));
                                                            }
                                                        }}>
                                                        <Checkbox
                                                            checked={selectedDepartments.length === managerDepartments.length && managerDepartments.length > 0}
                                                            id="dept-all-perf"
                                                        />
                                                        <label htmlFor="dept-all-perf" className="text-xs font-bold cursor-pointer flex-1">Select All</label>
                                                    </div>
                                                    <DropdownMenuSeparator />
                                                    {managerDepartments.map((dept) => (
                                                        <div key={dept.id} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md cursor-pointer"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                if (selectedDepartments.includes(dept.id)) {
                                                                    setSelectedDepartments(selectedDepartments.filter(id => id !== dept.id));
                                                                } else {
                                                                    setSelectedDepartments([...selectedDepartments, dept.id]);
                                                                }
                                                            }}>
                                                            <Checkbox id={`dept-${dept.id}-perf`} checked={selectedDepartments.includes(dept.id)} />
                                                            <label htmlFor={`dept-${dept.id}-perf`} className="text-xs font-medium cursor-pointer flex-1 truncate">{dept.name}</label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8">
                            {isFetchingPerformance ? (
                                <div className="space-y-8">
                                    <Skeleton className="h-[350px] w-full rounded-xl" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <Skeleton className="h-[300px] w-full rounded-xl" />
                                        <Skeleton className="h-[300px] w-full rounded-xl" />
                                    </div>
                                </div>
                            ) : performanceData.length > 0 ? (
                                <div className="space-y-8">
                                    <div className="h-[350px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={performanceData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis
                                                    dataKey="date"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                                                />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                                                />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Legend iconType="circle" />
                                                <Line
                                                    type="monotone"
                                                    dataKey="present"
                                                    name="On-Time"
                                                    stroke="#10b981"
                                                    strokeWidth={3}
                                                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="late"
                                                    name="Late Punctuality"
                                                    stroke="#f59e0b"
                                                    strokeWidth={3}
                                                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="absent"
                                                    name="Absent"
                                                    stroke="#ef4444"
                                                    strokeWidth={3}
                                                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Avg. Presence</p>
                                            <div className="flex items-end gap-2">
                                                <h3 className="text-2xl font-black text-emerald-900">
                                                    {performanceData.length > 0 ? Math.round((performanceData.reduce((acc, d) => acc + d.basePresent, 0) / (performanceData.length * (filteredTeam.length || 1))) * 100) : 0}%
                                                </h3>
                                                <span className="text-xs font-bold text-emerald-600 mb-1">Stability</span>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
                                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Tardiness Rate</p>
                                            <div className="flex items-end gap-2">
                                                <h3 className="text-2xl font-black text-amber-900">
                                                    {performanceData.reduce((acc, d) => acc + d.basePresent, 0) > 0 ? Math.round((performanceData.reduce((acc, d) => acc + d.late, 0) / (performanceData.reduce((acc, d) => acc + d.basePresent, 0) || 1)) * 100) : 0}%
                                                </h3>
                                                <span className="text-xs font-bold text-amber-600 mb-1">Incidence</span>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-red-50 border border-red-100">
                                            <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">Missed Shifts</p>
                                            <div className="flex items-end gap-2">
                                                <h3 className="text-2xl font-black text-red-900">
                                                    {performanceData.reduce((acc, d) => acc + d.absent, 0)}
                                                </h3>
                                                <span className="text-xs font-bold text-red-600 mb-1">Total count</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Individual Staff Cards */}
                                    <div className="pt-8 border-t border-border">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                                <Users className="h-4 w-4 text-primary" />
                                                Individual Performance Breakdown
                                            </h3>
                                            <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg">
                                                <Button
                                                    variant={perfViewMode === 'card' ? 'default' : 'ghost'}
                                                    size="sm"
                                                    onClick={() => setPerfViewMode('card')}
                                                    className="h-7 px-2"
                                                >
                                                    <LayoutGrid className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant={perfViewMode === 'table' ? 'default' : 'ghost'}
                                                    size="sm"
                                                    onClick={() => setPerfViewMode('table')}
                                                    className="h-7 px-2"
                                                >
                                                    <List className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {perfViewMode === 'card' ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                                {filteredTeam.map(member => (
                                                    <StaffPerformanceCard
                                                        key={member.id}
                                                        user={member}
                                                        attendanceRecords={rawPerformanceData.filter((a: any) => a.userId === member.id)}
                                                        dateRange={{ start: perfStartDate, end: perfEndDate }}
                                                        onEditWorkHours={openEditWorkHours}
                                                        onClick={setSelectedStaffForLogs}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <Card className="border-border bg-white overflow-hidden">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full">
                                                        <thead className="bg-slate-50 border-b border-slate-200">
                                                            <tr>
                                                                <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Staff Member</th>
                                                                <th className="text-center p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Punctuality</th>
                                                                <th className="text-center p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Avg. Lateness</th>
                                                                <th className="text-center p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">On-Time</th>
                                                                <th className="text-center p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Late Time (Accumulated)</th>
                                                                <th className="text-right p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {filteredTeam.map(member => {
                                                                const metrics = calculateUserPerformanceMetrics(
                                                                    rawPerformanceData.filter((a: any) => a.userId === member.id),
                                                                    member
                                                                )
                                                                return (
                                                                    <tr
                                                                        key={member.id}
                                                                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                                                                        onClick={() => setSelectedStaffForLogs(member)}
                                                                    >
                                                                        <td className="p-4">
                                                                            <div className="flex items-center gap-3">
                                                                                <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                                                                                    <AvatarFallback className="bg-slate-900 text-white font-bold text-xs">{member.name.charAt(0)}</AvatarFallback>
                                                                                </Avatar>
                                                                                <div>
                                                                                    <p className="font-semibold text-sm text-foreground">{member.name}</p>
                                                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{member.departmentId ? managerDepartments.find(d => d.id === member.departmentId)?.name : 'Team Member'}</p>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="p-4 text-center">
                                                                            <Badge variant="outline" className={cn("font-bold", metrics.punctualityColor)}>
                                                                                {metrics.punctualityRate}%
                                                                            </Badge>
                                                                        </td>
                                                                        <td className="p-4 text-center">
                                                                            <span className={cn("font-mono font-bold text-sm", metrics.tardinessColor)}>
                                                                                {metrics.avgTardiness} min
                                                                            </span>
                                                                        </td>
                                                                        <td className="p-4 text-center">
                                                                            <span className="text-sm font-semibold text-emerald-600">{metrics.onTimeDays}</span>
                                                                        </td>
                                                                        <td className="p-4 text-center">
                                                                            <span className={cn("text-sm font-semibold", metrics.totalLateMinutes > 0 ? "text-amber-600" : "text-slate-400")}>
                                                                                {metrics.totalLateMinutes > 0 ? `${metrics.totalLateMinutes} min` : "--"}
                                                                            </span>
                                                                        </td>
                                                                        <td className="p-4 text-right">
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    openEditWorkHours(member);
                                                                                }}
                                                                                className="h-8 w-8 p-0"
                                                                                title="Edit Shift Hours"
                                                                            >
                                                                                <Edit className="w-4 h-4 text-slate-400 hover:text-primary" />
                                                                            </Button>
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </Card>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2">
                                    <TrendingUp className="w-12 h-12" />
                                    <p className="font-bold">No performance data available for this range</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- REPORTS TAB --- */}
                <TabsContent value="reports" className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <Card className="border border-border shadow-sm bg-white overflow-hidden rounded-2xl">
                        <CardHeader className="border-b border-border bg-muted/10 p-6">
                            <div className="flex items-center gap-3">
                                <Download className="w-6 h-6 text-primary" />
                                <div>
                                    <CardTitle>Team Attendance Reports</CardTitle>
                                    <CardDescription>Generate and download attendance data for your team members</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold flex items-center gap-2">
                                            <CalendarIcon className="w-4 h-4 text-primary" />
                                            Date Range
                                        </Label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">From</p>
                                                <Input
                                                    type="date"
                                                    value={reportStartDate}
                                                    onChange={e => setReportStartDate(e.target.value)}
                                                    className="bg-muted/30 border-border"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">To</p>
                                                <Input
                                                    type="date"
                                                    value={reportEndDate}
                                                    onChange={e => setReportEndDate(e.target.value)}
                                                    className="bg-muted/30 border-border"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-primary" />
                                            Target Department
                                        </Label>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="h-9 w-auto px-3 min-w-[140px] justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 border-slate-200 bg-white hover:bg-slate-50 w-full justify-between">
                                                    <span className="truncate">
                                                        {selectedDepartments.length === 0 ? "All Managed Departments" : selectedDepartments.length === managerDepartments.length ? "All Managed Departments" : `${selectedDepartments.length} Selected`}
                                                    </span>
                                                    <ChevronDown className="h-3 w-3 ml-2 opacity-50" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent className="w-[350px] p-2" align="start">
                                                <DropdownMenuLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Filter Departments</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <div className="max-h-[300px] overflow-y-auto space-y-1">
                                                    <div className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md cursor-pointer"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (selectedDepartments.length === managerDepartments.length) {
                                                                setSelectedDepartments([]);
                                                                setReportSelectedStaff([]);
                                                            } else {
                                                                setSelectedDepartments(managerDepartments.map(d => d.id));
                                                                setReportSelectedStaff([]);
                                                            }
                                                        }}>
                                                        <Checkbox
                                                            checked={selectedDepartments.length === managerDepartments.length && managerDepartments.length > 0}
                                                            id="dept-all-reports"
                                                        />
                                                        <label htmlFor="dept-all-reports" className="text-xs font-bold cursor-pointer flex-1">Select All</label>
                                                    </div>
                                                    <DropdownMenuSeparator />
                                                    {managerDepartments.map((dept) => (
                                                        <div key={dept.id} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md cursor-pointer"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                let newDepts;
                                                                if (selectedDepartments.includes(dept.id)) {
                                                                    newDepts = selectedDepartments.filter(id => id !== dept.id);
                                                                } else {
                                                                    newDepts = [...selectedDepartments, dept.id];
                                                                }
                                                                setSelectedDepartments(newDepts);
                                                                setReportSelectedStaff([]);
                                                            }}>
                                                            <Checkbox id={`dept-${dept.id}-reports`} checked={selectedDepartments.includes(dept.id)} />
                                                            <label htmlFor={`dept-${dept.id}-reports`} className="text-xs font-medium cursor-pointer flex-1 truncate">{dept.name}</label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm font-bold flex items-center gap-2">
                                                <Users className="w-4 h-4 text-primary" />
                                                Select Personnel ({reportSelectedStaff.length === 0 ? 'All' : reportSelectedStaff.length})
                                            </Label>
                                            {filteredTeam.length > 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80"
                                                    onClick={() => {
                                                        if (reportSelectedStaff.length === filteredTeam.length) {
                                                            setReportSelectedStaff([])
                                                        } else {
                                                            setReportSelectedStaff(filteredTeam.map(s => s.id))
                                                        }
                                                    }}
                                                >
                                                    {reportSelectedStaff.length === filteredTeam.length ? 'Deselect All' : 'Select All'}
                                                </Button>
                                            )}
                                        </div>
                                        <div className="border border-border rounded-xl bg-muted/20 p-3 max-h-[200px] overflow-y-auto space-y-2 custom-scrollbar">
                                            {isLoading ? (
                                                <div className="space-y-2">
                                                    {Array.from({ length: 3 }).map((_, i) => (
                                                        <Skeleton key={i} className="h-10 w-full rounded-lg" />
                                                    ))}
                                                </div>
                                            ) : filteredTeam.length === 0 ? (
                                                <p className="text-xs text-center py-4 text-muted-foreground italic">No staff found in this scope</p>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-1">
                                                    {filteredTeam.map(member => (
                                                        <div
                                                            key={member.id}
                                                            onClick={() => {
                                                                setReportSelectedStaff(prev =>
                                                                    prev.includes(member.id)
                                                                        ? prev.filter(id => id !== member.id)
                                                                        : [...prev, member.id]
                                                                )
                                                            }}
                                                            className={cn(
                                                                "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border",
                                                                reportSelectedStaff.includes(member.id)
                                                                    ? "bg-primary/10 border-primary/20 text-primary"
                                                                    : "bg-white border-transparent hover:bg-white/80 hover:border-border"
                                                            )}
                                                        >
                                                            <div className={cn(
                                                                "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                                                reportSelectedStaff.includes(member.id)
                                                                    ? "bg-primary border-primary text-white"
                                                                    : "bg-white border-slate-300"
                                                            )}>
                                                                {reportSelectedStaff.includes(member.id) && <Check className="w-3 h-3 stroke-[3]" />}
                                                            </div>
                                                            <Avatar className="h-6 w-6 border border-border">
                                                                <AvatarFallback className="text-[8px] font-bold bg-slate-100 text-slate-600">{member.name.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <span className="text-xs font-semibold truncate">{member.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Reports are generated dynamically based on your filters. Higher staff counts and wider date ranges may take a few seconds to process.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col justify-end gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
                                    <div className="space-y-2 mb-4">
                                        <h4 className="font-bold text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-4">Output Payload</h4>
                                        <ul className="text-xs space-y-3 text-slate-600 font-medium">
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                Detailed Master Ledger (Log-by-log)
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                Team Summary (Aggregation by Staff)
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                Smart Commenting (Flags & Notes)
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                Tardiness/Punctuality Monitoring
                                            </li>
                                        </ul>
                                    </div>
                                    <Button
                                        onClick={async () => {
                                            setIsGeneratingReport(true)
                                            try {
                                                const staffIds = reportSelectedStaff.length > 0
                                                    ? reportSelectedStaff
                                                    : filteredTeam.map(s => s.id)

                                                if (staffIds.length === 0) {
                                                    alert("No staff members selected for the report.")
                                                    return
                                                }

                                                const params = new URLSearchParams({
                                                    startDate: reportStartDate,
                                                    endDate: reportEndDate,
                                                    userIds: staffIds.join(','),
                                                    includeAll: 'true'
                                                })

                                                const res = await fetch(`/api/attendance?${params.toString()}`)
                                                if (!res.ok) throw new Error("Failed to fetch report data")
                                                const data = await res.json()

                                                // Prepare Workbook
                                                const wb = XLSX.utils.book_new()

                                                // 1. Detailed Ledger Sheet
                                                const logData = data.map((record: any) => {
                                                    const clockInData = record.clockIn ? prepareTimeForExport(record.clockIn, reportTimezone) : null
                                                    const clockOutData = record.clockOut ? prepareTimeForExport(record.clockOut, reportTimezone) : null

                                                    const comments: string[] = []
                                                    if (record.pendingRequests?.length > 0) {
                                                        record.pendingRequests.forEach((pr: any) => comments.push(`PENDING: ${pr.type}`))
                                                    }
                                                    if (!record.clockIn && record.clockOut) comments.push("CRITICAL: MISSING CLOCK IN")
                                                    if (record.clockIn && !record.clockOut && record.date < format(new Date(), 'yyyy-MM-dd')) comments.push("CRITICAL: MISSING CLOCK OUT")

                                                    // Tardiness check (dynamic)
                                                    const user = filteredTeam.find((u: any) => u.id === record.userId)
                                                    const shiftStart = record.scheduledStart || user?.shiftStartTime || "09:00"
                                                    const shiftEnd = record.scheduledEnd || user?.shiftEndTime || "17:00"

                                                    if (record.clockIn && record.status !== 'on-leave') {
                                                        const tardiness = calculateTardiness(record, user || { shiftStartTime: "09:00" })
                                                        if (tardiness > 5) {
                                                            comments.push(`LATE: ${tardiness} min (Expected: ${shiftStart})`)
                                                        }
                                                    }

                                                    if (record.notes) comments.push(`NOTE: ${record.notes}`)

                                                    return {
                                                        'Staff Member': record.userName,
                                                        'Department': record.department,
                                                        'Date': record.date,
                                                        'Scheduled Shift': `${shiftStart} - ${shiftEnd}`,
                                                        'Clock In': clockInData ? formatWithTimezone(record.clockIn, reportTimezone, 'time') : '-',
                                                        'Clock Out': clockOutData ? formatWithTimezone(record.clockOut, reportTimezone, 'time') : '-',
                                                        'Mode': record.mode,
                                                        'Status': record.status.toUpperCase(),
                                                        'Tardiness (min)': calculateTardiness(record, user || { shiftStartTime: "09:00" }),
                                                        'Flags/Comments': comments.join(' | '),
                                                        'Session Timezone': reportTimezone
                                                    }
                                                })

                                                const ws = XLSX.utils.json_to_sheet(logData)
                                                // Column Widths
                                                ws['!cols'] = [
                                                    { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 20 },
                                                    { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
                                                    { wch: 50 }, { wch: 25 }
                                                ]
                                                XLSX.utils.book_append_sheet(wb, ws, "Attendance Ledger")

                                                // 2. Team Summary Sheet
                                                const summary = (reportSelectedStaff.length > 0
                                                    ? filteredTeam.filter(m => reportSelectedStaff.includes(m.id))
                                                    : filteredTeam
                                                ).map(member => {
                                                    const memberLogs = data.filter((d: any) => d.userId === member.id)
                                                    // Pass member directly, assuming calculateUserPerformanceMetrics handles default shift times if missing on member
                                                    const metrics = calculateUserPerformanceMetrics(memberLogs, member)

                                                    return {
                                                        'Name': member.name,
                                                        'Department': (typeof member.department === 'object' ? (member.department as any)?.name : member.department) || '-',
                                                        'Default Shift': `${member.shiftStartTime || "09:00"} - ${member.shiftEndTime || "17:00"}`,
                                                        'Scope From': reportStartDate,
                                                        'Scope To': reportEndDate,
                                                        'Total Entries': metrics.totalDays,
                                                        'Late Arrivals': metrics.lateDays,
                                                        'Avg Tardiness (min)': metrics.avgTardiness,
                                                        'Avg Early Dep (min)': metrics.avgEarlyDeparture,
                                                        'Total Hours': metrics.totalHoursWorked,
                                                        'Hours Variance': metrics.hoursVariance,
                                                        'Punctuality %': metrics.punctualityRate + '%'
                                                    }
                                                })
                                                const wsSummary = XLSX.utils.json_to_sheet(summary)
                                                wsSummary['!cols'] = [
                                                    { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
                                                    { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
                                                ]
                                                XLSX.utils.book_append_sheet(wb, wsSummary, "Team Summary Matrix")

                                                const deptName = selectedDepartments.length === managerDepartments.length ? 'All_Depts' : selectedDepartments.length > 1 ? 'Multiple_Depts' : selectedDepartments.length === 1 ? (managerDepartments.find(d => d.id === selectedDepartments[0])?.name || 'Dept') : 'No_Dept';
                                                const filename = `Team_Report_${deptName.replace(/\s+/g, '_')}_${reportStartDate}-to-${reportEndDate}.xlsx`
                                                XLSX.writeFile(wb, filename)
                                            } catch (error) {
                                                console.error(error)
                                                alert("Error generating report")
                                            } finally {
                                                setIsGeneratingReport(false)
                                            }
                                        }}
                                        className="w-full h-12 text-sm font-black shadow-xl bg-slate-900 hover:bg-slate-800 text-white rounded-xl uppercase tracking-widest border-b-4 border-slate-700 active:border-b-0 active:translate-y-1 transition-all"
                                        disabled={isGeneratingReport}
                                    >
                                        {isGeneratingReport ? (
                                            <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Compiling Report...</>
                                        ) : (
                                            <><Download className="w-5 h-5 mr-3" /> Download Team Ledger</>
                                        )}
                                    </Button>
                                    <p className="text-[10px] text-center text-slate-500 font-medium leading-relaxed">
                                        Times are based on your active timezone ({reportTimezone}).<br />
                                        To change this, please use the <strong>Timezone</strong> selector in the navigation top bar.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- GRANT LEAVE TAB --- */}
                <TabsContent value="grant-leave" className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-border shadow-sm">
                        <FilePlus2 className="w-5 h-5 text-green-600" />
                        <div>
                            <h2 className="font-semibold text-foreground">Grant Leave Record</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Create an approved leave record for a team member. They will be notified and will not appear as late or absent.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Form Card */}
                        <Card className="lg:col-span-2 border-border bg-white shadow-sm">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-base font-semibold">Leave Details</CardTitle>
                                <CardDescription>Fill in the details below to create an approved leave record.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleGrantLeave} className="space-y-5">
                                    <div className="space-y-2">
                                        <Label htmlFor="grant-staff">Staff Member</Label>
                                        <Select value={grantLeaveEmpId} onValueChange={setGrantLeaveEmpId}>
                                            <SelectTrigger id="grant-staff" className="bg-muted/30 h-10">
                                                <SelectValue placeholder="Select team member..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {myTeam.map((emp: any) => (
                                                    <SelectItem key={emp.id} value={emp.id}>
                                                        {emp.name}{emp.department?.name ? ` — ${emp.department.name}` : ""}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="grant-start">Start Date</Label>
                                            <Input
                                                id="grant-start"
                                                type="date"
                                                value={grantLeaveStart}
                                                onChange={(e) => {
                                                    setGrantLeaveStart(e.target.value)
                                                    if (e.target.value > grantLeaveEnd) setGrantLeaveEnd(e.target.value)
                                                }}
                                                className="bg-muted/30 h-10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="grant-end">End Date</Label>
                                            <Input
                                                id="grant-end"
                                                type="date"
                                                value={grantLeaveEnd}
                                                min={grantLeaveStart}
                                                onChange={(e) => setGrantLeaveEnd(e.target.value)}
                                                className="bg-muted/30 h-10"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="grant-type">Leave Type</Label>
                                            <Select value={grantLeaveType} onValueChange={setGrantLeaveType}>
                                                <SelectTrigger id="grant-type" className="bg-muted/30 h-10">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="SICK">Sick Leave</SelectItem>
                                                    <SelectItem value="VACATION">Vacation</SelectItem>
                                                    <SelectItem value="BIRTHDAY">Birthday Leave</SelectItem>
                                                    <SelectItem value="MATERNITY">Maternity / Paternity</SelectItem>
                                                    <SelectItem value="OTHER">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="grant-duration">Duration</Label>
                                            <Select value={grantLeaveDuration} onValueChange={setGrantLeaveDuration}>
                                                <SelectTrigger id="grant-duration" className="bg-muted/30 h-10">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Full Day">Full Day</SelectItem>
                                                    <SelectItem value="Part Day">Part Day</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {grantLeaveDuration === 'Part Day' && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="grant-start-time">Start Time</Label>
                                                <Input
                                                    id="grant-start-time"
                                                    type="time"
                                                    value={grantLeaveStartTime}
                                                    onChange={(e) => setGrantLeaveStartTime(e.target.value)}
                                                    className="bg-muted/30 h-10"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="grant-end-time">End Time</Label>
                                                <Input
                                                    id="grant-end-time"
                                                    type="time"
                                                    value={grantLeaveEndTime}
                                                    onChange={(e) => setGrantLeaveEndTime(e.target.value)}
                                                    className="bg-muted/30 h-10"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="grant-reason">
                                            Reason / Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                                        </Label>
                                        <Textarea
                                            id="grant-reason"
                                            placeholder="Add any notes about this leave..."
                                            value={grantLeaveReason}
                                            onChange={(e) => setGrantLeaveReason(e.target.value)}
                                            className="bg-muted/30 resize-none"
                                            rows={4}
                                        />
                                    </div>

                                    <div className="flex justify-end pt-2">
                                        <Button
                                            type="submit"
                                            disabled={isGrantingLeave}
                                            className="bg-green-600 hover:bg-green-700 text-white px-8 h-10 font-semibold"
                                        >
                                            {isGrantingLeave ? (
                                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Record...</>
                                            ) : (
                                                <><CheckCircle2 className="w-4 h-4 mr-2" /> Grant Leave</>
                                            )}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Info Panel */}
                        <div className="space-y-4">
                            <Card className="border-green-100 bg-green-50 shadow-none">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold text-green-800 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" />
                                        What this does
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-xs text-green-700">
                                    <p>• Creates an <strong>approved</strong> leave record immediately — no approval step needed.</p>
                                    <p>• The staff member will receive an in-app notification and email.</p>
                                    <p>• They will <strong>not</strong> appear as late or absent on that day.</p>
                                    <p>• They will <strong>not</strong> be sent a missed check-in reminder.</p>
                                </CardContent>
                            </Card>

                            <Card className="border-border bg-white shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-amber-500" />
                                        Leave Types
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-xs text-muted-foreground">
                                    <p><strong className="text-foreground">Sick Leave</strong> — Medical absence</p>
                                    <p><strong className="text-foreground">Vacation</strong> — Annual leave</p>
                                    <p><strong className="text-foreground">Birthday</strong> — One per calendar year</p>
                                    <p><strong className="text-foreground">Maternity / Paternity</strong> — Parental leave</p>
                                    <p><strong className="text-foreground">Other</strong> — Any other reason</p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Performance Detail Dialog */}
            <Dialog open={!!selectedStaffForLogs} onOpenChange={(open) => !open && setSelectedStaffForLogs(null)}>
                <DialogContent className="w-[95vw] max-w-5xl max-h-[85vh] flex flex-col">
                    <DialogHeader className="border-b pb-4">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                <AvatarFallback className="bg-slate-900 text-white font-bold">{selectedStaffForLogs?.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <DialogTitle className="text-xl">{selectedStaffForLogs?.name}</DialogTitle>
                                <DialogDescription className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="font-normal bg-slate-50">
                                        {selectedStaffForLogs?.department?.name || selectedStaffForLogs?.department || 'Staff Member'}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">•</span>
                                    <span className="text-xs text-muted-foreground">Performance Logs ({format(parseISO(perfStartDate), 'MMM dd')} - {format(parseISO(perfEndDate), 'MMM dd')})</span>
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-[300px] p-1">
                        <Table>
                            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="w-[140px]">Date</TableHead>
                                    <TableHead>Clock In</TableHead>
                                    <TableHead>Clock Out</TableHead>
                                    <TableHead>Breaks</TableHead>
                                    <TableHead>Total Hours</TableHead>
                                    <TableHead>Lateness</TableHead>
                                    <TableHead className="text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(() => {
                                    if (!selectedStaffForLogs) return null

                                    const logs = rawPerformanceData
                                        .filter((a: any) => a.userId === selectedStaffForLogs.id)
                                        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

                                    if (logs.length === 0) {
                                        return (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                                                    No attendance records found for this period.
                                                </TableCell>
                                            </TableRow>
                                        )
                                    }

                                    return logs.map((log: any) => {
                                        const date = parseISO(log.date.split('T')[0])
                                        const clockIn = log.clockIn ? new Date(log.clockIn) : null
                                        const clockOut = log.clockOut ? new Date(log.clockOut) : null
                                        const tardiness = calculateTardiness(log, selectedStaffForLogs)

                                        // Calculate break duration
                                        const breakDuration = log.breaks?.reduce((total: number, b: any) => {
                                            if (b.start && b.end) {
                                                return total + (new Date(b.end).getTime() - new Date(b.start).getTime())
                                            }
                                            return total
                                        }, 0) || 0
                                        const breakMinutes = Math.floor(breakDuration / 1000 / 60)

                                        // Status Color
                                        let statusColor = "bg-slate-100 text-slate-600"
                                        if (log.status === 'present' || log.status === 'clocked-in' || (clockIn && clockOut)) statusColor = "bg-green-100 text-green-700"
                                        if (log.status === 'late') statusColor = "bg-amber-100 text-amber-700"
                                        if (log.status === 'absent' || log.status === 'on-leave') statusColor = "bg-red-100 text-red-700"

                                        return (
                                            <TableRow key={log.id} className="hover:bg-slate-50">
                                                <TableCell className="font-medium text-xs">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-700">{format(date, 'MMM dd, yyyy')}</span>
                                                        <span className="text-[10px] text-muted-foreground uppercase">{format(date, 'EEEE')}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {clockIn ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <LogIn className="w-3 h-3 text-green-600" />
                                                            <span className="font-mono">{format(clockIn, 'hh:mm a')}</span>
                                                        </div>
                                                    ) : <span className="text-slate-300">--:--</span>}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {clockOut ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <LogOut className="w-3 h-3 text-red-600" />
                                                            <span className="font-mono">{format(clockOut, 'hh:mm a')}</span>
                                                        </div>
                                                    ) : <span className="text-slate-300">--:--</span>}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {breakMinutes > 0 ? (
                                                        <Badge variant="outline" className="font-normal text-[10px] h-5">
                                                            {breakMinutes} min
                                                        </Badge>
                                                    ) : <span className="text-slate-300 text-[10px]">-</span>}
                                                </TableCell>
                                                <TableCell className="text-xs font-mono font-bold text-slate-700">
                                                    {clockIn && clockOut ? (
                                                        (() => {
                                                            const diff = clockOut.getTime() - clockIn.getTime() - breakDuration
                                                            const hours = Math.floor(diff / 1000 / 60 / 60)
                                                            const mins = Math.floor((diff / 1000 / 60) % 60)
                                                            return `${hours}h ${mins}m`
                                                        })()
                                                    ) : <span className="text-slate-300">--</span>}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {tardiness > 0 ? (
                                                        <span className="text-amber-600 font-bold">{tardiness} min</span>
                                                    ) : <span className="text-slate-300">--</span>}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant="secondary" className={cn("text-[10px] font-bold h-5 px-1.5 uppercase tracking-wide", statusColor)}>
                                                        {log.status?.replace('_', ' ') || 'Absent'}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                })()}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

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
            {/* Edit Work Hours Dialog */}
            <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Update Work Schedule</DialogTitle>
                        <DialogDescription>
                            Change default shift hours for <span className="font-bold text-foreground">{editingMember?.name}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="start-time">Shift Start</Label>
                            <Input
                                id="start-time"
                                type="time"
                                value={editShiftStart}
                                onChange={(e) => setEditShiftStart(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="end-time">Shift End</Label>
                            <Input
                                id="end-time"
                                type="time"
                                value={editShiftEnd}
                                onChange={(e) => setEditShiftEnd(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingMember(null)}>Cancel</Button>
                        <Button onClick={handleSaveWorkHours} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    )
}
