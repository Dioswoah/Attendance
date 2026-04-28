import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { sendBreakLimitEmail, sendLateArrivalEmail, sendOverdueDepartureEmail, sendBreakExpectedReturnEmail, sendManagerLateReportEmail } from "@/lib/email";
import { generateMagicLink } from "@/lib/magic-link";
import { broadcastUpdate } from "@/lib/eventBus";

export const dynamic = 'force-dynamic'; // Prevent static caching

export async function GET(request: Request) {
    try {
        // You might want to add a simple auth check here so only Cloud Scheduler can trigger it.
        // For simplicity right now, and since we just moved it from background task, we leave it open.
        // In production, checking for a secret token in the header or verifying standard GCP OIDC token is recommended.
        const authHeader = request.headers.get("authorization") || request.headers.get("x-cron-secret");
        const expectedSecret = process.env.CRON_SECRET;

        if (expectedSecret && authHeader !== `Bearer ${expectedSecret}` && authHeader !== expectedSecret) {
            // Optional: return new NextResponse("Unauthorized", { status: 401 });
        }

        console.log("[Attendance Monitor] CRON Job Triggered manually or by Scheduler");

        // Server-side UTC midnight (used for break checks which don't need timezone awareness)
        const startOfDayUTC = new Date();
        startOfDayUTC.setUTCHours(0, 0, 0, 0);
        const startOfDay = startOfDayUTC;

        // ============================================================
        // 1. Break Limits Check
        // ============================================================
        const attendances = await prisma.attendance.findMany({
            where: {
                date: { gte: startOfDay },
                clockOut: null, // Active day
                deletedAt: null,
                OR: [
                    { breakWarningSent: false },
                    { breakLimitExceededSent: false }
                ]
            },
            include: {
                breaks: true,
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

            if (accessToken) {
                // Check Limit (60m)
                if (totalMinutes >= LIMIT_MINUTES && !att.breakLimitExceededSent) {
                    const claimed = await prisma.attendance.updateMany({
                        where: { id: att.id, breakLimitExceededSent: false },
                        data: { breakLimitExceededSent: true }
                    });
                    if (claimed.count === 0) continue;

                    const actionLink = generateMagicLink(att.userId, 'end-break');
                    await sendBreakLimitEmail({
                        userName: att.user.name || "Employee",
                        userEmail: att.user.email,
                        userAccessToken: accessToken,
                        totalBreakTime: `${Math.floor(totalMinutes)} mins`,
                        limit: "60 mins",
                        actionLink,
                        refreshToken
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
                    await sendBreakLimitEmail({
                        userName: att.user.name || "Employee",
                        userEmail: att.user.email,
                        userAccessToken: accessToken,
                        totalBreakTime: `${Math.floor(totalMinutes)} mins`,
                        limit: "60 mins",
                        actionLink,
                        refreshToken
                    });
                    console.log(`[Break Check] Sent Warning Email to ${att.user.email}`);
                }
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
                        if (accessToken) {
                            const actionLink = generateMagicLink(att.userId, 'end-break');
                            const sent = await sendBreakExpectedReturnEmail({
                                userName: att.user.name || "Employee",
                                userEmail: att.user.email,
                                userAccessToken: accessToken,
                                expectedReturnTime: expected.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                                actionLink,
                                refreshToken
                            });

                            if (sent) {
                                await prisma.break.update({
                                    where: { id: activeBreak.id },
                                    data: { breakExpectedReturnEmailSent: true }
                                });
                                // 2. Broadcast for real-time bell
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

                                console.log(`[Break Check] Sent Expected Return Reminder to ${att.user.email}`);
                            }
                        }
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
        const managerLateStaffMap = new Map<string, { managerName: string, managerEmail: string, lateStaff: { name: string, scheduledStart: string }[] }>();

        for (const user of allActiveUsers) {
            const tz = user.selectedTimezone || 'Asia/Manila';

            const userLocalDateStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
            const userStartOfDay = new Date(`${userLocalDateStr}T00:00:00Z`);

            // Exclude Weekends
            const todayInUserTz = new Date().toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
            if (todayInUserTz === 'Sat' || todayInUserTz === 'Sun') continue;

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
                if (account?.access_token) {
                    const magicLink = generateMagicLink(user.id, 'clock-in');

                    // Write notification first as the atomic lock — if another concurrent run
                    // already inserted one, this will succeed but alreadyNotified check above
                    // will block it. We use a try/catch in case a unique constraint is added later.
                    let notification;
                    try {
                        notification = await prisma.notification.create({
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

                    const sent = await sendLateArrivalEmail({
                        userName: user.name || "Employee",
                        userEmail: user.email,
                        userAccessToken: account.access_token,
                        scheduledStart: shiftStartStr,
                        actionLink: magicLink,
                        refreshToken: account.refresh_token || undefined
                    });

                    if (sent) {
                        broadcastUpdate('notification', { userId: user.id });
                        console.log(`[Late Check] Sent email to ${user.email}`);

                        // Add to manager's daily report (if enabled in their settings)
                        if (user.manager?.email && user.manager.managerNotificationsEnabled !== false) {
                            const mgrId = user.manager.id;
                            if (!managerLateStaffMap.has(mgrId)) {
                                managerLateStaffMap.set(mgrId, {
                                    managerName: user.manager.name || "Manager",
                                    managerEmail: user.manager.email,
                                    lateStaff: []
                                });
                            }
                            managerLateStaffMap.get(mgrId)?.lateStaff.push({
                                name: user.name || "Employee",
                                scheduledStart: shiftStartStr
                            });
                        }
                    } else {
                        // Email failed — remove the notification so it retries next cron run
                        await prisma.notification.delete({ where: { id: notification.id } });
                    }
                }
            }
        }

        // ============================================================
        // 2b. Send Manager Daily Reports
        // ============================================================
        for (const [_, report] of managerLateStaffMap) {
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

        // ============================================================
        // 3. Overdue Departure Check
        // ============================================================
        const activeSessions = await prisma.attendance.findMany({
            where: {
                clockOut: null,
                deletedAt: null,
                overdueDepartureSent: false,
            },
            include: { user: { include: { accounts: true } } }
        });

        // Deduplicate by userId — only process one session per user per cron run
        const seenUserIds = new Set<string>();

        for (const session of activeSessions) {
            const user = session.user;

            // Skip if we already processed this user in this cron run
            if (seenUserIds.has(user.id)) continue;

            const tz = user.selectedTimezone || 'Asia/Manila';

            const userLocalDateStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
            const userStartOfDay = new Date(`${userLocalDateStr}T00:00:00Z`);

            // Only consider sessions that started on the user's local today
            if (session.date < userStartOfDay) continue;

            // Second guard: check notification table to prevent concurrent-run duplicates
            // (the overdueDepartureSent flag alone has a race window between read and update)
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
            const alreadyOverdueNotified = await prisma.notification.findFirst({
                where: {
                    userId: user.id,
                    type: 'OVERDUE_REMINDER',
                    createdAt: { gte: twelveHoursAgo }
                }
            });
            if (alreadyOverdueNotified) continue;

            const nowTimeStr = new Date().toLocaleTimeString('en-GB', { timeZone: tz, hour12: false });
            const [nowH, nowM] = nowTimeStr.split(':').map(Number);
            const nowTotalMins = nowH * 60 + nowM;

            const shiftEndStr = user.shiftEndTime || "17:00";
            const [endH, endM] = shiftEndStr.split(':').map(Number);
            const endTotalMins = endH * 60 + endM;

            // Trigger if 30 mins past end time
            if (nowTotalMins >= endTotalMins + 30) {
                const account = user.accounts.find(a => a.provider === 'google');
                if (account?.access_token) {
                    // Atomic conditional update — only this cron instance proceeds if it wins the write
                    const claimed = await prisma.attendance.updateMany({
                        where: { id: session.id, overdueDepartureSent: false },
                        data: { overdueDepartureSent: true }
                    });
                    if (claimed.count === 0) continue; // Another concurrent run already claimed this

                    seenUserIds.add(user.id);

                    const magicLink = generateMagicLink(user.id, 'clock-out');

                    const sent = await sendOverdueDepartureEmail({
                        userName: user.name || "Employee",
                        userEmail: user.email,
                        userAccessToken: account.access_token,
                        scheduledEnd: shiftEndStr,
                        actionLink: magicLink,
                        refreshToken: account.refresh_token || undefined
                    });

                    if (sent) {
                        await prisma.notification.create({
                            data: {
                                userId: user.id,
                                title: "Overdue Departure Reminder",
                                message: "Your shift has ended. Click here to clock out.",
                                type: "OVERDUE_REMINDER",
                                link: magicLink
                            }
                        });
                        broadcastUpdate('notification', { userId: user.id });
                        console.log(`[Overdue Check] Sent email to ${user.email}`);
                    }
                }
            }
        }

        return NextResponse.json({ success: true, message: "Cron jobs executed successfully." });

    } catch (error) {
        console.error("[Attendance Monitor API] Error:", error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
