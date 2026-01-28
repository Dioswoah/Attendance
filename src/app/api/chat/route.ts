import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

// Initialize Gemini
// Ensure you add GOOGLE_GENERATIVE_AI_API_KEY to your .env file
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

export async function POST(req: Request) {
    try {
        console.log("Chat API Request Received");
        const session = await auth();

        if (!session || !session.user) {
            console.error("Chat API: Unauthorized (No Session)");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { message, history } = body;
        console.log(`Chat API: User ${session.user.email} asking: "${message}"`);

        // Check API Key
        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            console.error("Chat API: Missing GOOGLE_GENERATIVE_AI_API_KEY");
            return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
        }

        // 1. Fetch User Context
        // We fetch fresh data on every request to ensure RAG is real-time
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                department: true,
                manager: { select: { name: true, email: true } },
            }
        });

        if (!user) {
            console.error("Chat API: User not found in DB");
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // --- DATABASE PERSISTENCE START ---
        // Find or create a chat session for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let chatSession = await prisma.chatSession.findFirst({
            where: {
                userId: session.user.id,
                createdAt: { gte: today }
            }
        });

        if (!chatSession) {
            console.log("Chat API: Creating new session for today");
            chatSession = await prisma.chatSession.create({
                data: {
                    userId: session.user.id,
                    title: `Chat ${new Date().toLocaleDateString()}`
                }
            });
        }

        // Save the user's message to the database
        await prisma.chatMessage.create({
            data: {
                sessionId: chatSession.id,
                role: 'user',
                content: message
            }
        });
        // --- DATABASE PERSISTENCE END ---

        // 2. Fetch recent attendance (Last 14 days)
        const attendance = await prisma.attendance.findMany({
            where: { userId: session.user.id },
            orderBy: { date: 'desc' },
            take: 14,
            include: { breaks: true }
        });

        // 3. Fetch recent leave requests
        const leaves = await prisma.leaveRequest.findMany({
            where: { userId: session.user.id },
            orderBy: { startDate: 'desc' },
            take: 5
        });

        console.log(`Chat API: Fetched ${attendance.length} attendance records and ${leaves.length} leave requests.`);

        // 4. Determine User Role for Guardrails
        // The session roles are populated in auth.ts
        const roles = (session.user as any).roles || [];
        const isManagerOrAdmin = roles.includes("ADMIN") || roles.includes("MANAGER");

        // 5. Construct Context Object
        // We format dates to be readable
        const context = {
            currentUser: {
                name: user.name,
                email: user.email,
                department: user.department?.name || "Unassigned",
                manager: user.manager?.name || "None",
                role: roles.join(", ")
            },
            recentAttendance: attendance.map(a => ({
                date: a.date.toDateString(),
                status: a.status,
                clockIn: a.clockIn ? a.clockIn.toLocaleTimeString() : "N/A",
                clockOut: a.clockOut ? a.clockOut.toLocaleTimeString() : "N/A",
                durationEncoded: a.duration ? `${Math.floor(a.duration / 60)}h ${a.duration % 60}m` : "0h 0m",
                notes: a.notes
            })),
            recentLeaveRequests: leaves.map(l => ({
                type: l.type,
                period: `${l.startDate.toDateString()} to ${l.endDate.toDateString()}`,
                status: l.status,
                reason: l.reason
            }))
        };

        // 6. Gemini System Instruction
        const systemInstruction = `
        You are RISA (Redadair Intelligent Staff Assistant), a helpful HR assistant for the Redadair Staff Portal.
        Current Time: ${new Date().toLocaleString()}

        CONTEXT DATA (Use this to answer):
        ${JSON.stringify(context, null, 2)}

        GUARDRAILS:
        1. You are talking to ${user.name}. You strictly ONLY have access to their data provided in the CONTEXT DATA above.
        2. ${isManagerOrAdmin ?
                "The user is an Admin/Manager. However, in this specific chat window, you only have access to their PERSONAL context data (shown above). If they ask about other employees, politely explain that this chat is for their personal records only and they should use the Admin Dashboard for team management."
                :
                "The user is a Standard Staff Member. You strictly CANNOT see or discuss data for any other user. If asked about others, refuse politely."}
        3. If the user asks about attendance, calculate things based on the 'recentAttendance' list.
        4. If the user asks "Am I late?", check the 'clockIn' times.
        5. Keep answers concise, friendly, and professional. Match the tone of a helpful office assistant.
        
        Refuse to answer questions about:
        - Sensitive system internals (passwords, database structure).
        - Other users' private data.
        - General world knowledge unrelated to work (keep it briefly polite but steer back to work).
        `;

        // 7. Call Gemini
        // We use gemini-2.5-flash which is available and efficient
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: systemInstruction
        });

        // We only send the last message for now to keep it simple, or we can reconstruct history.
        // Reconstructing history is better for follow-up questions.
        // History format: { role: 'user' | 'model', parts: [{ text: string }] }

        let chatHistory = history.map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        // Gemini requires history to start with 'user'
        // We remove any leading 'model' messages (like the initial greeting)
        while (chatHistory.length > 0 && chatHistory[0].role !== 'user') {
            chatHistory.shift();
        }

        console.log(`Chat API: sending ${chatHistory.length} history items to Gemini`);

        console.log("Chat API: Sending request to Gemini...");
        const chat = model.startChat({
            history: chatHistory
        });

        const result = await chat.sendMessage(message);
        const response = result.response.text();
        console.log("Chat API: Success");

        // --- DATABASE PERSISTENCE ---
        // Save the model's response to the database
        await prisma.chatMessage.create({
            data: {
                sessionId: chatSession.id,
                role: 'model',
                content: response
            }
        });
        // ----------------------------

        return NextResponse.json({ response });

    } catch (error: any) {
        console.error("Chat API Error:", error);
        // Log deep error details if available
        if (error.response) {
            console.error("Gemini Response Error:", await error.response.text());
        }
        return NextResponse.json({ error: "Failed to process request", details: error.message }, { status: 500 });
    }
}
