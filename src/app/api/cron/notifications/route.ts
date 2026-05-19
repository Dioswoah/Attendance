import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { sendBreakLimitEmail, sendLateArrivalEmail, sendBreakExpectedReturnEmail, sendManagerLateReportEmail } from "@/lib/email";
import { generateMagicLink } from "@/lib/magic-link";
import { broadcastUpdate } from "@/lib/eventBus";
import { isNSWPublicHoliday, isAustralianTimezone } from "@/lib/holidays";
import { cleanupOldSessions, cleanupDuplicateBreaks } from "@/app/api/attendance/route";

export const dynamic = 'force-dynamic'; // Prevent static caching

export async function GET(request: Request) {
    try {
        // Guard: only the designated deployment (P2 prod SG) should run cron jobs.
        // Without this, every deployed instance sharing the same DB would run duplicate crons.
        if (process.env.ENABLE_CRON !== 'true') {
            console.log("[Attendance Monitor] CRON disabled on this deployment - skipping.");
            return NextResponse.json({ success: true, message: "Cron disabled on this deployment." });
        }

        const authHeader = request.headers.get("authorization") || request.headers.get("x-cron-secret");
        const expectedSecret = process.env.CRON_SECRET;

        if (expectedSecret && authHeader !== `Bearer ${expectedSecret}` && authHeader !== expectedSecret) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        console.log("[Attendance Monitor] CRON Job Triggered manually or by Scheduler");

        // Attendance dates are stored using Philippine midnight (Asia/Manila) via getPHTToday().
        // Use the same timezone to avoid picking up yesterday's records during the UTC midnight → PHT midnight window.
        const phtDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
        const [phtYear, phtMonth, phtDay] = phtDateStr.split('-').map(Number);
        const startOfDay = new Date(Date.UTC(phtYear, phtMonth - 1, phtDay));

        // ============================================================
        // 1. Break Limits Check
        // ============================================================
        const attendances = await prisma.attendance.findMany({
            where: {
                date: startOfDay, // Exact match: only today's Philippine-date records
                clockOut: null, // Active day
                deletedAt: null,
                OR: [
                    { breakWarningSent: false },
                    { breakLimitExceededSent: false }
                ]
            },
            include: {
                breaks: { where: { deletedAt: null } }, // Exclude soft-deleted breaks
                user: {
                    include: {
                        accounts: true
                    }
                }
            }
        });

        for (const att of attendances) {
            // Calculate total break duration
            let totalMs = 0;
            let hasActiveBreak = false;

            for (const b of att.breaks) {
                if (b.endTime) {
                    totalMs += (new Date(b.endTime).getTime() - new Date(b.startTime).getTime());
                } else if (!b.endTime && !b.deletedAt) { // Ignore deleted active breaks if any
                    hasActiveBreak = true;
                    totalMs += (Date.now() - new Date(b.startTime).getTime());
                }
            }

            const totalMinutes = totalMs / 60000;
            const LIMIT_MINUTES = 60; // 1 Hour
            const WARNING_MINUTES = 45; // 45 Mins

            const googleAccount = att.user.accounts.find(a => a.provider === 'google');
            const accessToken = googleAccount?.access_token;
            const refreshToken = googleAccount?.refresh_token || undefined;
            const nextAuthUrl = process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app';

            // Check Limit (60m)
            if (totalMinutes > LIMIT_MINUTES && !att.breakLimitExceededSent) {
                const claimed = await prisma.attendance.updateMany({
                    where: { id: att.id, breakLimitExceededSent: false },
                    data: { breakLimitExceededSent: true }
                });
                if (claimed.count === 0) continue;

                const actionLink = generateMagicLink(att.userId, 'end-break');
                await prisma.notification.create({
                    data: {
                        userId: att.userId,
                        title: "Break Limit Exceeded",
                        message: "You have been on break for over 1 hour. Please return to work.",
                        type: "BREAK_LIMIT",
                        link: actionLink
                    }
                });
                broadcastUpdate('notification', { userId: att.userId });
                await sendBreakLimitEmail({
                    userName: att.user.name || "Employee",
                    userEmail: att.user.email,
                    totalBreakTime: `${Math.floor(totalMinutes)} mins`,
                    limit: "60 mins",
                    actionLink,
                });
                console.log(`[Break Check] Sent Limit Email to ${att.user.email}`);
            }
            // Check Warning (45m)
            else if (totalMinutes >= WARNING_MINUTES && !att.breakLimitExceededSent && !att.breakWarningSent) {
                const claimed = await prisma.attendance.updateMany({
                    where: { id: att.id, breakWarningSent: false },
                    data: { breakWarningSent: true }
                });
                if (claimed.count === 0) continue;

                const actionLink = `${nextAuthUrl}/user`;
                await prisma.notification.create({
                    data: {
                        userId: att.userId,
                        title: "Break Warning",
                        message: "You have been on break for 45 minutes. Your limit is 1 hour.",
                        type: "BREAK_LIMIT",
                        link: actionLink
                    }
                });
                broadcastUpdate('notification', { userId: att.userId });
                await sendBreakLimitEmail({
                    userName: att.user.name || "Employee",
                    userEmail: att.user.email,
                    totalBreakTime: `${Math.floor(totalMinutes)} mins`,
                    limit: "60 mins",
                    actionLink,
                });
                console.log(`[Break Check] Sent Warning Email to ${att.user.email}`);
            }

            // ============================================================
            // 1b. Expected Return Time Check (Friendly Reminder)
            // ============================================================
            if (hasActiveBreak) {
                const activeBreak = att.breaks.find(b => !b.endTime && !b.deletedAt);
                if (activeBreak && activeBreak.expectedReturnTime && !activeBreak.breakExpectedReturnEmailSent) {
                    const now = new Date();
                    const expected = new Date(activeBreak.expectedReturnTime);

                    // If past expected return time (with a 2-minute grace period)
                    if (now.getTime() > expected.getTime() + (2 * 60000)) {
                        const actionLink = generateMagicLink(att.userId, 'end-break');
                        // Mark as sent first to prevent re-triggering on next cron run
                        await prisma.break.update({
                            where: { id: activeBreak.id },
                            data: { breakExpectedReturnEmailSent: true }
                        });
                        // Always create in-app notification
                        await prisma.notification.create({
                            data: {
                                userId: att.userId,
                                title: "Break Status Check",
                                message: "Your break was expected to end. Please update your status.",
                                type: "BREAK_LIMIT",
                                link: actionLink
                            }
                        });
                        broadcastUpdate('notification', { userId: att.userId });
                        await sendBreakExpectedReturnEmail({
                            userName: att.user.name || "Employee",
                            userEmail: att.user.email,
                            expectedReturnTime: expected.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: att.user.selectedTimezone || 'Asia/Manila' }),
                            actionLink,
                        });
                        console.log(`[Break Check] Sent Expected Return Reminder to ${att.user.email}`);
                    }
                }
            }
        }

        // ============================================================
        // 2. Late Arrival Check
        // ============================================================
        const allActiveUsers = await prisma.user.findMany({
            where: {
                isArchived: false,
                deletedAt: null,
            },
            include: { accounts: true, department: true, manager: true }
        });

        // Track late arrivals by manager for summary emails
        const managerLateStaffMap = new Map<string, { managerId: string, managerName: string, managerEmail: string, managerTimezone: string, lateStaff: { name: string, scheduledStart: string }[] }>();

        for (const user of allActiveUsers) {
            const tz = user.selectedTimezone || 'Asia/Manila';

            const userLocalDateStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
            const userStartOfDay = new Date(`${userLocalDateStr}T00:00:00Z`);

            // Exclude Weekends
            const todayInUserTz = new Date().toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
            if (todayInUserTz === 'Sat' || todayInUserTz === 'Sun') continue;

            // Exclude NSW public holidays for Australian-timezone users
            if (isAustralianTimezone(tz) && isNSWPublicHoliday(userLocalDateStr)) continue;

            // Check if already clocked in today
            const todayAttendance = await prisma.attendance.findFirst({
                where: {
                    userId: user.id,
                    date: { gte: userStartOfDay },
                    deletedAt: null
                }
            });
            if (todayAttendance) continue;

            // Check if on approved leave today
            const approvedLeave = await prisma.leave.findFirst({
                where: {
                    userId: user.id,
                    status: 'APPROVED',
                    startDate: { lte: userStartOfDay },
                    endDate: { gte: userStartOfDay },
                    deletedAt: null
                }
            });
            if (approvedLeave) continue;

            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
            const alreadyNotified = await prisma.notification.findFirst({
                where: {
                    userId: user.id,
                    type: 'LATE_REMINDER',
                    createdAt: { gte: twelveHoursAgo }
                }
            });
            if (alreadyNotified) continue;

            const nowTimeStr = new Date().toLocaleTimeString('en-GB', { timeZone: tz, hour12: false });
            const [nowH, nowM] = nowTimeStr.split(':').map(Number);
            const nowTotalMins = nowH * 60 + nowM;

            const shiftStartStr = user.shiftStartTime || user.department?.shiftStartTime || "09:00";
            const [startH, startM] = shiftStartStr.split(':').map(Number);
            const startTotalMins = startH * 60 + startM;

            // Trigger if 10+ minutes past scheduled start and less than 12 hours late
            if (nowTotalMins >= startTotalMins + 10 && nowTotalMins < startTotalMins + 720) {
                const account = user.accounts.find(a => a.provider === 'google');
                const magicLink = generateMagicLink(user.id, 'clock-in');

                // Always create in-app notification (atomic lock against concurrent runs)
                try {
                    await prisma.notification.create({
                        data: {
                            userId: user.id,
                            title: "Late Arrival Reminder",
                            message: "You haven't clocked in yet today. Click here to clock in.",
                            type: "LATE_REMINDER",
                            link: magicLink
                        }
                    });
                } catch {
                    continue; // Another run already claimed this
                }

                broadcastUpdate('notification', { userId: user.id });

                const sent = await sendLateArrivalEmail({
                    userName: user.name || "Employee",
                    userEmail: user.email,
                    scheduledStart: shiftStartStr,
                    actionLink: magicLink,
                });

                if (sent) {
                    console.log(`[Late Check] Sent email to ${user.email}`);

                    // Add to manager's daily report (skip Viewers — they don't receive notifications)
                    if (user.manager?.email && user.manager.managerNotificationsEnabled !== false && !(user.manager.roles || []).includes('VIEWER')) {
                        const mgrId = user.manager.id;
                        if (!managerLateStaffMap.has(mgrId)) {
                            managerLateStaffMap.set(mgrId, {
                                managerId: mgrId,
                                managerName: user.manager.name || "Manager",
                                managerEmail: user.manager.email,
                                managerTimezone: user.manager.selectedTimezone || 'Asia/Manila',
                                lateStaff: []
                            });
                        }
                        managerLateStaffMap.get(mgrId)?.lateStaff.push({
                            name: user.name || "Employee",
                            scheduledStart: shiftStartStr
                        });
                    }
                }
            }
        }

        // ============================================================
        // 2b. Send Manager Daily Reports
        // ============================================================
        for (const [_, report] of managerLateStaffMap) {
            const mgrTz = report.managerTimezone;
            const mgrLocalDateStr = new Date().toLocaleDateString('en-CA', { timeZone: mgrTz });

            // Skip if it's a weekend in the manager's timezone
            const mgrDayOfWeek = new Date().toLocaleDateString('en-US', { timeZone: mgrTz, weekday: 'short' });
            if (mgrDayOfWeek === 'Sat' || mgrDayOfWeek === 'Sun') continue;

            // Skip if it's a NSW public holiday for the manager
            if (isAustralianTimezone(mgrTz) && isNSWPublicHoliday(mgrLocalDateStr)) continue;

            // Skip if manager is on approved leave today
            const mgrStartOfDay = new Date(`${mgrLocalDateStr}T00:00:00Z`);
            const managerOnLeave = await prisma.leave.findFirst({
                where: {
                    userId: report.managerId,
                    status: 'APPROVED',
                    startDate: { lte: mgrStartOfDay },
                    endDate: { gte: mgrStartOfDay },
                    deletedAt: null
                }
            });
            if (managerOnLeave) continue;

            try {
                await sendManagerLateReportEmail({
                    managerName: report.managerName,
                    managerEmail: report.managerEmail,
                    lateStaff: report.lateStaff
                });
                console.log(`[Late Check] Sent summary report to manager ${report.managerEmail} (${report.lateStaff.length} staff)`);
            } catch (err) {
                console.error(`[Late Check] Failed to send report to ${report.managerEmail}:`, err);
            }
        }

        // Auto clock-out + overdue reminders: handled entirely by cleanupOldSessions().
        // It fires the 5-min reminder email and 30-min auto clock-out email per user,
        // with per-user timezone awareness and 12-hour dedup windows to prevent spam.
        await cleanupOldSessions();
        await cleanupDuplicateBreaks();

        return NextResponse.json({ success: true, message: "Cron jobs executed successfully." });

    } catch (error) {
        console.error("[Attendance Monitor API] Error:", error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
