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

    const [users, summaries, leavesApproved, leaveRequests] = await Promise.all([
        prisma.user.findMany({
            where: userWhere,
            select: {
                id: true, name: true, departmentId: true, employmentLocation: true,
                shiftStartTime: true, shiftEndTime: true,
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
                        shiftStartTime: true, shiftEndTime: true,
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
    ])

    // Working days in range
    const start = new Date(startDate)
    const end = new Date(endDate)
    const workingDays: string[] = []
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (!isNonWorkingDay(new Date(d))) {
            workingDays.push(d.toISOString().split('T')[0])
        }
    }

    const totalActiveStaff = users.length
    const expectedAttendances = totalActiveStaff * workingDays.length

    const presentSummaries = summaries.filter(s => s.status !== 'ABSENT' && s.status !== 'LEAVE')
    const leaveSummaries = summaries.filter(s => s.status === 'LEAVE')
    const absentSummaries = summaries.filter(s => s.status === 'ABSENT')
    const lateSummaries = summaries.filter(s => s.status === 'LATE')

    // On-time: use calculateTardiness for accuracy
    const onTimeSummaries = presentSummaries.filter(s => {
        if (!s.clockIn) return false
        return calculateTardiness(s, s.user) === 0
    })

    const attendanceRate = expectedAttendances > 0 ? Math.round((presentSummaries.length / expectedAttendances) * 100) : 0
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
        const dayRecords = summaries.filter(s => s.date.toISOString().split('T')[0] === dayStr)
        const present = dayRecords.filter(s => s.status !== 'ABSENT' && s.status !== 'LEAVE').length
        const onLeave = dayRecords.filter(s => s.status === 'LEAVE').length
        const absent = Math.max(0, totalActiveStaff - present - onLeave)
        return {
            date: dayStr,
            present,
            onLeave,
            absent,
            rate: totalActiveStaff > 0 ? Math.round((present / totalActiveStaff) * 100) : 0
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
        deptMap[key].expected += workingDays.length
    }
    for (const s of summaries) {
        const key = s.user.departmentId || '__none'
        if (!deptMap[key]) continue
        if (s.status !== 'ABSENT' && s.status !== 'LEAVE') {
            deptMap[key].present++
            deptMap[key].totalWorkMin += s.totalWorkDuration
            if (s.mode === 'WFH') deptMap[key].wfhDays++
        }
        if (s.status === 'LEAVE') deptMap[key].leaveDays++
        if (s.status === 'LATE') deptMap[key].late++
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
    const tardinessValues = presentSummaries
        .filter(s => s.clockIn)
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

    // --- Per-staff KPI (only computed when specific staff are selected) ---
    const staffKPI = users.map(user => {
        const userSummaries = summaries.filter(s => s.userId === user.id)
        const userPresent = userSummaries.filter(s => s.status !== 'ABSENT' && s.status !== 'LEAVE')
        const userAbsent = userSummaries.filter(s => s.status === 'ABSENT')
        const userLeave = userSummaries.filter(s => s.status === 'LEAVE')
        const userLate = userSummaries.filter(s => s.status === 'LATE')
        const userWfh = userPresent.filter(s => s.mode === 'WFH')

        const userLateDetails = userPresent.filter(s => s.clockIn && calculateTardiness(s, s.user) > 0)
        const totalTardinessMin = userLateDetails.reduce((acc, s) => acc + calculateTardiness(s, s.user), 0)

        const userOnTime = userPresent.filter(s => s.clockIn && calculateTardiness(s, s.user) === 0)
        const totalWorkMin = userPresent.reduce((acc, s) => acc + s.totalWorkDuration, 0)
        const totalBreakMin = userPresent.reduce((acc, s) => acc + s.totalBreakDuration, 0)

        // Daily trend for this staff member
        const dailyTrend = workingDays.map(dayStr => {
            const rec = userSummaries.find(s => s.date.toISOString().split('T')[0] === dayStr)
            return {
                date: dayStr,
                status: rec?.status || 'ABSENT',
                mode: rec?.mode || null,
                workMin: rec?.totalWorkDuration || 0,
                clockIn: rec?.clockIn ? rec.clockIn.toISOString() : null,
                clockOut: rec?.clockOut ? rec.clockOut.toISOString() : null,
                tardiness: rec && rec.clockIn ? calculateTardiness(rec, user) : 0,
            }
        })

        return {
            id: user.id,
            name: user.name || 'Unknown',
            dept: user.department?.name || 'Unassigned',
            location: user.employmentLocation || 'Unknown',
            shiftStart: user.shiftStartTime || '09:00',
            shiftEnd: user.shiftEndTime || '17:00',
            expectedDays: workingDays.length,
            presentDays: userPresent.length,
            absentDays: userAbsent.length,
            leaveDays: userLeave.length,
            lateDays: userLateDetails.length,
            wfhDays: userWfh.length,
            attendanceRate: workingDays.length > 0 ? Math.round((userPresent.length / workingDays.length) * 100) : 0,
            onTimeRate: userPresent.length > 0 ? Math.round((userOnTime.length / userPresent.length) * 100) : 0,
            avgWorkHours: userPresent.length > 0 ? Math.round((totalWorkMin / userPresent.length / 60) * 10) / 10 : 0,
            avgBreakMinutes: userPresent.length > 0 ? Math.round(totalBreakMin / userPresent.length) : 0,
            avgTardiness: userLateDetails.length > 0 ? Math.round(totalTardinessMin / userLateDetails.length) : 0,
            wfhRate: userPresent.length > 0 ? Math.round((userWfh.length / userPresent.length) * 100) : 0,
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
