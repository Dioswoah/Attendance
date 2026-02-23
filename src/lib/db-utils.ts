import { prisma } from './prisma';
import { AttendanceStatus, WorkMode } from '@prisma/client';

/**
 * Log a user activity to the database.
 */
export async function logActivity(params: {
    userId: string;
    action: string;
    entityType?: string;
    entityId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
}) {
    try {
        return await prisma.activityLog.create({
            data: {
                userId: params.userId,
                action: params.action,
                entityType: params.entityType,
                entityId: params.entityId,
                details: params.details || {},
                ipAddress: params.ipAddress,
                userAgent: params.userAgent,
            },
        });
    } catch (error) {
        console.error('[ActivityLog] Error logging activity:', error);
    }
}

/**
 * Recalculate and update the AttendanceSummary for a user on a given date.
 */
export async function updateAttendanceSummary(userId: string, date: Date) {
    try {
        // Normalize date to midnight UTC
        const targetDate = new Date(date);
        targetDate.setUTCHours(0, 0, 0, 0);

        const nextDay = new Date(targetDate);
        nextDay.setUTCDate(targetDate.getUTCDate() + 1);

        // Fetch all raw attendance records for this user and date
        const rawRecords = await prisma.attendance.findMany({
            where: {
                userId,
                date: {
                    gte: targetDate,
                    lt: nextDay,
                },
                deletedAt: null,
            },
            include: {
                breaks: {
                    where: { deletedAt: null },
                },
            },
            orderBy: { clockIn: 'asc' },
        });

        // Fetch User to check shift times if needed for LATE calculation
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { shiftStartTime: true }
        });

        if (rawRecords.length === 0) {
            // Check if there's an approved leave for this day
            const leave = await prisma.leave.findFirst({
                where: {
                    userId,
                    status: 'APPROVED',
                    startDate: { lte: targetDate },
                    endDate: { gte: targetDate },
                    deletedAt: null
                }
            });

            return await prisma.attendanceSummary.upsert({
                where: { userId_date: { userId, date: targetDate } },
                create: {
                    userId,
                    date: targetDate,
                    status: leave ? 'LEAVE' : 'ABSENT',
                },
                update: {
                    status: leave ? 'LEAVE' : 'ABSENT',
                    clockIn: null,
                    clockOut: null,
                    totalWorkDuration: 0,
                    totalBreakDuration: 0,
                },
            });
        }

        // Aggregate data
        let firstClockIn = rawRecords[0].clockIn;
        let lastClockOut = rawRecords[rawRecords.length - 1].clockOut;
        let totalWorkDuration = 0;
        let totalBreakDuration = 0;
        let primaryMode: WorkMode = rawRecords[0].mode;

        for (const record of rawRecords) {
            if (record.clockIn && record.clockOut) {
                const duration = Math.floor((record.clockOut.getTime() - record.clockIn.getTime()) / 1000 / 60); // minutes
                totalWorkDuration += duration;
            }

            for (const b of record.breaks) {
                if (b.startTime && b.endTime) {
                    const bDuration = Math.floor((b.endTime.getTime() - b.startTime.getTime()) / 1000 / 60); // minutes
                    totalBreakDuration += bDuration;
                }
            }
        }

        // Determine status
        let status: AttendanceStatus = 'PRESENT';

        // Simple LATE check: if first clock in is after shift start time + 5 mins grace
        if (firstClockIn && user?.shiftStartTime) {
            const [sHour, sMin] = user.shiftStartTime.split(':').map(Number);
            const expectedStart = new Date(firstClockIn);
            expectedStart.setHours(sHour, sMin, 0, 0);

            // Add 5 mins grace
            const graceTime = new Date(expectedStart.getTime() + 5 * 60 * 1000);
            if (firstClockIn > graceTime) {
                status = 'LATE';
            }
        }

        const summary = await prisma.attendanceSummary.upsert({
            where: { userId_date: { userId, date: targetDate } },
            create: {
                userId,
                date: targetDate,
                clockIn: firstClockIn,
                clockOut: lastClockOut,
                totalWorkDuration,
                totalBreakDuration,
                status,
                mode: primaryMode,
            },
            update: {
                clockIn: firstClockIn,
                clockOut: lastClockOut,
                totalWorkDuration,
                totalBreakDuration,
                status,
                mode: primaryMode,
                // Don't overwrite if manual override is active, unless we want to?
                // The user said "that summary table can be overwritten and not"
                // Usually we don't want to auto-overwrite if it was manually corrected.
            },
        });

        // Link raw records to this summary
        await prisma.attendance.updateMany({
            where: {
                userId,
                date: {
                    gte: targetDate,
                    lt: nextDay,
                },
                deletedAt: null
            },
            data: {
                summaryId: summary.id
            }
        });

        return summary;
    } catch (error) {
        console.error('[AttendanceSummary] Aggregation failed:', error);
    }
}
