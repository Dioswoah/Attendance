import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isNonWorkingDay, calculateTardiness } from '@/lib/performance-utils'
import { format, subDays } from 'date-fns'

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

    // Require at least one filter
    if (staffIds.length === 0 && departmentIds.length === 0 && location === 'all') {
        return NextResponse.json({ staffKPI: [], workingDaysCount: 0 })
    }

    const userWhere: any = { isArchived: false, deletedAt: null }
    if (departmentIds.length > 0) userWhere.departmentId = { in: departmentIds }
    if (location !== 'all') userWhere.employmentLocation = location
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
            select: { id: true, userId: true, type: true, startDate: true, endDate: true }
        }),
        prisma.leaveRequest.findMany({
            where: {
                deletedAt: null, status: 'APPROVED',
                startDate: { lte: new Date(endDate + 'T23:59:59.999Z') },
                endDate: { gte: new Date(startDate) },
                user: userWhere,
            },
            select: { id: true, userId: true, type: true, startDate: true, endDate: true }
        }),
    ])

    // Working days
    const start = new Date(startDate)
    const end = new Date(endDate)
    const workingDays: string[] = []
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (!isNonWorkingDay(new Date(d))) {
            workingDays.push(d.toISOString().split('T')[0])
        }
    }

    // Build leave type lookup: userId -> [{startDateStr, endDateStr, type}]
    type LeaveEntry = { startDateStr: string; endDateStr: string; type: string }
    const leaveTypeLookup: Record<string, LeaveEntry[]> = {}
    for (const leave of [...leavesApproved, ...leaveRequests]) {
        if (!leaveTypeLookup[leave.userId]) leaveTypeLookup[leave.userId] = []
        leaveTypeLookup[leave.userId].push({
            startDateStr: new Date(leave.startDate).toISOString().split('T')[0],
            endDateStr: new Date(leave.endDate).toISOString().split('T')[0],
            type: leave.type || 'OTHER'
        })
    }

    function getLeaveTypeForDay(userId: string, dayStr: string): string | undefined {
        const leaves = leaveTypeLookup[userId] || []
        return leaves.find(l => dayStr >= l.startDateStr && dayStr <= l.endDateStr)?.type
    }

    const staffKPI = users.map(user => {
        const userSummaries = summaries.filter(s => s.userId === user.id)
        const userPresent = userSummaries.filter(s => s.status !== 'ABSENT' && s.status !== 'LEAVE')
        const userAbsent = userSummaries.filter(s => s.status === 'ABSENT')
        const userLeave = userSummaries.filter(s => s.status === 'LEAVE')
        const userLate = userPresent.filter(s => s.clockIn && calculateTardiness(s, s.user) > 0)
        const userOnTime = userPresent.filter(s => s.clockIn && calculateTardiness(s, s.user) === 0)
        const userWfh = userPresent.filter(s => s.mode === 'WFH')
        const totalWorkMin = userPresent.reduce((acc, s) => acc + s.totalWorkDuration, 0)
        const totalTardinessMin = userLate.reduce((acc, s) => acc + calculateTardiness(s, s.user), 0)

        // Leave type breakdown counted per day
        const leavesByType: Record<string, number> = { SICK: 0, VACATION: 0, BIRTHDAY: 0, MATERNITY: 0, OTHER: 0 }
        for (const dayStr of workingDays) {
            const rec = userSummaries.find(s => s.date.toISOString().split('T')[0] === dayStr)
            if (rec?.status === 'LEAVE') {
                const lt = getLeaveTypeForDay(user.id, dayStr) || 'OTHER'
                leavesByType[lt] = (leavesByType[lt] || 0) + 1
            }
        }

        const dailyTrend = workingDays.map(dayStr => {
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
                isManualOverride: rec?.isManualOverride || false,
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
            lateDays: userLate.length,
            wfhDays: userWfh.length,
            attendanceRate: workingDays.length > 0 ? Math.round((userPresent.length / workingDays.length) * 100) : 0,
            onTimeRate: userPresent.length > 0 ? Math.round((userOnTime.length / userPresent.length) * 100) : 0,
            avgWorkHours: userPresent.length > 0 ? Math.round((totalWorkMin / userPresent.length / 60) * 10) / 10 : 0,
            avgTardiness: userLate.length > 0 ? Math.round(totalTardinessMin / userLate.length) : 0,
            wfhRate: userPresent.length > 0 ? Math.round((userWfh.length / userPresent.length) * 100) : 0,
            sickLeaveDays: leavesByType.SICK,
            vacationDays: leavesByType.VACATION,
            birthdayDays: leavesByType.BIRTHDAY,
            maternityDays: leavesByType.MATERNITY,
            otherLeaveDays: leavesByType.OTHER,
            dailyTrend,
        }
    })

    return NextResponse.json({ staffKPI, workingDaysCount: workingDays.length })
}
