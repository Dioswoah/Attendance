// Performance Metrics Calculation Utilities
// Handles individual work hours for accurate performance tracking

// NSW Public Holidays 2026
const HOLIDAYS_2026 = [
    '2026-01-01', // New Year's Day
    '2026-01-26', // Australia Day
    '2026-04-03', // Good Friday
    '2026-04-04', // Easter Saturday
    '2026-04-05', // Easter Sunday
    '2026-04-06', // Easter Monday
    '2026-04-25', // Anzac Day
    '2026-06-08', // King's Birthday
    '2026-10-05', // Labour Day
    '2026-12-25', // Christmas Day
    '2026-12-26', // Boxing Day
    '2026-12-28', // Boxing Day Holiday
]

/**
 * Check if the given date is a non-working day (Weekend or Holiday)
 */
export function isNonWorkingDay(date: Date | string): boolean {
    const d = new Date(date)
    // Use UTC day because dates are typically stored/processed as UTC
    const day = d.getUTCDay()
    if (day === 0 || day === 6) return true // Weekend (Sat/Sun)

    const dateStr = d.toISOString().split('T')[0]
    return HOLIDAYS_2026.includes(dateStr)
}

/**
 * Convert time string (HH:MM) or Date to minutes since midnight
 */
export function timeToMinutes(time: string | Date): number {
    if (time instanceof Date) {
        return time.getHours() * 60 + time.getMinutes()
    }
    // time is "HH:MM" format
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
}

/**
 * Calculate tardiness (late arrival) in minutes
 * Returns 0 if on-time or early
 */
export function calculateTardiness(
    attendance: any,
    user: any
): number {
    if (!attendance.clockIn) return 0

    // Only assess tardiness on working days unless explicitly scheduled
    const sessionDate = attendance.date ? new Date(attendance.date) : new Date(attendance.clockIn)
    if (!attendance.scheduledStart && isNonWorkingDay(sessionDate)) {
        return 0
    }

    const expectedStart = attendance.scheduledStart || user.shiftStartTime || "09:00"
    if (!expectedStart) return 0

    const expectedMinutes = timeToMinutes(expectedStart)
    const actualMinutes = timeToMinutes(new Date(attendance.clockIn))

    const difference = actualMinutes - expectedMinutes

    // Only count as tardiness if positive (late)
    return Math.max(0, difference)
}

/**
 * Calculate early departure in minutes
 * Returns 0 if stayed until end or later
 */
export function calculateEarlyDeparture(
    attendance: any,
    user: any
): number {
    if (!attendance.clockOut) return 0

    // Only assess early departure on working days unless explicitly scheduled
    const sessionDate = attendance.date ? new Date(attendance.date) : (attendance.clockIn ? new Date(attendance.clockIn) : new Date(attendance.clockOut))
    if (!attendance.scheduledEnd && isNonWorkingDay(sessionDate)) {
        return 0
    }

    const expectedEnd = attendance.scheduledEnd || user.shiftEndTime || "17:00"
    if (!expectedEnd) return 0

    const expectedMinutes = timeToMinutes(expectedEnd)
    const actualMinutes = timeToMinutes(new Date(attendance.clockOut))

    const difference = expectedMinutes - actualMinutes

    // Only count as early departure if positive (left early)
    return Math.max(0, difference)
}

/**
 * Calculate punctuality rate (percentage of on-time arrivals)
 */
export function calculatePunctualityRate(
    attendanceRecords: any[],
    user: any,
    gracePeriodMinutes: number = 5
): number {
    if (attendanceRecords.length === 0) return 100

    const onTimeDays = attendanceRecords.filter(record => {
        const tardiness = calculateTardiness(record, user)
        return tardiness <= gracePeriodMinutes
    }).length

    return Math.round((onTimeDays / attendanceRecords.length) * 100)
}

/**
 * Calculate average tardiness across all attendance records
 */
export function calculateAvgTardiness(
    attendanceRecords: any[],
    user: any
): number {
    if (attendanceRecords.length === 0) return 0

    const totalTardiness = attendanceRecords.reduce((sum, record) => {
        return sum + calculateTardiness(record, user)
    }, 0)

    return Math.round(totalTardiness / attendanceRecords.length)
}

/**
 * Calculate average early departure across all attendance records
 */
export function calculateAvgEarlyDeparture(
    attendanceRecords: any[],
    user: any
): number {
    if (attendanceRecords.length === 0) return 0

    const totalEarlyDeparture = attendanceRecords.reduce((sum, record) => {
        return sum + calculateEarlyDeparture(record, user)
    }, 0)

    return Math.round(totalEarlyDeparture / attendanceRecords.length)
}

/**
 * Calculate hours worked vs expected hours
 */
