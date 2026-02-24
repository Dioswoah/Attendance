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
    };
    attendance: any[];
    leaves: any[];
    managedEmployees?: any[]; // For managers/admins to hold their team's today status
}

export async function getAgentContext(userId: string, roles: UserRole[]): Promise<ChatContext> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            department: true,
            manager: { select: { name: true } },
        }
    });

    if (!user) throw new Error("User not found");

    // Fetch personal data (Always retrieved)
    const [attendance, leaves] = await Promise.all([
        prisma.attendance.findMany({
            where: { userId },
            orderBy: { date: 'desc' },
            take: 10,
            include: { breaks: true }
        }),
        prisma.leaveRequest.findMany({
            where: { userId },
            orderBy: { startDate: 'desc' },
            take: 5
        })
    ]);

    const context: ChatContext = {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: roles,
            department: user.department?.name || "Unassigned",
            manager: user.manager?.name || null
        },
        attendance: attendance.map(a => ({
            date: a.date.toDateString(),
            status: a.status,
            clockIn: a.clockIn?.toLocaleTimeString(),
            clockOut: a.clockOut?.toLocaleTimeString(),
            duration: a.duration ? `${Math.floor(a.duration / 60)}h ${a.duration % 60}m` : "0m"
        })),
        leaves: leaves.map(l => ({
            type: l.type,
            startDate: l.startDate.toDateString(),
            endDate: l.endDate.toDateString(),
            status: l.status
        }))
    };

    // If Manager or Admin, fetch some aggregated team data (Safe summary)
    if (roles.includes('ADMIN') || roles.includes('MANAGER')) {
        const todayStr = new Date().toISOString().split('T')[0];

        const managedEmployees = await prisma.user.findMany({
            where: {
                OR: [
                    { managerId: userId },
                    roles.includes('ADMIN') ? {} : { id: 'nothing' } // Admin sees all
                ],
                deletedAt: null
            },
            select: {
                id: true,
                name: true,
                department: { select: { name: true } },
                roles: true,
                availabilityStatus: true,
                attendanceSummaries: {
                    where: { date: new Date(`${todayStr}T00:00:00.000Z`) },
                    take: 1
                },
                leaveRequests: {
                    where: { status: 'PENDING', deletedAt: null },
                    take: 2
                }
            },
            take: 50 // Limit to prevent massive token inflation
        });

        context.managedEmployees = managedEmployees.map(e => ({
            name: e.name || "Unknown",
            department: e.department?.name || "N/A",
            currentStatus: e.attendanceSummaries[0]?.status || e.availabilityStatus,
            clockInToday: e.attendanceSummaries[0]?.clockIn?.toLocaleTimeString() || "Not Clocked In",
            pendingLeaves: e.leaveRequests.length
        }));
    }

    return context;
}
