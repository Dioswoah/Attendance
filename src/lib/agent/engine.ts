import { VertexAI } from '@google-cloud/vertexai';
import { AGENT_CONFIG, UserRole } from './config';
import { getAgentContext } from './rag';
import { getSystemInstructions } from './guardrails';

export interface AgentResponse {
    text: string;
    error?: string;
}

export async function runAgent(
    userId: string,
    roles: UserRole[],
    userMessage: string,
    history: any[]
): Promise<AgentResponse> {
    try {
        const project = process.env.PROJECT_ID || '';
        const location = AGENT_CONFIG.location;
        const vertexAI = new VertexAI({ project, location });

        // 1. Fetch Real-time Context (RAG)
        const context = await getAgentContext(userId, roles);

        // 2. Generate System Instructions (Guardrails)
        const systemInstruction = getSystemInstructions(context);

        // 3. Initialize Generative Model
        const generativeModel = vertexAI.getGenerativeModel({
            model: AGENT_CONFIG.modelName,
            generationConfig: {
                maxOutputTokens: AGENT_CONFIG.maxOutputTokens,
                temperature: AGENT_CONFIG.temperature,
            },
            systemInstruction: {
                role: 'system',
                parts: [{ text: systemInstruction }]
            }
        });

        // 4. Format History for Vertex AI
        const chatHistory = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        })).filter(msg => msg.role === 'user' || msg.role === 'model');

        // Vertex AI usually expects history to be alternating and start with user or be empty
        const chat = generativeModel.startChat({
            history: chatHistory,
        });

        // 5. Send Message and Get Response
        const result = await chat.sendMessage(userMessage);
        const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";

        return { text: responseText };

    } catch (error: any) {
        console.error("Agent Engine Error:", error);
        return {
            text: "I'm having trouble connecting to my engine right now. Please try again later.",
            error: error.message
        };
    }
}
