import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { sendManagerValidationReminderEmail } from "@/lib/email";
import { broadcastUpdate } from "@/lib/eventBus";

export const dynamic = 'force-dynamic';

// Fired by a dedicated weekly Cloud Scheduler job (Wednesdays, 06:00 Asia/Manila) — not part of
// the frequent-interval /api/cron/notifications job, since this only ever needs to run once a week.
export async function GET(request: Request) {
    try {
        // Guard: only the designated deployment (P2 prod SG) should run cron jobs.
        if (process.env.ENABLE_CRON !== 'true') {
            console.log("[Manager Validation Reminder] CRON disabled on this deployment - skipping.");
            return NextResponse.json({ success: true, message: "Cron disabled on this deployment." });
        }

        const authHeader = request.headers.get("authorization") || request.headers.get("x-cron-secret");
        const expectedSecret = process.env.CRON_SECRET;
        if (expectedSecret && authHeader !== `Bearer ${expectedSecret}` && authHeader !== expectedSecret) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const managers = await prisma.user.findMany({
            where: {
                roles: { has: 'MANAGER' },
                isArchived: false,
                deletedAt: null,
                managerNotificationsEnabled: { not: false }
            },
            select: { id: true, name: true, email: true }
        });

        const recordUrl = `${process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app'}/user/manager?tab=record`;
        let sentCount = 0;

        for (const manager of managers) {
            await prisma.notification.create({
                data: {
                    userId: manager.id,
                    title: "Time to Validate Your Staff",
                    message: "Your weekly attendance review is due. Click here to validate your staff's records.",
                    type: "VALIDATION_REMINDER",
                    link: recordUrl
                }
            });
            broadcastUpdate('notification', { userId: manager.id });

            const sent = await sendManagerValidationReminderEmail({
                managerName: manager.name || "Manager",
                managerEmail: manager.email,
            });
            if (sent) sentCount++;
        }

        console.log(`[Manager Validation Reminder] Sent to ${sentCount}/${managers.length} managers`);
        return NextResponse.json({ success: true, sent: sentCount, total: managers.length });
    } catch (error) {
        console.error("[Manager Validation Reminder] Error:", error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
