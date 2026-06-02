import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isNonWorkingDay, calculateTardiness } from '@/lib/performance-utils'
import { format, subDays, startOfWeek } from 'date-fns'

export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate') || format(subDays(new Date(), 30), 'yyyy-MM-dd')
    const endDate = searchParams.get('endDate') || format(new Date(), 'yyyy-MM-dd')
    const departmentIdsParam = searchParams.get('departmentIds') || ''
    const departmentIds = departmentIdsParam ? departmentIdsParam.split(',').filter(Boolean) : []
    const location = searchParams.get('location') || 'all'
    const staffIdsParam = searchParams.get('staffIds') || ''
    const staffIds = staffIdsParam ? staffIdsParam.split(',').filter(Boolean) : []

    const userWhere: any = { isArchived: false, deletedAt: null }
    if (departmentIds.length > 0) userWhere.departmentId = { in: departmentIds }
    if (location !== 'all') userWhere.employmentLocation = location
    // When specific staff are selected, override other user filters
    if (staffIds.length > 0) {
        userWhere.id = { in: staffIds }
        delete userWhere.departmentId
        delete userWhere.employmentLocation
    }

    const [users, summaries, leavesApproved, leaveRequests, leavesPending] = await Promise.all([
        prisma.user.findMany({
            where: userWhere,
            select: {
                id: true, name: true, departmentId: true, employmentLocation: true,
                shiftStartTime: true, shiftEndTime: true, workingDays: true,
                department: { select: { name: true } }
            }
        }),
        prisma.attendanceSummary.findMany({
            where: {
                date: { gte: new Date(startDate), lte: new Date(endDate + 'T23:59:59.999Z') },
                user: userWhere,
            },
            select: {
                id: true, userId: true, date: true, clockIn: true, clockOut: true,
                totalWorkDuration: true, totalBreakDuration: true,
                status: true, mode: true, isManualOverride: true,
                user: {
                    select: {
                        id: true, name: true, departmentId: true, employmentLocation: true,
                        shiftStartTime: true, shiftEndTime: true, workingDays: true,
                        selectedTimezone: true,
                        department: { select: { name: true } }
                    }
                }
            }
        }),
        prisma.leave.findMany({
            where: {
                deletedAt: null, status: 'APPROVED',
                startDate: { lte: new Date(endDate + 'T23:59:59.999Z') },
                endDate: { gte: new Date(startDate) },
                user: userWhere,
            },
            select: { id: true, userId: true, type: true, startDate: true, endDate: true, duration: true }
        }),
        prisma.leaveRequest.findMany({
            where: {
                deletedAt: null,
                createdAt: { gte: new Date(startDate), lte: new Date(endDate + 'T23:59:59.999Z') },
                user: userWhere,
            },
            select: { id: true, userId: true, status: true, type: true, startDate: true, endDate: true, createdAt: true, updatedAt: true }
        }),
        prisma.leaveRequest.findMany({
            where: {
                deletedAt: null, status: 'PENDING',
                startDate: { lte: new Date(endDate + 'T23:59:59.999Z') },
                endDate: { gte: new Date(startDate) },
                user: userWhere,
            },
            select: { id: true, userId: true, type: true, startDate: true, endDate: true }
        }),
    ])

    // Working days in range (global — excludes weekends & public holidays)
    const start = new Date(startDate)
    const end = new Date(endDate)
    const workingDays: string[] = []
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (!isNonWorkingDay(new Date(d))) {
            workingDays.push(d.toISOString().split('T')[0])
        }
    }

    // Day-name lookup for per-staff schedule checking
    const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    function isUserScheduledDay(userWorkingDays: string | null, dayStr: string): boolean {
        if (!userWorkingDays) return true // default: works all global working days
        const scheduled = new Set(userWorkingDays.split(',').map(d => d.trim().toUpperCase()))
        const dayName = DAY_NAMES[new Date(dayStr + 'T00:00:00Z').getUTCDay()]
        return scheduled.has(dayName)
    }

    // Leave type lookup must be built before trend/rate calculations so paid leaves
    // can be identified and excluded from the absence penalty.
    const PAID_LEAVE_TYPES = new Set(['VACATION', 'BIRTHDAY', 'MATERNITY'])
    type LeaveEntry = { startDateStr: string; endDateStr: string; type: string }
    const leaveTypeLookup: Record<string, LeaveEntry[]> = {}
    for (const leave of leavesApproved) {
        if (!leaveTypeLookup[leave.userId]) leaveTypeLookup[leave.userId] = []
        leaveTypeLookup[leave.userId].push({
            startDateStr: new Date(leave.startDate).toISOString().split('T')[0],
            endDateStr: new Date(leave.endDate).toISOString().split('T')[0],
            type: leave.type || 'OTHER'
        })
    }
    function getLeaveTypeForDay(userId: string, dayStr: string): string | undefined {
        return (leaveTypeLookup[userId] || []).find(l => dayStr >= l.startDateStr && dayStr <= l.endDateStr)?.type
    }

    // Pending leave lookup — staff with a pending request on a given day should not be marked absent
    const pendingLeaveLookup: Record<string, { startDateStr: string; endDateStr: string }[]> = {}
    for (const leave of leavesPending) {
        if (!pendingLeaveLookup[leave.userId]) pendingLeaveLookup[leave.userId] = []
        pendingLeaveLookup[leave.userId].push({
            startDateStr: new Date(leave.startDate).toISOString().split('T')[0],
            endDateStr: new Date(leave.endDate).toISOString().split('T')[0],
        })
    }
    function hasPendingLeaveOnDay(userId: string, dayStr: string): boolean {
        return (pendingLeaveLookup[userId] || []).some(l => dayStr >= l.startDateStr && dayStr <= l.endDateStr)
    }

    const totalActiveStaff = users.length
    const expectedAttendances = totalActiveStaff * workingDays.length

    const presentSummaries = summaries.filter(s => s.status !== 'ABSENT' && s.status !== 'LEAVE')
    const leaveSummaries = summaries.filter(s => s.status === 'LEAVE')
    const absentSummaries = summaries.filter(s => s.status === 'ABSENT')
    const lateSummaries = summaries.filter(s => s.status === 'LATE')

    // Paid leave staff are excluded from the denominator entirely — not expected at work
    const paidLeaveSummaries = leaveSummaries.filter(s => {
        const lt = getLeaveTypeForDay(s.userId, s.date.toISOString().split('T')[0])
        return lt && PAID_LEAVE_TYPES.has(lt)
    })
    const effectiveExpected = expectedAttendances - paidLeaveSummaries.length

    // On-time: use calculateTardiness for accuracy
    const onTimeSummaries = presentSummaries.filter(s => {
        if (!s.clockIn) return false
        return calculateTardiness(s, s.user) === 0
    })

    const attendanceRate = effectiveExpected > 0 ? Math.round((presentSummaries.length / effectiveExpected) * 100) : 0
    const onTimeRate = presentSummaries.length > 0 ? Math.round((onTimeSummaries.length / presentSummaries.length) * 100) : 0
    const absentRate = expectedAttendances > 0 ? Math.round((absentSummaries.length / expectedAttendances) * 100) : 0
    const wfhSummaries = presentSummaries.filter(s => s.mode === 'WFH')
    const wfhRate = presentSummaries.length > 0 ? Math.round((wfhSummaries.length / presentSummaries.length) * 100) : 0

    // Avg work hours per active session (minutes → hours)
    const totalWorkMin = presentSummaries.reduce((acc, s) => acc + s.totalWorkDuration, 0)
    const avgWorkHours = presentSummaries.length > 0 ? Math.round((totalWorkMin / presentSummaries.length / 60) * 10) / 10 : 0
    const totalBreakMin = presentSummaries.reduce((acc, s) => acc + s.totalBreakDuration, 0)
    const avgBreakMinutes = presentSummaries.length > 0 ? Math.round(totalBreakMin / presentSummaries.length) : 0

    // --- Attendance trend (daily) ---
    const attendanceTrend = workingDays.map(dayStr => {
        // Only count staff who are scheduled to work on this specific day
        const scheduledStaff = users.filter(u => isUserScheduledDay(u.workingDays, dayStr))
        const scheduledCount = scheduledStaff.length
        const scheduledIds = new Set(scheduledStaff.map(u => u.id))

        const dayRecords = summaries.filter(s =>
            s.date.toISOString().split('T')[0] === dayStr && scheduledIds.has(s.userId)
        )
        const present = dayRecords.filter(s => s.status !== 'ABSENT' && s.status !== 'LEAVE').length
        const leaveRecords = dayRecords.filter(s => s.status === 'LEAVE')
        // Paid leave (vacation/birthday/maternity) is authorised — counts toward effective attendance
        const paidLeave = leaveRecords.filter(s => {
            const lt = getLeaveTypeForDay(s.userId, dayStr)
            return lt && PAID_LEAVE_TYPES.has(lt)
        }).length
        const unpaidOrSickLeave = leaveRecords.length - paidLeave
        const noWork = totalActiveStaff - scheduledCount
        // Pending leave: staff absent on this day but with a pending leave request
        const pendingLeave = scheduledStaff.filter(u => {
            const rec = summaries.find(s => s.userId === u.id && s.date.toISOString().split('T')[0] === dayStr)
            const isAbsent = !rec || rec.status === 'ABSENT'
            return isAbsent && hasPendingLeaveOnDay(u.id, dayStr)
        }).length

        const absent = Math.max(0, scheduledCount - present - leaveRecords.length - pendingLeave)
        // Paid leave staff excluded from denominator — not expected at work
        const denominator = scheduledCount - paidLeave
        return {
            date: dayStr,
            present,
            paidLeave,
            unpaidOrSickLeave,
            pendingLeave,
            absent,
            noWork,
            rate: denominator > 0 ? Math.round((present / denominator) * 100) : 0
        }
    })

    // --- Leave breakdown by type ---
    const leaveTypeMap: Record<string, { count: number; days: number }> = {}
    for (const leave of leavesApproved) {
        const t = leave.type || 'OTHER'
        if (!leaveTypeMap[t]) leaveTypeMap[t] = { count: 0, days: 0 }
        leaveTypeMap[t].count++
        const ls = new Date(leave.startDate)
        const le = new Date(leave.endDate)
        const days = Math.max(1, Math.round((le.getTime() - ls.getTime()) / 86400000) + 1)
        leaveTypeMap[t].days += days
    }
    const leaveBreakdown = Object.entries(leaveTypeMap)
        .map(([type, v]) => ({ type, ...v }))
        .sort((a, b) => b.days - a.days)

    const leaveStatusBreakdown = {
        approved: leaveRequests.filter(l => l.status === 'APPROVED').length,
        pending: leaveRequests.filter(l => l.status === 'PENDING').length,
        declined: leaveRequests.filter(l => l.status === 'DECLINED').length,
    }

    // --- Department stats ---
    // Built per-user (same logic as staffKPI) so scheduled days, paid leave, and
    // calculateTardiness are all applied consistently — prevents rates above 100%.
    const deptMap: Record<string, {
        deptId: string; dept: string; headcount: number;
        present: number; expected: number; late: number;
        totalWorkMin: number; leaveDays: number; wfhDays: number;
    }> = {}

    for (const user of users) {
        const key = user.departmentId || '__none'
        const name = user.department?.name || 'Unassigned'
        if (!deptMap[key]) deptMap[key] = { deptId: key, dept: name, headcount: 0, present: 0, expected: 0, late: 0, totalWorkMin: 0, leaveDays: 0, wfhDays: 0 }
        deptMap[key].headcount++

        const userSummaries = summaries.filter(s => s.userId === user.id)
        const userScheduledDays = workingDays.filter(d => isUserScheduledDay(user.workingDays, d))

        // Expected = scheduled days minus approved paid leave days
        const userPaidLeaveDaysCount = userScheduledDays.filter(dayStr => {
            const lt = getLeaveTypeForDay(user.id, dayStr)
            return lt && PAID_LEAVE_TYPES.has(lt)
        }).length
        deptMap[key].expected += Math.max(0, userScheduledDays.length - userPaidLeaveDaysCount)

        // Only count present summaries that fall on this user's scheduled working days
        for (const dayStr of userScheduledDays) {
            const rec = userSummaries.find(s => s.date.toISOString().split('T')[0] === dayStr)
            if (!rec || rec.status === 'ABSENT' || rec.status === 'LEAVE') continue
            // Skip paid leave days
            const lt = getLeaveTypeForDay(user.id, dayStr)
            if (lt && PAID_LEAVE_TYPES.has(lt)) continue

            deptMap[key].present++
            deptMap[key].totalWorkMin += rec.totalWorkDuration
            if (rec.mode === 'WFH') deptMap[key].wfhDays++
            if (rec.clockIn && calculateTardiness(rec, user) > 0) deptMap[key].late++
        }

        // Leave days: count approved leaves on scheduled days using the approved-only lookup
        for (const dayStr of userScheduledDays) {
            if (getLeaveTypeForDay(user.id, dayStr)) deptMap[key].leaveDays++
        }
    }

    const departmentStats = Object.values(deptMap)
        .map(d => ({
            deptId: d.deptId,
            dept: d.dept,
            headcount: d.headcount,
            attendanceRate: d.expected > 0 ? Math.round((d.present / d.expected) * 100) : 0,
            lateRate: d.present > 0 ? Math.round((d.late / d.present) * 100) : 0,
            avgHours: d.present > 0 ? Math.round((d.totalWorkMin / d.present / 60) * 10) / 10 : 0,
            leaveDays: d.leaveDays,
            wfhRate: d.present > 0 ? Math.round((d.wfhDays / d.present) * 100) : 0,
        }))
        .sort((a, b) => b.attendanceRate - a.attendanceRate)

    // --- WFH vs Office (weekly buckets) ---
    const wfhTrendMap: Record<string, { office: number; wfh: number; other: number }> = {}
    for (const s of presentSummaries) {
        const weekStart = startOfWeek(new Date(s.date), { weekStartsOn: 1 }).toISOString().split('T')[0]
        if (!wfhTrendMap[weekStart]) wfhTrendMap[weekStart] = { office: 0, wfh: 0, other: 0 }
        if (s.mode === 'OFFICE') wfhTrendMap[weekStart].office++
        else if (s.mode === 'WFH') wfhTrendMap[weekStart].wfh++
        else wfhTrendMap[weekStart].other++
    }
    const wfhVsOfficeTrend = Object.entries(wfhTrendMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, ...v }))

    // --- Tardiness buckets ---
    // Use same filtered pool as attendance: only scheduled working days, exclude paid leave days
    const tardinessValues = presentSummaries
        .filter(s => {
            if (!s.clockIn) return false
            const dayStr = s.date.toISOString().split('T')[0]
            // Exclude no-work days for this user
            if (!isUserScheduledDay(s.user.workingDays ?? null, dayStr)) return false
            // Exclude paid leave days (shouldn't be in presentSummaries but guard anyway)
            const lt = getLeaveTypeForDay(s.userId, dayStr)
            if (lt && PAID_LEAVE_TYPES.has(lt)) return false
            return true
        })
        .map(s => calculateTardiness(s, s.user))

    const tardinessBuckets = [
        { bucket: 'On Time', min: 0, max: 0 },
        { bucket: '1–15 min', min: 1, max: 15 },
        { bucket: '16–30 min', min: 16, max: 30 },
        { bucket: '31–60 min', min: 31, max: 60 },
        { bucket: '> 1 hour', min: 61, max: Infinity },
    ].map(b => ({
        bucket: b.bucket,
        count: tardinessValues.filter(v => b.max === 0 ? v === 0 : v >= b.min && (b.max === Infinity ? true : v <= b.max)).length
    }))

    // --- Top absent staff ---
    const absenceMap: Record<string, { id: string; name: string; dept: string; absentDays: number }> = {}
    for (const user of users) {
        absenceMap[user.id] = { id: user.id, name: user.name || 'Unknown', dept: user.department?.name || 'Unassigned', absentDays: 0 }
    }
    for (const s of absentSummaries) {
        if (absenceMap[s.userId]) absenceMap[s.userId].absentDays++
    }
    const topAbsentStaff = Object.values(absenceMap)
        .filter(s => s.absentDays > 0)
        .sort((a, b) => b.absentDays - a.absentDays)
        .slice(0, 10)
        .map(s => ({
            ...s,
            attendanceRate: workingDays.length > 0 ? Math.round(((workingDays.length - s.absentDays) / workingDays.length) * 100) : 0
        }))

    // --- Top late staff ---
    const lateMap: Record<string, { id: string; name: string; dept: string; lateDays: number; totalMin: number }> = {}
    for (const s of presentSummaries.filter(s => s.clockIn)) {
        const tardiness = calculateTardiness(s, s.user)
        if (tardiness <= 0) continue
        if (!lateMap[s.userId]) lateMap[s.userId] = { id: s.userId, name: s.user.name || '', dept: s.user.department?.name || '', lateDays: 0, totalMin: 0 }
        lateMap[s.userId].lateDays++
        lateMap[s.userId].totalMin += tardiness
    }
    const topLateStaff = Object.values(lateMap)
        .sort((a, b) => b.lateDays - a.lateDays)
        .slice(0, 10)
        .map(s => ({ ...s, avgTardiness: Math.round(s.totalMin / s.lateDays) }))

    // --- Peak clock-in hours ---
    const hourMap: Record<number, number> = {}
    for (const s of presentSummaries) {
        if (s.clockIn) {
            const h = new Date(s.clockIn).getHours()
            hourMap[h] = (hourMap[h] || 0) + 1
        }
    }
    const peakClockInHour = Array.from({ length: 12 }, (_, i) => i + 6).map(h => ({
        hour: `${h.toString().padStart(2, '0')}:00`,
        count: hourMap[h] || 0
    }))

    // --- Location breakdown ---
    const locMap: Record<string, { count: number; present: number; expected: number }> = {}
    for (const user of users) {
        const loc = user.employmentLocation || 'Unknown'
        if (!locMap[loc]) locMap[loc] = { count: 0, present: 0, expected: 0 }
        locMap[loc].count++
        locMap[loc].expected += workingDays.length
    }
    for (const s of presentSummaries) {
        const loc = users.find(u => u.id === s.userId)?.employmentLocation || 'Unknown'
        if (locMap[loc]) locMap[loc].present++
    }
    const locationBreakdown = Object.entries(locMap).map(([location, v]) => ({
        location,
        count: v.count,
        attendanceRate: v.expected > 0 ? Math.round((v.present / v.expected) * 100) : 0
    }))

    // --- Per-staff KPI ---
    const staffKPI = users.map(user => {
        const userSummaries = summaries.filter(s => s.userId === user.id)

        // Split working days into scheduled vs no-work based on the user's own schedule
        const userScheduledDays = workingDays.filter(d => isUserScheduledDay(user.workingDays, d))
        const userNoWorkDays = workingDays.filter(d => !isUserScheduledDay(user.workingDays, d))

        const userPresent = userSummaries.filter(s => s.status !== 'ABSENT' && s.status !== 'LEAVE')
        const userLeave = userSummaries.filter(s => s.status === 'LEAVE')
        const userWfh = userPresent.filter(s => s.mode === 'WFH')

        // Absent = scheduled day with no record or ABSENT record
        const userAbsentDays = userScheduledDays.filter(dayStr => {
            const rec = userSummaries.find(s => s.date.toISOString().split('T')[0] === dayStr)
            return !rec || rec.status === 'ABSENT'
        })

        const userLateDetails = userPresent.filter(s => s.clockIn && calculateTardiness(s, s.user) > 0)
        const totalTardinessMin = userLateDetails.reduce((acc, s) => acc + calculateTardiness(s, s.user), 0)

        const userOnTime = userPresent.filter(s => s.clockIn && calculateTardiness(s, s.user) === 0)
        const totalWorkMin = userPresent.reduce((acc, s) => acc + s.totalWorkDuration, 0)
        const totalBreakMin = userPresent.reduce((acc, s) => acc + s.totalBreakDuration, 0)

        // Paid leave days (don't count against attendance rate)
        const userPaidLeaveDays = userLeave.filter(s => {
            const lt = getLeaveTypeForDay(user.id, s.date.toISOString().split('T')[0])
            return lt && PAID_LEAVE_TYPES.has(lt)
        })

        // Leave type breakdown per scheduled day
        const leavesByType: Record<string, number> = { SICK: 0, VACATION: 0, BIRTHDAY: 0, MATERNITY: 0, OTHER: 0 }
        for (const dayStr of userScheduledDays) {
            const rec = userSummaries.find(s => s.date.toISOString().split('T')[0] === dayStr)
            if (rec?.status === 'LEAVE') {
                const lt = getLeaveTypeForDay(user.id, dayStr) || 'OTHER'
                leavesByType[lt] = (leavesByType[lt] || 0) + 1
            }
        }

        // Daily trend — includes NO_WORK status for unscheduled days
        const dailyTrend = workingDays.map(dayStr => {
            if (!isUserScheduledDay(user.workingDays, dayStr)) {
                return { date: dayStr, status: 'NO_WORK', leaveType: undefined, mode: null, workMin: 0, clockIn: null, clockOut: null, tardiness: 0 }
            }
            const rec = userSummaries.find(s => s.date.toISOString().split('T')[0] === dayStr)
            const leaveType = rec?.status === 'LEAVE' ? getLeaveTypeForDay(user.id, dayStr) : undefined
            return {
                date: dayStr,
                status: rec?.status || 'ABSENT',
                leaveType,
                mode: rec?.mode || null,
                workMin: rec?.totalWorkDuration || 0,
                clockIn: rec?.clockIn ? rec.clockIn.toISOString() : null,
                clockOut: rec?.clockOut ? rec.clockOut.toISOString() : null,
                tardiness: rec && rec.clockIn ? calculateTardiness(rec, user) : 0,
            }
        })

        // Paid leave days excluded from denominator — staff not expected at work on those days
        const userEffectiveExpected = userScheduledDays.length - userPaidLeaveDays.length

        return {
            id: user.id,
            name: user.name || 'Unknown',
            dept: user.department?.name || 'Unassigned',
            location: user.employmentLocation || 'Unknown',
            shiftStart: user.shiftStartTime || '09:00',
            shiftEnd: user.shiftEndTime || '17:00',
            expectedDays: userScheduledDays.length,
            noWorkDays: userNoWorkDays.length,
            presentDays: userPresent.length,
            absentDays: userAbsentDays.length,
            leaveDays: userLeave.length,
            lateDays: userLateDetails.length,
            wfhDays: userWfh.length,
            attendanceRate: userEffectiveExpected > 0 ? Math.round((userPresent.length / userEffectiveExpected) * 100) : 0,
            onTimeRate: userPresent.length > 0 ? Math.round((userOnTime.length / userPresent.length) * 100) : 0,
            avgWorkHours: userPresent.length > 0 ? Math.round((totalWorkMin / userPresent.length / 60) * 10) / 10 : 0,
            avgBreakMinutes: userPresent.length > 0 ? Math.round(totalBreakMin / userPresent.length) : 0,
            avgTardiness: userLateDetails.length > 0 ? Math.round(totalTardinessMin / userLateDetails.length) : 0,
            wfhRate: userPresent.length > 0 ? Math.round((userWfh.length / userPresent.length) * 100) : 0,
            sickLeaveDays: leavesByType.SICK,
            vacationDays: leavesByType.VACATION,
            birthdayDays: leavesByType.BIRTHDAY,
            maternityDays: leavesByType.MATERNITY,
            otherLeaveDays: leavesByType.OTHER,
            dailyTrend,
        }
    })

    return NextResponse.json({
        summary: {
            totalActiveStaff,
            attendanceRate,
            onTimeRate,
            avgWorkHours,
            totalLeaveDays: leaveSummaries.length,
            absentRate,
            wfhRate,
            avgBreakMinutes,
            workingDaysInRange: workingDays.length,
            lateDays: lateSummaries.length,
        },
        attendanceTrend,
        leaveBreakdown,
        leaveStatusBreakdown,
        departmentStats,
        wfhVsOfficeTrend,
        tardinessBuckets,
        topAbsentStaff,
        topLateStaff,
        peakClockInHour,
        locationBreakdown,
        staffKPI,
    })
}
