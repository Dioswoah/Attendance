"use client"

import { toast } from "sonner"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Search,
    Loader2,
    Download,
    Building2,
    Database,
    MapPin,
    UserCog,
    FileSpreadsheet,
    CalendarDays,
    ToggleLeft,
    CalendarOff,
    ChevronRight
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import * as XLSX from 'xlsx'
import { format } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Users, ChevronDown } from "lucide-react"
import { AdminTimezoneSelect } from "@/components/AdminTimezoneSelect"
import { prepareTimeForExport, formatWithTimezone, getBrowserTimezone } from "@/lib/timezone"
import { useSession } from "next-auth/react"

// ── Lateness helpers ──────────────────────────────────────────────────────────
const LATE_GRACE_SEC = 5 * 60 // 5-minute grace, consistent across AU (DB) and PH (biometric)

// Parse a biometric wall-clock string ("06:05:47 AM" / "6:05 AM" / "06:05:47") -> seconds since midnight
function bioTimeToSec(t: string | null): number | null {
    if (!t || t === '--') return null
    const m = t.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i)
    if (m) {
        let h = parseInt(m[1]); const min = parseInt(m[2]); const s = m[3] ? parseInt(m[3]) : 0
        if (m[4].toUpperCase() === 'PM' && h !== 12) h += 12
        if (m[4].toUpperCase() === 'AM' && h === 12) h = 0
        return h * 3600 + min * 60 + s
    }
    const p = t.split(':')
    if (p.length >= 2) return (parseInt(p[0]) || 0) * 3600 + (parseInt(p[1]) || 0) * 60 + (p[2] ? parseInt(p[2]) || 0 : 0)
    return null
}

function hhmmToSec(s: string): number {
    const [h, m] = (s || '09:00').split(':').map(Number)
    return (h || 0) * 3600 + (m || 0) * 60
}

function secToHHMMSS(sec: number): string {
    const v = Math.max(0, Math.round(sec))
    const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60), s = v % 60
    return [h, m, s].map(x => String(x).padStart(2, '0')).join(':')
}

// Seconds-since-midnight of a UTC timestamp in a given timezone's wall clock
function clockInSecInTz(iso: string, tz: string): number | null {
    try {
        const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date(iso))
        const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value || '0')
        let h = get('hour'); if (h === 24) h = 0
        return h * 3600 + get('minute') * 60 + get('second')
    } catch { return null }
}

function dateRangeList(startStr: string, endStr: string): string[] {
    const out: string[] = []
    const cur = new Date(startStr + 'T12:00:00Z')
    const end = new Date(endStr + 'T12:00:00Z')
    while (cur <= end) { out.push(cur.toISOString().split('T')[0]); cur.setUTCDate(cur.getUTCDate() + 1) }
    return out
}

