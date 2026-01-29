import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { runAgent } from "@/lib/agent/engine"

export async function POST(req: Request) {
    try {
        const session = await auth();

        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { message, history } = body;

        // 1. Database Persistence - Track user message
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let chatSession = await prisma.chatSession.findFirst({
            where: {
                userId: session.user.id,
                createdAt: { gte: today }
            }
        });

        if (!chatSession) {
            chatSession = await prisma.chatSession.create({
                data: {
                    userId: session.user.id,
                    title: `Session ${new Date().toLocaleDateString()}`
                }
            });
        }

        await prisma.chatMessage.create({
            data: {
                sessionId: chatSession.id,
                role: 'user',
                content: message
            }
        });

        // 2. Run the Agent Engine (Includes RAG and Guardrails)
        const roles = (session.user as any).roles || ['USER'];
        const agentResult = await runAgent(
            session.user.id,
            roles,
            message,
            history
        );

        // 3. Database Persistence - Track model response
        await prisma.chatMessage.create({
            data: {
                sessionId: chatSession.id,
                role: 'model',
                content: agentResult.text
            }
        });

        return NextResponse.json({ response: agentResult.text });

    } catch (error: any) {
        console.error("Chat API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const chatSession = await prisma.chatSession.findFirst({
            where: {
                userId: session.user.id,
                createdAt: { gte: today }
            },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!chatSession) {
            return NextResponse.json({ messages: [] });
        }

        return NextResponse.json({
            messages: chatSession.messages.map(m => ({
                role: m.role,
                content: m.content
            }))
        });

    } catch (error) {
        console.error("Chat History Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}


export async function DELETE(req: Request) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const chatSession = await prisma.chatSession.findFirst({
            where: {
                userId: session.user.id,
                createdAt: { gte: today }
            }
        });

        if (chatSession) {
            // Delete the messages first (cascade usually handles this, but explicit is safe)
            await prisma.chatMessage.deleteMany({
                where: { sessionId: chatSession.id }
            });

            // Delete the session
            await prisma.chatSession.delete({
                where: { id: chatSession.id }
            });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Chat Reset Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
