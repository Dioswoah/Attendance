
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url!, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    const io = new Server(server, {
        path: "/api/socket/io",
        addTrailingSlash: false,
    });

    // Make io accessible globally
    (global as any).io = io;

    io.on("connection", (socket) => {
        // console.log("Client connected", socket.id);
        socket.on("disconnect", () => {
            // console.log("Client disconnected");
        });
    });

    server.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
    });

    // Periodic Attendance Monitor (Every 1 minute)
    setInterval(async () => {
        try {
            // Dynamic import to avoid build-time issues
            const { prisma } = await import("./src/lib/prisma");
            const { sendBreakLimitEmail, sendLateArrivalEmail, sendOverdueDepartureEmail, sendBreakExpectedReturnEmail } = await import("./src/lib/email");
            const { generateMagicLink } = await import("./src/lib/magic-link");

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
                    } else if (!b.endTime && !b.deletedAt) { // Ignore deleted active breaks if any (though query filtered attendance)
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
                        // Use Magic Link for instant action
                        const actionLink = generateMagicLink(att.userId, 'end-break');

                        const sent = await sendBreakLimitEmail({
                            userName: att.user.name || "Employee",
                            userEmail: att.user.email,
                            userAccessToken: accessToken,
                            totalBreakTime: `${Math.floor(totalMinutes)} mins`,
                            limit: "60 mins",
                            actionLink,
                            refreshToken
                        });

                        if (sent) {
                            // Update flag
                            await prisma.attendance.update({
                                where: { id: att.id },
                                data: { breakLimitExceededSent: true }
                            });
                            console.log(`[Break Check] Sent Limit Email to ${att.user.email}`);
                        }
                    }
                    // Check Warning (45m)
                    else if (totalMinutes >= WARNING_MINUTES && !att.breakLimitExceededSent && !att.breakWarningSent) {
                        // Use Dashboard Link for warning (user decides)
                        const actionLink = `${nextAuthUrl}/user`;

                        const sent = await sendBreakLimitEmail({
                            userName: att.user.name || "Employee",
                            userEmail: att.user.email,
                            userAccessToken: accessToken,
                            totalBreakTime: `${Math.floor(totalMinutes)} mins`,
                            limit: "60 mins",
                            actionLink,
                            refreshToken
                        });

                        if (sent) {
                            // Update flag
                            await prisma.attendance.update({
                                where: { id: att.id },
                                data: { breakWarningSent: true }
                            });
                            console.log(`[Break Check] Sent Warning Email to ${att.user.email}`);
                        }
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

                        // If past expected return time (with a 2-minute grace period to avoid being too aggressive)
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
                                    const { broadcastUpdate } = await import("./src/lib/eventBus");
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
            // Fetch ALL active users (not archived) - we will filter per user timezone below
            const allActiveUsers = await prisma.user.findMany({
                where: {
                    isArchived: false,
                    deletedAt: null,
                },
                include: { accounts: true, department: true }
            });

            for (const user of allActiveUsers) {
                const tz = user.selectedTimezone || 'Asia/Manila';

                // Calculate the START OF TODAY in the user's own local timezone.
                // e.g. for Australia/Sydney (AEDT = UTC+11), midnight local = 1:00 PM UTC previous day.
                // This is critical: users in non-UTC timezones were being skipped because
                // the previous server-wide startOfDay (UTC midnight) did not match their local day.
                const userLocalDateStr = new Date().toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
                const userStartOfDay = new Date(`${userLocalDateStr}T00:00:00Z`);

                // Exclude Weekends (in user's timezone)
                const todayInUserTz = new Date().toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
                if (todayInUserTz === 'Sat' || todayInUserTz === 'Sun') continue;

                // Check: does the user already have an attendance record for their local today?
                const todayAttendance = await prisma.attendance.findFirst({
                    where: {
                        userId: user.id,
                        date: { gte: userStartOfDay },
                        deletedAt: null
                    }
                });
                if (todayAttendance) continue; // Already clocked in today

                // Check: was a late reminder already sent today (in user's local time)?
                const alreadyNotified = await prisma.notification.findFirst({
                    where: {
                        userId: user.id,
                        type: 'LATE_REMINDER',
                        createdAt: { gte: userStartOfDay }
                    }
                });
                if (alreadyNotified) continue; // Already sent

                // Parse current time in user's timezone
                const nowTimeStr = new Date().toLocaleTimeString('en-GB', { timeZone: tz, hour12: false }); // "HH:MM:SS"
                const [nowH, nowM] = nowTimeStr.split(':').map(Number);
                const nowTotalMins = nowH * 60 + nowM;

                const shiftStartStr = user.shiftStartTime || user.department?.shiftStartTime || "09:00";
                const [startH, startM] = shiftStartStr.split(':').map(Number);
                const startTotalMins = startH * 60 + startM;

                // Trigger if 30 mins late (and less than 12 hours late to avoid weird overlap/spam)
                if (nowTotalMins >= startTotalMins + 30 && nowTotalMins < startTotalMins + 720) {
                    const account = user.accounts.find(a => a.provider === 'google');
                    if (account?.access_token) {
                        const magicLink = generateMagicLink(user.id, 'clock-in');

                        const sent = await sendLateArrivalEmail({
                            userName: user.name || "Employee",
                            userEmail: user.email,
                            userAccessToken: account.access_token,
                            scheduledStart: shiftStartStr,
                            actionLink: magicLink,
                            refreshToken: account.refresh_token || undefined
                        });

                        if (sent) {
                            // Log Notification
                            await prisma.notification.create({
                                data: {
                                    userId: user.id,
                                    title: "Late Arrival Reminder",
                                    message: "You haven't clocked in yet today. Click here to clock in.",
                                    type: "LATE_REMINDER",
                                    link: magicLink
                                }
                            });
                            const { broadcastUpdate } = await import("./src/lib/eventBus");
                            broadcastUpdate('notification', { userId: user.id });
                            console.log(`[Late Check] Sent email to ${user.email}`);
                        }
                    }
                }
            }

            // ============================================================
            // 3. Overdue Departure Check
            // ============================================================
            // Get ALL active sessions (no date filter here - we filter per user timezone below)
            const activeSessions = await prisma.attendance.findMany({
                where: {
                    clockOut: null,
                    deletedAt: null,
                },
                include: { user: { include: { accounts: true } } }
            });

            for (const session of activeSessions) {
                const user = session.user;
                const tz = user.selectedTimezone || 'Asia/Manila';

                // Calculate start of today in this user's own timezone
                const userLocalDateStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
                const userStartOfDay = new Date(`${userLocalDateStr}T00:00:00Z`);

                // Only consider sessions that started on the user's local today
                if (session.date < userStartOfDay) continue;

                // Check if already notified (using user's local today start)
                const alreadyNotified = await prisma.notification.findFirst({
                    where: { userId: session.userId, type: 'OVERDUE_REMINDER', createdAt: { gte: userStartOfDay } }
                });
                if (alreadyNotified) continue;

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
                            // Log Notification
                            await prisma.notification.create({
                                data: {
                                    userId: user.id,
                                    title: "Overdue Departure Reminder",
                                    message: "Your shift has ended. Click here to clock out.",
                                    type: "OVERDUE_REMINDER",
                                    link: magicLink
                                }
                            });
                            const { broadcastUpdate } = await import("./src/lib/eventBus");
                            broadcastUpdate('notification', { userId: user.id });
                            console.log(`[Overdue Check] Sent email to ${user.email}`);
                        }
                    }
                }
            }

        } catch (error) {
            console.error("[Attendance Monitor] Error:", error);
        }
    }, 60000); // Check every minute

});
