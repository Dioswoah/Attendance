
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export type NotificationType = "INFO" | "WARNING" | "SUCCESS" | "ERROR";

interface NotificationData {
    userId: string;
    title: string;
    message: string;
    type?: NotificationType;
    link?: string;
}

export async function notifyUser({ userId, title, message, type = "INFO", link }: NotificationData) {
    try {
        // 1. Save to Database
        const notification = await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type,
                link,
                read: false,
            },
        });

        // 2. Emit via Socket.IO
        // Check if global.io exists (it's set in server.ts)
        const io = (global as any).io;
        if (io) {
            // Emit to specific user room if they are connected
            // Usually users join a room with their userId
            io.to(userId).emit("notification", notification);
        }

        return notification;
    } catch (error) {
        console.error(`[Notification] Failed to send notification to user ${userId}:`, error);
    }
}

export async function notifyRole(role: Role, title: string, message: string, type: NotificationType = "INFO", link?: string) {
    try {
        const users = await prisma.user.findMany({
            where: {
                roles: {
                    has: role
                }
            },
            select: { id: true }
        });

        // Send to all users in parallel
        await Promise.all(users.map(user => notifyUser({ userId: user.id, title, message, type, link })));

    } catch (error) {
        console.error(`[Notification] Failed to notify role ${role}:`, error);
    }
}