export function calculateHoursMetrics(
    attendance: any,
    user: any
) {
    if (!attendance.clockIn || !attendance.clockOut) {
        return {
            actualHours: 0,
            expectedHours: 0,
            variance: 0
        }
    }

    const clockIn = new Date(attendance.clockIn)
    const clockOut = new Date(attendance.clockOut)

    // Calculate actual hours worked (excluding breaks)
    const totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60)
    const breakMinutes = attendance.breakDuration || 0
    const actualHoursWorked = (totalMinutes - breakMinutes) / 60

    // Calculate expected hours
    const sessionDate = attendance.date ? new Date(attendance.date) : new Date(attendance.clockIn)
    const isExempt = !attendance.scheduledStart && isNonWorkingDay(sessionDate)

    const expectedStart = attendance.scheduledStart || (isExempt ? null : (user.shiftStartTime || "09:00"))
    const expectedEnd = attendance.scheduledEnd || (isExempt ? null : (user.shiftEndTime || "17:00"))

    const actualRounded = Math.round(actualHoursWorked * 10) / 10

    if (!expectedStart || !expectedEnd) {
        return {
            actualHours: actualRounded,
            expectedHours: 0,
            variance: actualRounded
        }
    }

    const expectedMinutes = timeToMinutes(expectedEnd) - timeToMinutes(expectedStart)
    const expectedHours = expectedMinutes / 60

    return {
        actualHours: Math.round(actualHoursWorked * 10) / 10,
        expectedHours: Math.round(expectedHours * 10) / 10,
        variance: Math.round((actualHoursWorked - expectedHours) * 10) / 10
    }
}

/**
 * Calculate total hours worked across all attendance records
 */
export function calculateTotalHours(
    attendanceRecords: any[],
    user: any
) {
    const totals = attendanceRecords.reduce((acc, record) => {
        const metrics = calculateHoursMetrics(record, user)
        return {
            actualHours: acc.actualHours + metrics.actualHours,
            expectedHours: acc.expectedHours + metrics.expectedHours
        }
    }, { actualHours: 0, expectedHours: 0 })

    return {
        actualHours: Math.round(totals.actualHours * 10) / 10,
        expectedHours: Math.round(totals.expectedHours * 10) / 10,
        variance: Math.round((totals.actualHours - totals.expectedHours) * 10) / 10
    }
}

/**
 * Get color class based on punctuality rate
 */
export function getPunctualityColor(rate: number): string {
    if (rate >= 95) return 'text-green-600'  // Excellent
    if (rate >= 85) return 'text-blue-600'   // Good
    if (rate >= 75) return 'text-yellow-600' // Fair
    return 'text-red-600'                     // Needs Improvement
}

/**
 * Get color class based on average tardiness
 */
export function getTardinessColor(avgMinutes: number): string {
    if (avgMinutes <= 5) return 'text-green-600'  // Excellent
    if (avgMinutes <= 15) return 'text-yellow-600' // Fair
    return 'text-red-600'                           // Needs Improvement
}

/**
 * Calculate comprehensive performance metrics for a user
 */
export function calculateUserPerformanceMetrics(
    attendanceRecords: any[],
    user: any,
    gracePeriodMinutes: number = 5
) {
    const punctualityRate = calculatePunctualityRate(attendanceRecords, user, gracePeriodMinutes)
    const avgTardiness = calculateAvgTardiness(attendanceRecords, user)
    const avgEarlyDeparture = calculateAvgEarlyDeparture(attendanceRecords, user)
    const totalHours = calculateTotalHours(attendanceRecords, user)

    const lateDays = attendanceRecords.filter(record =>
        calculateTardiness(record, user) > gracePeriodMinutes
    ).length

    const onTimeDays = attendanceRecords.length - lateDays

    return {
        punctualityRate,
        avgTardiness,
        avgEarlyDeparture,
        totalHoursWorked: totalHours.actualHours,
        expectedHours: totalHours.expectedHours,
        hoursVariance: totalHours.variance,
        totalDays: attendanceRecords.length,
        onTimeDays,
        lateDays,
        punctualityColor: getPunctualityColor(punctualityRate),
        tardinessColor: getTardinessColor(avgTardiness)
    }
}

/**
 * Calculate department-level aggregated metrics
 */
export function calculateDepartmentMetrics(
    userMetrics: Array<{
        punctualityRate: number
        avgTardiness: number
        avgEarlyDeparture: number
        totalHoursWorked: number
        lateDays: number
    }>
) {
    if (userMetrics.length === 0) {
        return {
            avgPunctualityRate: 100,
            avgTardiness: 0,
            avgEarlyDeparture: 0,
            totalLateDays: 0,
            staffCount: 0
        }
    }

    const avgPunctualityRate = Math.round(
        userMetrics.reduce((sum, m) => sum + m.punctualityRate, 0) / userMetrics.length
    )

    const avgTardiness = Math.round(
        userMetrics.reduce((sum, m) => sum + m.avgTardiness, 0) / userMetrics.length
    )

    const avgEarlyDeparture = Math.round(
        userMetrics.reduce((sum, m) => sum + m.avgEarlyDeparture, 0) / userMetrics.length
    )

    const totalLateDays = userMetrics.reduce((sum, m) => sum + m.lateDays, 0)

    return {
        avgPunctualityRate,
        avgTardiness,
        avgEarlyDeparture,
        totalLateDays,
        staffCount: userMetrics.length,
        punctualityColor: getPunctualityColor(avgPunctualityRate),
        tardinessColor: getTardinessColor(avgTardiness)
    }
}
