import { prisma } from "@/lib/prisma";
import { UserRole } from "./config";

export interface ChatContext {
    user: {
        id: string;
        name: string | null;
        email: string;
        role: UserRole[];
        department: string;
        manager: string | null;
        currentStatus: string;
        timezone: string;
    };
    attendance: any[];
    todayAttendance: any | null;
    leaves: any[];
    leaveSummary: { year: number; byType: Record<string, number>; totalApprovedDays: number };
    punctuality: {
        year: number;
        shiftStart: string;
        daysWorked: number;
        presentDays: number;
        lateDays: number;
        absentDays: number;
        punctualityRate: number;
        avgMinutesLate: number;
        recentLateInstances: Array<{ date: string; minutesLate: number }>;
    };
    managedEmployees?: any[];
}

export async function getAgentContext(userId: string, roles: UserRole[]): Promise<ChatContext> {
    const todayStr = new Date().toISOString().split('T')[0];
    const yearStart = new Date(`${new Date().getFullYear()}-01-01T00:00:00.000Z`);

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            department: true,
            manager: { select: { name: true } },
            attendanceSummaries: {
                where: { date: new Date(`${todayStr}T00:00:00.000Z`) },
                take: 1
            }
        }
    });

    if (!user) throw new Error("User not found");

    // Resolve user's local timezone from their profile
    const userTz = user.selectedTimezone ||
        (user.employmentLocation === 'Philippines' ? 'Asia/Manila' : 'Australia/Sydney')

    const fmtTime = (dt: Date | null | undefined) =>
        dt ? dt.toLocaleTimeString('en-US', { timeZone: userTz, hour: '2-digit', minute: '2-digit', hour12: true }) : null

    const fmtDate = (dt: Date) =>
        dt.toLocaleDateString('en-US', { timeZone: userTz, weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })

    // Fetch personal data + yearly summaries for punctuality in parallel
    const [attendance, leaves, yearlySummaries] = await Promise.all([
        prisma.attendance.findMany({
            where: { userId },
            orderBy: { date: 'desc' },
            take: 10,
            include: { breaks: true }
        }),
        prisma.leaveRequest.findMany({
            where: { userId, startDate: { gte: yearStart } },
            orderBy: { startDate: 'desc' }
        }),
        prisma.attendanceSummary.findMany({
            where: {
                userId,
                date: { gte: yearStart },
                status: { in: ['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY'] }
            },
            select: { date: true, clockIn: true, status: true },
            orderBy: { date: 'desc' }
        })
    ]);

    // Find today's live attendance record (more reliable than summary for current-day data)
    const todayLocalDate = new Date().toLocaleDateString('en-CA', { timeZone: userTz }) // YYYY-MM-DD
    const todayRecord = attendance.find(a => {
        const aDate = new Date(a.date).toLocaleDateString('en-CA', { timeZone: userTz })
        return aDate === todayLocalDate
    })

    const todayAttendance = todayRecord ? {
        date: fmtDate(todayRecord.date),
        status: todayRecord.status,
        clockIn: fmtTime(todayRecord.clockIn) || 'Not clocked in yet',
        clockOut: fmtTime(todayRecord.clockOut) || 'Not clocked out yet',
        breaks: todayRecord.breaks.map((b: any) => ({
            start: fmtTime(b.startTime),
            end: fmtTime(b.endTime) || 'Active'
        })),
        duration: todayRecord.duration ? `${Math.floor(todayRecord.duration / 60)}h ${todayRecord.duration % 60}m` : 'Ongoing'
    } : null

    // Determine live current status — prefer today's actual record over summary
    const liveStatus = todayRecord?.status || user.attendanceSummaries?.[0]?.status || user.availabilityStatus || 'Available'

    // --- Punctuality calculation ---
    const shiftStart: string = (user as any).shiftStartTime || '09:00'
    const [shiftH, shiftM] = shiftStart.split(':').map(Number)
    const GRACE_MS = 5 * 60 * 1000

    const presentDays = yearlySummaries.filter(s => s.status === 'PRESENT').length
    const lateDays    = yearlySummaries.filter(s => s.status === 'LATE').length
    const absentDays  = yearlySummaries.filter(s => s.status === 'ABSENT').length
    const daysWorked  = yearlySummaries.filter(s => s.status !== 'ABSENT').length
    const punctualityRate = (presentDays + lateDays) > 0
        ? Math.round((presentDays / (presentDays + lateDays)) * 100)
        : 100

    // Calculate minutes late for each LATE day
    const lateInstances = yearlySummaries
        .filter(s => s.status === 'LATE' && s.clockIn)
        .map(s => {
            const ci = s.clockIn!
            const expected = new Date(ci)
            expected.setHours(shiftH, shiftM, 0, 0)
            const minutesLate = Math.round((ci.getTime() - expected.getTime() - GRACE_MS) / 60000)
            return {
                date: fmtDate(s.date),
                minutesLate: Math.max(0, minutesLate)
            }
        })

    const avgMinutesLate = lateInstances.length > 0
        ? Math.round(lateInstances.reduce((sum, i) => sum + i.minutesLate, 0) / lateInstances.length)
        : 0

    const recentLateInstances = lateInstances.slice(0, 5)

    const context: ChatContext = {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: roles,
            department: user.department?.name || "Unassigned",
            manager: user.manager?.name || null,
            currentStatus: liveStatus,
            timezone: userTz
        },
        attendance: attendance.map(a => ({
            date: fmtDate(a.date),
            status: a.status,
            clockIn: fmtTime(a.clockIn),
            clockOut: fmtTime(a.clockOut),
            breaks: a.breaks.map((b: any) => ({
                start: fmtTime(b.startTime),
                end: fmtTime(b.endTime) || 'Active'
            })),
            duration: a.duration ? `${Math.floor(a.duration / 60)}h ${a.duration % 60}m` : "0m"
        })),
        todayAttendance,
        leaves: leaves.map(l => ({
            type: l.type,
            startDate: l.startDate.toDateString(),
            endDate: l.endDate.toDateString(),
            status: l.status,
            duration: l.duration ?? null,
            reason: l.reason ?? null
        })),
        leaveSummary: (() => {
            const approved = leaves.filter(l => l.status === 'APPROVED');
            const byType: Record<string, number> = {};
            let total = 0;
            for (const l of approved) {
                const raw = l.duration;
                let days: number;
                if (!raw) { days = 1; }
                else if (raw === 'Half Day') { days = 0.5; }
                else { const m = String(raw).match(/^(\d+(?:\.\d+)?)/); days = m ? parseFloat(m[1]) : 1; }
                byType[l.type] = (byType[l.type] || 0) + days;
                total += days;
            }
            return { year: new Date().getFullYear(), byType, totalApprovedDays: total };
        })(),
        punctuality: {
            year: new Date().getFullYear(),
            shiftStart,
            daysWorked,
            presentDays,
            lateDays,
            absentDays,
            punctualityRate,
            avgMinutesLate,
            recentLateInstances
        }
    };

    // If Manager or Admin, fetch aggregated team data
    if (roles.includes('ADMIN') || roles.includes('MANAGER')) {
        const managedEmployees = await prisma.user.findMany({
            where: {
                OR: [
                    { managerId: userId },
                    roles.includes('ADMIN') ? {} : { id: 'nothing' }
                ],
                deletedAt: null
            },
            select: {
                id: true,
                name: true,
                department: { select: { name: true } },
                roles: true,
                availabilityStatus: true,
                selectedTimezone: true,
                employmentLocation: true,
                attendanceSummaries: {
                    where: { date: new Date(`${todayStr}T00:00:00.000Z`) },
                    take: 1
                },
                leaveRequests: {
                    where: {
                        status: { in: ['PENDING', 'APPROVED'] },
                        endDate: { gte: new Date() },
                        deletedAt: null
                    },
                    orderBy: { startDate: 'asc' as const },
                    take: 5,
                    select: {
                        type: true,
                        startDate: true,
                        endDate: true,
                        status: true,
                        duration: true,
                        reason: true
                    }
                }
            },
            take: 50
        });

        context.managedEmployees = managedEmployees.map(e => {
            const eTz = e.selectedTimezone ||
                (e.employmentLocation === 'Philippines' ? 'Asia/Manila' : 'Australia/Sydney')
            const clockInRaw = e.attendanceSummaries[0]?.clockIn
            const clockInFormatted = clockInRaw
                ? clockInRaw.toLocaleTimeString('en-US', { timeZone: eTz, hour: '2-digit', minute: '2-digit', hour12: true }) + ` (${eTz})`
                : 'Not Clocked In'
            return {
                name: e.name || "Unknown",
                department: e.department?.name || "N/A",
                currentStatus: e.attendanceSummaries[0]?.status || e.availabilityStatus,
                clockInToday: clockInFormatted,
                upcomingAndPendingLeaves: e.leaveRequests.map((lr: any) => ({
                    type: lr.type,
                    startDate: lr.startDate.toDateString(),
                    endDate: lr.endDate.toDateString(),
                    status: lr.status,
                    duration: lr.duration,
                    reason: lr.reason || null
                }))
            }
        });
    }

    return context;
}