export default function ExportPage() {
    const [generating, setGenerating] = useState(false)
    const [departments, setDepartments] = useState<any[]>([])
    const [allStaff, setAllStaff] = useState<any[]>([])
    const [managers, setManagers] = useState<any[]>([])

    // Filters
    const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [selectedDept, setSelectedDept] = useState("all")
    const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
    const [staffSearchQuery, setStaffSearchQuery] = useState("")
    const [selectedLocation, setSelectedLocation] = useState("all")
    const [selectedManagerId, setSelectedManagerId] = useState("all")
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
    const [includeWeekends, setIncludeWeekends] = useState(false)
    const [exportSheets, setExportSheets] = useState<string[]>(['ledger', 'summary'])
    const [reportTimezone, setReportTimezone] = useState("Australia/Sydney")
    const { data: session } = useSession()

    // Leave Records state
    const [leaveStartDate, setLeaveStartDate] = useState(format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd"))
    const [leaveEndDate, setLeaveEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [leaveRecords, setLeaveRecords] = useState<any[]>([])
    const [leaveLoading, setLeaveLoading] = useState(false)
    const [leaveExporting, setLeaveExporting] = useState(false)
    const [leaveStatus, setLeaveStatus] = useState("APPROVED")
    const [leaveDept, setLeaveDept] = useState("all")
    const [leaveStaffIds, setLeaveStaffIds] = useState<string[]>([])
    const [leaveStaffSearch, setLeaveStaffSearch] = useState("")
    const [leaveLoaded, setLeaveLoaded] = useState(false)

    // Lateness Report state
    const [lateStartDate, setLateStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [lateEndDate, setLateEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [lateLocation, setLateLocation] = useState<"all" | "Philippines" | "Australia">("all")
    const [lateGenerating, setLateGenerating] = useState(false)

    useEffect(() => {
        if (session?.user) {
            const tz = (session.user as any).useCurrentTimezone
                ? getBrowserTimezone()
                : (session.user as any).selectedTimezone || getBrowserTimezone()
            setReportTimezone(tz)
        }
    }, [session])

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const [deptRes, staffRes] = await Promise.all([
                fetch('/api/departments'),
                fetch('/api/employees')
            ])

            if (deptRes.ok) setDepartments(await deptRes.json())
            if (staffRes.ok) {
                const staffData = await staffRes.json()
                setAllStaff(staffData)
                const mgrs = staffData.filter((e: any) =>
                    e.roles?.includes('MANAGER') || e.roles?.includes('ADMIN') ||
                    staffData.some((sub: any) => sub.managerId === e.id)
                )
                setManagers(Array.from(new Map(mgrs.map((m: any) => [m.id, m])).values())
                    .sort((a: any, b: any) => a.name.localeCompare(b.name)))
            }
        } catch (error) {
            console.error("Fetch data error:", error)
        }
    }

    const filteredStaffForDropdown = allStaff
        .filter(s => {
            const selectedDeptData = departments.find(d => d.id === selectedDept)
            const normalizedSelectedName = selectedDeptData?.name?.toLowerCase().trim()

            const matchesDept = selectedDept === 'all' ||
                s.departmentId === selectedDept ||
                (normalizedSelectedName && (
                    s.department?.name?.toLowerCase().trim() === normalizedSelectedName ||
                    s.departmentName?.toLowerCase().trim() === normalizedSelectedName
                ))

            const matchesLocation = selectedLocation === 'all' || s.employmentLocation === selectedLocation
            const matchesQuery = s.name.toLowerCase().includes(staffSearchQuery.toLowerCase())
            return matchesDept && matchesLocation && matchesQuery
        })

    const toggleAllStaff = () => {
        const visibleIds = filteredStaffForDropdown.map(s => s.id)
        if (visibleIds.every(id => selectedStaffIds.includes(id))) {
            setSelectedStaffIds(prev => prev.filter(id => !visibleIds.includes(id)))
        } else {
            setSelectedStaffIds(prev => [...new Set([...prev, ...visibleIds])])
        }
    }

    const toggleAllArchived = () => {
        const archivedIds = allStaff.filter(s => s.isArchived).map(s => s.id)
        if (archivedIds.every(id => selectedStaffIds.includes(id))) {
            setSelectedStaffIds(prev => prev.filter(id => !archivedIds.includes(id)))
        } else {
            setSelectedStaffIds(prev => [...new Set([...prev, ...archivedIds])])
        }
    }

    const toggleStaffSelection = (id: string) => {
        setSelectedStaffIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const setQuickRange = (range: string) => {
        const today = new Date()
        let start = new Date()
        let end = new Date()

        if (range === 'today') {
            // both today
        } else if (range === '7days') {
            start.setDate(today.getDate() - 7)
        } else if (range === '30days') {
            start.setDate(today.getDate() - 30)
        } else if (range === 'month') {
            start.setDate(1)
        } else if (range === 'lastweek') {
            const day = today.getDay()
            const diffToMon = (day === 0 ? -6 : 1 - day) - 7
            start = new Date(today)
            start.setDate(today.getDate() + diffToMon)
            end = new Date(start)
            end.setDate(start.getDate() + 6)
        } else if (range === 'thismonth') {
            start = new Date(today.getFullYear(), today.getMonth(), 1)
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        } else if (range === 'lastmonth') {
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
            end = new Date(today.getFullYear(), today.getMonth(), 0)
        } else if (range === 'ytd') {
            start = new Date(today.getFullYear(), 0, 1)
        }

        setStartDate(format(start, "yyyy-MM-dd"))
        setEndDate(format(end, "yyyy-MM-dd"))
    }

    const toggleStatus = (status: string) => {
        setSelectedStatuses(prev =>
            prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
        )
    }

    const toggleSheet = (sheet: string) => {
        setExportSheets(prev =>
            prev.includes(sheet)
                ? prev.length > 1 ? prev.filter(s => s !== sheet) : prev
                : [...prev, sheet]
        )
    }

    const calculateDurations = (recs: any[]) => {
        let workMs = 0
        let breakMs = 0
        let leaveMs = 0

        recs.forEach(r => {
            if (r.status === 'on-leave' || r.mode === 'LEAVE' || r.status === 'LEAVE') {
                leaveMs += 8 * 60 * 60 * 1000
            } else if (r.clockIn) {
                const clockIn = new Date(r.clockIn).getTime()
                const clockOut = r.clockOut ? new Date(r.clockOut).getTime() :
                    (new Date(r.date).toDateString() === new Date().toDateString() ? new Date().getTime() : 0)

                if (clockOut > clockIn) {
                    let dayBreakMs = 0
                    r.breaks?.forEach((b: any) => {
                        const start = new Date(b.startTime).getTime()
                        const end = b.endTime ? new Date(b.endTime).getTime() :
                            (new Date(r.date) >= new Date() ? new Date().getTime() : start)
                        dayBreakMs += Math.max(0, end - start)
                    })

                    workMs += (clockOut - clockIn) - dayBreakMs
                    breakMs += dayBreakMs
                }
            }
        })

        return { workMs, breakMs, leaveMs }
    }

    const handleExport = async () => {
        setGenerating(true)
        try {
            const res = await fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}&departmentId=${selectedDept}`)
            if (!res.ok) throw new Error("Failed to fetch attendance data")
            const rawData = await res.json()

            // 1. Determine the target staff scope based on all active filters
            let targetStaff = allStaff.filter(s => !s.isArchived)

            if (selectedStaffIds.length > 0) {
                // Individual selection overrides all other filters
                targetStaff = allStaff.filter(s => selectedStaffIds.includes(s.id))
            } else {
                if (selectedDept !== 'all') {
                    const deptData = departments.find(d => d.id === selectedDept)
                    const normalizedName = deptData?.name?.toLowerCase().trim()
                    targetStaff = targetStaff.filter(s =>
                        s.departmentId === selectedDept ||
                        (normalizedName && s.department?.name?.toLowerCase().trim() === normalizedName)
                    )
                }
                if (selectedLocation !== 'all') {
                    targetStaff = targetStaff.filter(s => s.employmentLocation === selectedLocation)
                }
                if (selectedManagerId !== 'all') {
                    targetStaff = targetStaff.filter(s => s.managerId === selectedManagerId)
                }
            }

            const targetIds = new Set(targetStaff.map(s => s.id))

            // 2. Keep only attendance records belonging to target staff, optionally excluding weekends
            const data = rawData.filter((r: any) => {
                if (!targetIds.has(r.userId)) return false
                if (!includeWeekends) {
                    const day = new Date(r.date + 'T12:00:00Z').getUTCDay()
                    if (day === 0 || day === 6) return false
                }
                return true
            })

            // 3. Generate dates in the selected range
            const allDates: string[] = []
            const cur = new Date(startDate + 'T12:00:00Z')
            const rangeEnd = new Date(endDate + 'T12:00:00Z')
            while (cur <= rangeEnd) {
                const day = cur.getUTCDay()
                if (includeWeekends || (day !== 0 && day !== 6)) {
                    allDates.push(cur.toISOString().split('T')[0])
                }
                cur.setUTCDate(cur.getUTCDate() + 1)
            }

            // 4. Build absent placeholder rows for staff × dates with no record
            const presentKeys = new Set(data.map((r: any) => `${r.userId}|${r.date}`))
            const absentRows: any[] = []
            for (const staff of targetStaff) {
                for (const date of allDates) {
                    if (!presentKeys.has(`${staff.id}|${date}`)) {
                        absentRows.push({
                            userId: staff.id,
                            userName: staff.name,
                            department: staff.department?.name || staff.departmentName || 'Unassigned',
                            date,
                            clockIn: null,
                            clockOut: null,
                            breaks: [],
                            status: 'ABSENT',
                            mode: null,
                            pendingRequests: [],
                            notes: null
                        })
                    }
                }
            }

            const allRecords = [...data, ...absentRows]

            // Sheet 1: Master Ledger — sorted by name then date
            const sortedData = [...allRecords].sort((a, b) => {
                if (a.userName < b.userName) return -1
                if (a.userName > b.userName) return 1
                return a.date.localeCompare(b.date)
            })

            const logData = sortedData.map((record: any) => {
                const isAbsent = record.status === 'ABSENT'
                const stats = isAbsent ? { workMs: 0, breakMs: 0, leaveMs: 0 } : calculateDurations([record])
                const clockInData = record.clockIn ? prepareTimeForExport(record.clockIn, reportTimezone) : null
                const clockOutData = record.clockOut ? prepareTimeForExport(record.clockOut, reportTimezone) : null

                const comments: string[] = []
                if (isAbsent) {
                    comments.push('ABSENT')
                } else {
                    if (record.pendingRequests?.length > 0) {
                        record.pendingRequests.forEach((pr: any) => comments.push(`PENDING: ${pr.type.replace('_', ' ')}`))
                    }
                    if (!record.clockIn && record.clockOut) comments.push('MISSING CLOCK IN')
                    if (record.clockIn && !record.clockOut) {
                        const today = new Date().toISOString().split('T')[0]
                        if (record.date < today) comments.push('MISSING CLOCK OUT')
                    }
                    if (record.notes && !record.notes.startsWith('PROVISIONAL_REQUEST:')) {
                        comments.push(`NOTE: ${record.notes}`)
                    }
                }

                return {
                    'Employee': record.userName,
                    'Department': record.department,
                    'Date': record.date,
                    'Attendance Status': isAbsent ? 'ABSENT' : (record.status === 'on-leave' || record.mode === 'LEAVE' ? 'LEAVE' : 'PRESENT'),
                    'Clock In (UTC)': clockInData?.utcTime || '-',
                    'Clock In (TZ Offset)': clockInData?.timezoneOffset || '-',
                    'Clock In (Adjusted)': record.clockIn ? new Date(record.clockIn).toLocaleTimeString('en-US', { timeZone: reportTimezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '-',
                    'Clock Out (UTC)': clockOutData?.utcTime || '-',
                    'Clock Out (TZ Offset)': clockOutData?.timezoneOffset || '-',
                    'Clock Out (Adjusted)': record.clockOut ? new Date(record.clockOut).toLocaleTimeString('en-US', { timeZone: reportTimezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '-',
                    'Work Hours': Number((stats.workMs / (1000 * 60 * 60)).toFixed(2)),
                    'Actual Hours': Math.floor(stats.workMs / (1000 * 60 * 60)),
                    'Actual Minutes': Math.floor((stats.workMs % (1000 * 60 * 60)) / (1000 * 60)),
                    'Leave Hours': Math.floor(stats.leaveMs / (1000 * 60 * 60)),
                    'Work Location': record.mode || '-',
                    'Comments': comments.join('; '),
                    'Report Timezone': reportTimezone
                }
            })

            // Sheet 2: Finance Summary — ALL target staff, including those fully absent
            const summaryData = targetStaff.map(staff => {
                const empRecs = data.filter((r: any) => r.userId === staff.id)
                const stats = calculateDurations(empRecs)
                const totalDays = allDates.length
                const daysWorked = empRecs.filter((r: any) => r.clockIn).length
                const daysLeave = empRecs.filter((r: any) => r.status === 'on-leave' || r.mode === 'LEAVE' || r.status === 'LEAVE').length
                const daysAbsent = totalDays - daysWorked - daysLeave
                return {
                    'Employee': staff.name,
                    'Department': staff.department?.name || staff.departmentName || 'Unassigned',
                    'Employment Location': staff.employmentLocation || '-',
                    'Total Days in Range': totalDays,
                    'Days Worked': daysWorked,
                    'Days Absent': Math.max(0, daysAbsent),
                    'Days Leave': daysLeave,
                    'Total Work Hours': Number((stats.workMs / (1000 * 60 * 60)).toFixed(2)),
                    'Actual Hours': Math.floor(stats.workMs / (1000 * 60 * 60)),
                    'Actual Minutes': Math.floor((stats.workMs % (1000 * 60 * 60)) / (1000 * 60)),
                    'Total Leave Hours': Math.floor(stats.leaveMs / (1000 * 60 * 60))
                }
            }).sort((a, b) => a.Employee.localeCompare(b.Employee))

            // Apply status filter to Master Ledger rows
            const filteredLogData = selectedStatuses.length === 0 ? logData : logData.filter((row: any) => {
                const rowStatus = row['Attendance Status']
                if (selectedStatuses.includes('PRESENT') && rowStatus === 'PRESENT') return true
                if (selectedStatuses.includes('ABSENT') && rowStatus === 'ABSENT') return true
                if (selectedStatuses.includes('LEAVE') && rowStatus === 'LEAVE') return true
                return false
            })

            const wb = XLSX.utils.book_new()

            if (exportSheets.includes('ledger') && filteredLogData.length > 0) {
                const wsLogs = XLSX.utils.json_to_sheet(filteredLogData)
                wsLogs['!cols'] = Object.keys(filteredLogData[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }))
                XLSX.utils.book_append_sheet(wb, wsLogs, "Master Ledger")
            }

            if (exportSheets.includes('summary') && summaryData.length > 0) {
                const wsSummary = XLSX.utils.json_to_sheet(summaryData)
                wsSummary['!cols'] = Object.keys(summaryData[0] || {}).map(key => ({ wch: Math.max(key.length, 18) }))
                XLSX.utils.book_append_sheet(wb, wsSummary, "Finance Summary")
            }

            if (wb.SheetNames.length === 0) {
                toast.error("No data to export with the current filters.")
                return
            }

            XLSX.writeFile(wb, `REDADAIR_MASTER_PAYROLL_${startDate}_${endDate}.xlsx`)
        } catch (error) {
            console.error("Export failed:", error)
            toast.error("Export failed. Please try again.")
        } finally {
            setGenerating(false)
        }
    }

    const fetchLeaveRecords = async () => {
        setLeaveLoading(true)
        setLeaveLoaded(true)
        try {
            const params = new URLSearchParams({ startDate: leaveStartDate, endDate: leaveEndDate })
            if (leaveStatus !== 'all') params.set('status', leaveStatus)
            if (leaveDept !== 'all') params.set('departmentId', leaveDept)
            if (leaveStaffIds.length > 0) params.set('userIds', leaveStaffIds.join(','))
            const res = await fetch(`/api/leaves?${params}`)
            if (!res.ok) throw new Error('Failed to fetch')
            const data = await res.json()
            setLeaveRecords(data.leaves || [])
        } catch {
            toast.error('Failed to load leave records')
        } finally {
            setLeaveLoading(false)
        }
    }

    const handleLeaveExport = async () => {
        if (leaveRecords.length === 0) { toast.error('No records to export'); return }
        setLeaveExporting(true)
        try {
            const rows = leaveRecords.map((r: any) => ({
                'Employee': r.user?.name || '-',
                'Department': r.user?.department?.name || 'Unassigned',
                'Leave Type': r.type || '-',
                'Status': r.status || '-',
                'Start Date': r.startDate ? format(new Date(r.startDate), 'yyyy-MM-dd') : '-',
                'End Date': r.endDate ? format(new Date(r.endDate), 'yyyy-MM-dd') : '-',
                'Duration': r.duration || '-',
                'Reason': r.reason || '-',
            }))
            const wb = XLSX.utils.book_new()
            const ws = XLSX.utils.json_to_sheet(rows)
            ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 16) }))
            XLSX.utils.book_append_sheet(wb, ws, 'Leave Records')
            XLSX.writeFile(wb, `REDADAIR_LEAVE_RECORDS_${leaveStartDate}_${leaveEndDate}.xlsx`)
        } catch {
            toast.error('Export failed')
        } finally {
            setLeaveExporting(false)
        }
    }

    // ── Lateness Report export ────────────────────────────────────────────────
    // AU staff lateness comes from the app DB (clock-in vs shift start + grace);
    // PH staff lateness comes from the biometric feed (firstIn vs expectedStart).
    // Tabs depend on the Employment Location filter: both -> AU + PH + Summary,
    // single location -> that one tab only.
    const handleLatenessExport = async () => {
        setLateGenerating(true)
        try {
            const wantAU = lateLocation === 'all' || lateLocation === 'Australia'
            const wantPH = lateLocation === 'all' || lateLocation === 'Philippines'
            const days = dateRangeList(lateStartDate, lateEndDate)

            type LateRow = { date: string; name: string; dept: string; started: number; expected: number; lateBy: number }
            const auLate: LateRow[] = []
            const phLate: LateRow[] = []
            const phOut: { date: string; name: string; dept: string; reason: string }[] = []

            // AU — app database
            if (wantAU) {
                const res = await fetch(`/api/attendance?startDate=${lateStartDate}&endDate=${lateEndDate}`)
                const recs = res.ok ? await res.json() : []
                const empById = new Map(allStaff.map((s: any) => [s.id, s]))
                for (const rec of recs) {
                    if (!rec.clockIn) continue
                    const emp: any = empById.get(rec.userId)
                    if (!emp || emp.employmentLocation !== 'Australia') continue
                    const shiftStartSec = hhmmToSec(emp.shiftStartTime || emp.department?.shiftStartTime || '09:00')
                    let shiftEndSec = hhmmToSec(emp.shiftEndTime || emp.department?.shiftEndTime || '17:00')
                    if (shiftEndSec <= shiftStartSec) shiftEndSec += 24 * 3600 // overnight shift
                    const cutoff = shiftStartSec + LATE_GRACE_SEC
                    const inSec = clockInSecInTz(rec.clockIn, 'Australia/Sydney')
                    // A late ARRIVAL must fall within the shift window: after start+grace, at/before shift end.
                    // This excludes forgotten/evening open sessions that would otherwise show as many hours "late".
                    if (inSec === null || inSec <= cutoff || inSec > shiftEndSec) continue
                    auLate.push({
                        date: rec.date,
                        name: emp.name,
                        dept: emp.department?.name || emp.departmentName || 'Unassigned',
                        started: inSec, expected: cutoff, lateBy: inSec - cutoff
                    })
                }
            }

            // PH — biometric feed (one fetch per day in range)
            if (wantPH) {
                for (const day of days) {
                    let json: any = null
                    try {
                        const res = await fetch(`/api/biometric?date=${day}`)
                        if (!res.ok) continue
                        json = await res.json()
                    } catch { continue }
                    for (const entry of (json?.entries || [])) {
                        const b = entry.biometric
                        const inSec = bioTimeToSec(b.firstIn)
                        const expSec = bioTimeToSec(b.expectedStart)
                        // A late ARRIVAL is a morning event. PH biometric expected-starts are early (≈06:05),
                        // so bound to before midday — this drops afternoon first-punches (partial day / field
                        // work / device quirks) that would otherwise read as many hours "late".
                        if (inSec !== null && expSec !== null && inSec > expSec && inSec < 12 * 3600) {
                            phLate.push({ date: day, name: b.name, dept: b.department || '—', started: inSec, expected: expSec, lateBy: inSec - expSec })
                        } else if ((!b.firstIn || b.firstIn === '--') && entry.app?.clockIn) {
                            // Biometric-absent but present in the app that day = worked away from the device.
                            phOut.push({ date: day, name: b.name, dept: b.department || '—', reason: 'Away' })
                        }
                    }
                }
            }

            if (auLate.length === 0 && phLate.length === 0 && phOut.length === 0) {
                toast.error('No lateness records found for the selected range.')
                return
            }

            const multiDay = days.length > 1
            const sortRows = (a: LateRow, b: LateRow) => a.date === b.date ? a.started - b.started : a.date.localeCompare(b.date)

            // Build a "Started Late" section (array-of-arrays) for one region
            const lateSection = (title: string, rows: LateRow[]): any[][] => {
                const out: any[][] = [[title], multiDay ? ['#', 'Date', 'Name', 'Dept', 'Time Started', 'Expected Start', 'Late Time'] : ['#', 'Name', 'Dept', 'Time Started', 'Expected Start', 'Late Time']]
                rows.sort(sortRows).forEach((r, i) => {
                    const base = [secToHHMMSS(r.started), secToHHMMSS(r.expected), secToHHMMSS(r.lateBy)]
                    out.push(multiDay ? [i + 1, r.date, r.name, r.dept, ...base] : [i + 1, r.name, r.dept, ...base])
                })
                if (rows.length === 0) out.push(['— none —'])
                return out
            }

            const wb = XLSX.utils.book_new()
            const addSheet = (name: string, aoa: any[][], widths: number[]) => {
                const ws = XLSX.utils.aoa_to_sheet(aoa)
                ws['!cols'] = widths.map(w => ({ wch: w }))
                XLSX.utils.book_append_sheet(wb, ws, name)
            }
            const rangeLabel = multiDay ? `${lateStartDate} to ${lateEndDate}` : lateStartDate

            if (wantAU) {
                addSheet('Australia', [
                    [`AUSTRALIA — Lateness (app clock-in vs shift start + 5 min grace)`],
                    [rangeLabel], [],
                    ...lateSection('STARTED LATE', auLate)
                ], multiDay ? [5, 12, 26, 18, 14, 14, 12] : [5, 26, 18, 14, 14, 12])
            }

            if (wantPH) {
                const outSection: any[][] = [[], ['PH - OUT (biometric-absent but clocked in on the app)'],
                    multiDay ? ['#', 'Date', 'Name', 'Dept', 'Reason'] : ['#', 'Name', 'Dept', 'Reason']]
                phOut.sort((a, b) => a.date === b.date ? a.name.localeCompare(b.name) : a.date.localeCompare(b.date))
                    .forEach((r, i) => outSection.push(multiDay ? [i + 1, r.date, r.name, r.dept, r.reason] : [i + 1, r.name, r.dept, r.reason]))
                if (phOut.length === 0) outSection.push(['— none —'])
                addSheet('Philippines', [
                    [`PHILIPPINES — Lateness (biometric firstIn vs expected start)`],
                    [rangeLabel], [],
                    ...lateSection('STARTED LATE', phLate),
                    ...outSection
                ], multiDay ? [5, 12, 26, 18, 14, 14, 12] : [5, 26, 18, 14, 14, 12])
            }

            // Summary only when both locations are in scope
            if (lateLocation === 'all') {
                const combined = [
                    ...auLate.map(r => ({ loc: 'Australia', ...r })),
                    ...phLate.map(r => ({ loc: 'Philippines', ...r })),
                ].sort((a, b) => a.date === b.date ? a.started - b.started : a.date.localeCompare(b.date))
                const summary: any[][] = [
                    ['LATENESS SUMMARY'], [rangeLabel], [],
                    ['Location', 'Late Count', 'Out Count'],
                    ['Australia', auLate.length, '—'],
                    ['Philippines', phLate.length, phOut.length],
                    ['Total', auLate.length + phLate.length, phOut.length],
                    [], ['COMBINED LATE LIST'],
                    ['#', 'Location', 'Date', 'Name', 'Dept', 'Time Started', 'Expected Start', 'Late Time'],
                    ...combined.map((r, i) => [i + 1, r.loc, r.date, r.name, r.dept, secToHHMMSS(r.started), secToHHMMSS(r.expected), secToHHMMSS(r.lateBy)])
                ]
                addSheet('Summary', summary, [5, 12, 12, 26, 18, 14, 14, 12])
            }

            XLSX.writeFile(wb, `REDADAIR_LATENESS_${lateStartDate}_${lateEndDate}.xlsx`)
        } catch (error) {
            console.error('Lateness export failed:', error)
            toast.error('Lateness export failed. Please try again.')
        } finally {
            setLateGenerating(false)
        }
    }

    const leaveFilteredStaff = allStaff.filter(s => {
        const matchesDept = leaveDept === 'all' || s.departmentId === leaveDept
        const matchesSearch = s.name.toLowerCase().includes(leaveStaffSearch.toLowerCase())
        return matchesDept && matchesSearch && !s.isArchived
    })

    return (
        <div className="w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-10 px-4 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Export Ledger</h1>
                    <p className="text-muted-foreground text-sm">Workforce Intelligence & Industrial Reports</p>
                </div>
                <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full border border-border">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Ledger Stream Active</span>
                </div>
            </div>

            <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                <CardHeader className="p-6 border-b border-border bg-muted/20">
                    <CardTitle className="text-lg font-semibold text-foreground">Export Configuration</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">Configure chronological and structural parameters</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => {
                                    if (e.target.value < startDate) {
                                        toast.error("End Data cannot be earlier than Start Date")
                                        return
                                    }
                                    setEndDate(e.target.value)
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Department</Label>
                            <Select value={selectedDept} onValueChange={(val) => {
                                setSelectedDept(val)
                                setSelectedStaffIds([])
                            }}>
                                <SelectTrigger className="h-10">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                        <SelectValue placeholder="All Departments" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Departments</SelectItem>
                                    {departments.map((dept: any) => (
                                        <SelectItem key={dept.id} value={dept.id}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Employment Location</Label>
                            <Select value={selectedLocation} onValueChange={(val) => {
                                setSelectedLocation(val)
                                setSelectedStaffIds([])
                            }}>
                                <SelectTrigger className="h-10">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                        <SelectValue placeholder="All Locations" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Locations</SelectItem>
                                    <SelectItem value="Philippines">Philippines</SelectItem>
                                    <SelectItem value="Australia">Australia</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <AdminTimezoneSelect
                            value={reportTimezone}
                            onChange={setReportTimezone}
                            label="Report Timezone"
                            className=""
                        />
                        <div className="space-y-2">
                            <Label>Manager</Label>
                            <Select value={selectedManagerId} onValueChange={(val) => {
                                setSelectedManagerId(val)
                                setSelectedStaffIds([])
                            }}>
                                <SelectTrigger className="h-10">
                                    <div className="flex items-center gap-2">
                                        <UserCog className="h-4 w-4 text-muted-foreground" />
                                        <SelectValue placeholder="All Managers" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Managers</SelectItem>
                                    {managers.map((m: any) => (
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-2">
                        <Label>Attendance Status Filter</Label>
                        <p className="text-xs text-muted-foreground">Select which statuses to include in the Master Ledger. Leave all unchecked to include everything.</p>
                        <div className="flex flex-wrap gap-3 pt-1">
                            {[
                                { id: 'PRESENT', label: 'Present', color: 'text-green-700 bg-green-50 border-green-200' },
                                { id: 'ABSENT', label: 'Absent', color: 'text-red-700 bg-red-50 border-red-200' },
                                { id: 'LEAVE', label: 'On Leave', color: 'text-blue-700 bg-blue-50 border-blue-200' },
                            ].map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => toggleStatus(s.id)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm font-medium select-none ${selectedStatuses.includes(s.id) ? s.color + ' shadow-sm' : 'border-border text-muted-foreground bg-white hover:bg-muted/40'}`}
                                >
                                    <Checkbox
                                        checked={selectedStatuses.includes(s.id)}
                                        onCheckedChange={() => toggleStatus(s.id)}
                                        className="pointer-events-none"
                                    />
                                    {s.label}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Include Weekends + Sheet Selector */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Weekend Rows</Label>
                            <div
                                onClick={() => setIncludeWeekends(p => !p)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all select-none ${includeWeekends ? 'bg-primary/5 border-primary/30 text-primary' : 'bg-white border-border text-muted-foreground hover:bg-muted/40'}`}
                            >
                                <ToggleLeft className="h-4 w-4 shrink-0" />
                                <div>
                                    <p className="text-sm font-medium">{includeWeekends ? 'Weekends included' : 'Weekends excluded'}</p>
                                    <p className="text-xs opacity-70">Click to toggle Sat &amp; Sun rows</p>
                                </div>
                                <Checkbox checked={includeWeekends} onCheckedChange={() => setIncludeWeekends(p => !p)} className="ml-auto pointer-events-none" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Export Sheets</Label>
                            <div className="flex gap-3">
                                {[
                                    { id: 'ledger', label: 'Master Ledger', icon: FileSpreadsheet },
                                    { id: 'summary', label: 'Finance Summary', icon: CalendarDays },
                                ].map(sheet => {
                                    const Icon = sheet.icon
                                    return (
                                        <div
                                            key={sheet.id}
                                            onClick={() => toggleSheet(sheet.id)}
                                            className={`flex items-center gap-2 flex-1 px-3 py-3 rounded-lg border cursor-pointer transition-all select-none text-sm font-medium ${exportSheets.includes(sheet.id) ? 'bg-primary/5 border-primary/30 text-primary shadow-sm' : 'bg-white border-border text-muted-foreground hover:bg-muted/40'}`}
                                        >
                                            <Checkbox checked={exportSheets.includes(sheet.id)} onCheckedChange={() => toggleSheet(sheet.id)} className="pointer-events-none" />
                                            <Icon className="h-4 w-4 shrink-0" />
                                            {sheet.label}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Staff Filter</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-between h-10 font-normal">
                                    <div className="flex items-center gap-2 truncate">
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        {selectedStaffIds.length === 0 ? (
                                            <span className="text-muted-foreground">All Staff</span>
                                        ) : (
                                            <span>{selectedStaffIds.length} Selected</span>
                                        )}
                                    </div>
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                                <div className="p-2 border-b border-border space-y-2">
                                    <div className="relative">
                                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            placeholder="Search staff..."
                                            className="pl-8 h-8 text-xs"
                                            value={staffSearchQuery}
                                            onChange={e => setStaffSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <div
                                        className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors bg-muted/30"
                                        onClick={toggleAllStaff}
                                    >
                                        <Checkbox
                                            checked={filteredStaffForDropdown.length > 0 && filteredStaffForDropdown.every(s => selectedStaffIds.includes(s.id))}
                                            onCheckedChange={toggleAllStaff}
                                        />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-bold text-foreground leading-none truncate">Select All Staff</span>
                                        </div>
                                    </div>
                                    <div
                                        className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors bg-amber-50/50"
                                        onClick={toggleAllArchived}
                                    >
                                        <Checkbox
                                            checked={allStaff.filter(s => s.isArchived).length > 0 && allStaff.filter(s => s.isArchived).every(s => selectedStaffIds.includes(s.id))}
                                            onCheckedChange={toggleAllArchived}
                                        />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-bold text-amber-700 leading-none truncate">All Archived Staff</span>
                                            <span className="text-[10px] text-amber-600/70 truncate">Quick Select</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto p-1">
                                    {filteredStaffForDropdown.length === 0 ? (
                                        <div className="p-4 text-center text-xs text-muted-foreground">
                                            No staff in this department
                                        </div>
                                    ) : (
                                        filteredStaffForDropdown.map(staff => (
                                            <div
                                                key={staff.id}
                                                className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors"
                                                onClick={() => toggleStaffSelection(staff.id)}
                                            >
                                                <Checkbox
                                                    id={`staff-${staff.id}`}
                                                    checked={selectedStaffIds.includes(staff.id)}
                                                    onCheckedChange={() => toggleStaffSelection(staff.id)}
                                                />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-medium leading-none truncate">{staff.name}</span>
                                                    <span className="text-[10px] text-muted-foreground truncate">{staff.department?.name || 'No Dept'}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                {selectedStaffIds.length > 0 && (
                                    <div className="p-2 border-t border-border">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full h-8 text-xs text-primary hover:text-primary transition-colors"
                                            onClick={() => setSelectedStaffIds([])}
                                        >
                                            Clear Selection
                                        </Button>
                                    </div>
                                )}
                            </PopoverContent>
                        </Popover>
                    </div>




                    <div className="space-y-3">
                        <Label>Quick Presets</Label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'today', label: 'Today' },
                                { id: '7days', label: 'Last 7 Days' },
                                { id: '30days', label: 'Last 30 Days' },
                                { id: 'lastweek', label: 'Last Week' },
                                { id: 'month', label: 'Month to Date' },
                                { id: 'thismonth', label: 'This Month' },
                                { id: 'lastmonth', label: 'Last Month' },
                                { id: 'ytd', label: 'Year to Date' },
                            ].map(range => (
                                <Button
                                    key={range.id}
                                    onClick={() => setQuickRange(range.id)}
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs font-medium"
                                >
                                    {range.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-border">
                        <Button
                            onClick={handleExport}
                            disabled={generating}
                            className="w-full md:w-auto"
                        >
                            {generating ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4 mr-2" />
                            )}
                            {generating ? "Synthesizing Dataset..." : "Generate Master Ledger"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Leave Records */}
            <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                <CardHeader className="p-6 border-b border-border bg-muted/20">
                    <div className="flex items-center gap-3">
                        <CalendarOff className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <CardTitle className="text-lg font-semibold text-foreground">Leave Records</CardTitle>
                            <CardDescription className="text-sm text-muted-foreground">View and export approved leave records by date range</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input type="date" value={leaveStartDate} onChange={e => setLeaveStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input type="date" value={leaveEndDate} onChange={e => {
                                if (e.target.value < leaveStartDate) { toast.error('End date cannot be before start date'); return }
                                setLeaveEndDate(e.target.value)
                            }} />
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={leaveStatus} onValueChange={setLeaveStatus}>
                                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="APPROVED">Approved</SelectItem>
                                    <SelectItem value="PENDING">Pending</SelectItem>
                                    <SelectItem value="DECLINED">Declined</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Department</Label>
                            <Select value={leaveDept} onValueChange={v => { setLeaveDept(v); setLeaveStaffIds([]) }}>
                                <SelectTrigger className="h-10">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                        <SelectValue placeholder="All Departments" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Departments</SelectItem>
                                    {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Staff filter */}
                    <div className="space-y-2">
                        <Label>Staff Filter</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-between h-10 font-normal">
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        {leaveStaffIds.length === 0 ? <span className="text-muted-foreground">All Staff</span> : <span>{leaveStaffIds.length} Selected</span>}
                                    </div>
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[280px] p-0" align="start">
                                <div className="p-2 border-b">
                                    <div className="relative">
                                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input placeholder="Search staff..." className="pl-8 h-8 text-xs" value={leaveStaffSearch} onChange={e => setLeaveStaffSearch(e.target.value)} />
                                    </div>
                                </div>
                                <div className="max-h-[260px] overflow-y-auto p-1">
                                    {leaveFilteredStaff.map(s => (
                                        <div key={s.id} className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer" onClick={() => setLeaveStaffIds(prev => prev.includes(s.id) ? prev.filter(i => i !== s.id) : [...prev, s.id])}>
                                            <Checkbox checked={leaveStaffIds.includes(s.id)} />
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-medium truncate">{s.name}</span>
                                                <span className="text-[10px] text-muted-foreground truncate">{s.department?.name || 'No Dept'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {leaveStaffIds.length > 0 && (
                                    <div className="p-2 border-t">
                                        <Button variant="ghost" size="sm" className="w-full h-8 text-xs text-primary" onClick={() => setLeaveStaffIds([])}>Clear Selection</Button>
                                    </div>
                                )}
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Quick presets */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'thismonth', label: 'This Month' },
                            { id: 'lastmonth', label: 'Last Month' },
                            { id: 'ytd', label: 'Year to Date' },
                            { id: '30days', label: 'Last 30 Days' },
                        ].map(r => (
                            <Button key={r.id} variant="outline" size="sm" className="h-8 text-xs"
                                onClick={() => {
                                    const today = new Date()
                                    let s = new Date(), e = new Date()
                                    if (r.id === 'thismonth') { s = new Date(today.getFullYear(), today.getMonth(), 1); e = new Date(today.getFullYear(), today.getMonth() + 1, 0) }
                                    else if (r.id === 'lastmonth') { s = new Date(today.getFullYear(), today.getMonth() - 1, 1); e = new Date(today.getFullYear(), today.getMonth(), 0) }
                                    else if (r.id === 'ytd') { s = new Date(today.getFullYear(), 0, 1) }
                                    else if (r.id === '30days') { s.setDate(today.getDate() - 30) }
                                    setLeaveStartDate(format(s, 'yyyy-MM-dd'))
                                    setLeaveEndDate(format(e, 'yyyy-MM-dd'))
                                }}>
                                {r.label}
                            </Button>
                        ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-3 pt-2 border-t border-border">
                        <Button onClick={fetchLeaveRecords} disabled={leaveLoading} className="bg-[#8B2323] hover:bg-[#701c1c]">
                            {leaveLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                            {leaveLoading ? 'Loading...' : 'Load Records'}
                        </Button>
                        {leaveRecords.length > 0 && (
                            <Button variant="outline" onClick={handleLeaveExport} disabled={leaveExporting}>
                                {leaveExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                                Export to Sheet ({leaveRecords.length})
                            </Button>
                        )}
                    </div>

                    {/* Table */}
                    {leaveLoaded && !leaveLoading && (
                        <div className="rounded-lg border border-border overflow-hidden">
                            {leaveRecords.length === 0 ? (
                                <div className="p-8 text-center text-sm text-muted-foreground">No leave records found for the selected filters.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/40 border-b border-border">
                                            <tr>
                                                {['Employee', 'Department', 'Type', 'Status', 'Start Date', 'End Date', 'Duration', 'Reason'].map(h => (
                                                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {leaveRecords.map((r: any) => (
                                                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{r.user?.name || '-'}</td>
                                                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.user?.department?.name || 'Unassigned'}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">{r.type}</span>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${r.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' : r.status === 'DECLINED' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>{r.status}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.startDate ? format(new Date(r.startDate), 'dd MMM yyyy') : '-'}</td>
                                                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.endDate ? format(new Date(r.endDate), 'dd MMM yyyy') : '-'}</td>
                                                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.duration || '-'}</td>
                                                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{r.reason || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Lateness Report */}
            <Card className="border border-border shadow-sm rounded-xl overflow-hidden bg-white">
                <CardHeader className="p-6 border-b border-border bg-muted/20">
                    <div className="flex items-center gap-3">
                        <CalendarDays className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <CardTitle className="text-lg font-semibold text-foreground">Lateness Report</CardTitle>
                            <CardDescription className="text-sm text-muted-foreground">
                                Late arrivals by employment location — Australia from app clock-in, Philippines from biometric. Both locations produce Australia, Philippines and a combined Summary sheet; a single location produces one sheet.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input type="date" value={lateStartDate} onChange={e => setLateStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input type="date" value={lateEndDate} onChange={e => {
                                if (e.target.value < lateStartDate) { toast.error('End date cannot be before start date'); return }
                                setLateEndDate(e.target.value)
                            }} />
                        </div>
                        <div className="space-y-2">
                            <Label>Employment Location</Label>
                            <Select value={lateLocation} onValueChange={(v: any) => setLateLocation(v)}>
                                <SelectTrigger className="h-10">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                        <SelectValue placeholder="All Locations" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Locations (AU + PH + Summary)</SelectItem>
                                    <SelectItem value="Philippines">Philippines only</SelectItem>
                                    <SelectItem value="Australia">Australia only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'today', label: 'Today' },
                            { id: 'yesterday', label: 'Yesterday' },
                            { id: 'thisweek', label: 'This Week' },
                            { id: 'lastweek', label: 'Last Week' },
                        ].map(r => (
                            <Button key={r.id} variant="outline" size="sm" className="h-8 text-xs"
                                onClick={() => {
                                    const today = new Date()
                                    let s = new Date(), e = new Date()
                                    if (r.id === 'today') { /* both today */ }
                                    else if (r.id === 'yesterday') { s.setDate(today.getDate() - 1); e = new Date(s) }
                                    else if (r.id === 'thisweek') { const d = today.getDay(); const diff = d === 0 ? -6 : 1 - d; s = new Date(today); s.setDate(today.getDate() + diff); e = new Date() }
                                    else if (r.id === 'lastweek') { const d = today.getDay(); const diff = (d === 0 ? -6 : 1 - d) - 7; s = new Date(today); s.setDate(today.getDate() + diff); e = new Date(s); e.setDate(s.getDate() + 6) }
                                    setLateStartDate(format(s, 'yyyy-MM-dd'))
                                    setLateEndDate(format(e, 'yyyy-MM-dd'))
                                }}>
                                {r.label}
                            </Button>
                        ))}
                    </div>

                    <div className="pt-4 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-3">
                            Philippines data is pulled from the biometric sheet one day at a time, so wide date ranges take longer. 5-minute grace applied to both locations.
                        </p>
                        <Button onClick={handleLatenessExport} disabled={lateGenerating} className="w-full md:w-auto">
                            {lateGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                            {lateGenerating ? 'Compiling Lateness…' : 'Generate Lateness Report'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div >
    )
}
