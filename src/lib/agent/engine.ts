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
        const project = process.env.PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'attendance-app-451608';
        const location = AGENT_CONFIG.location;
        const vertexAI = new VertexAI({ project, location });

        // 1. Fetch Real-time Context (RAG)
        const context = await getAgentContext(userId, roles);

        // 2. Generate System Instructions (Guardrails)
        const systemInstruction = getSystemInstructions(context);

        // 3. Initialize Generative Model
        const ragCorpusName = process.env.RAG_CORPUS_NAME
        const baseModelConfig = {
            model: AGENT_CONFIG.modelName,
            generationConfig: {
                maxOutputTokens: AGENT_CONFIG.maxOutputTokens,
                temperature: AGENT_CONFIG.temperature,
            },
            systemInstruction: {
                role: 'system',
                parts: [{ text: systemInstruction }]
            },
        };
        const generativeModel = vertexAI.getGenerativeModel({
            ...baseModelConfig,
            ...(ragCorpusName && {
                tools: [{
                    retrieval: {
                        vertexRagStore: {
                            ragResources: [{ ragCorpus: ragCorpusName }],
                            similarityTopK: 5,
                            vectorDistanceThreshold: 0.5,
                        }
                    }
                }]
            })
        });

        // 4. Format History for Vertex AI
        const rawHistory = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        })).filter(msg => msg.role === 'user' || msg.role === 'model');

        // Vertex AI requires PERFECT alternating history starting with user.
        let chatHistory: any[] = [];
        let expectedRole = 'user';

        // Add dummy user message if first message is from model
        if (rawHistory.length > 0 && rawHistory[0].role === 'model') {
            chatHistory.push({ role: 'user', parts: [{ text: 'Hi, I need assistance.' }] });
            expectedRole = 'model';
        }

        for (const msg of rawHistory) {
            if (msg.role === expectedRole) {
                chatHistory.push(msg);
                expectedRole = expectedRole === 'user' ? 'model' : 'user';
            } else {
                // If it doesn't alternate, we combine or skip. Here we just pop the last one and replace,
                // or just skip to keep it simple and robust. To be very safe, if we get two users in a row,
                // we'll inject a dummy model response. If two models, inject dummy user.
                chatHistory.push({
                    role: expectedRole,
                    parts: [{ text: expectedRole === 'user' ? 'Please continue.' : 'Understood.' }]
                });
                chatHistory.push(msg);
                // expected role was flipped twice, so it is correct for the NEXT message
            }
        }

        // The LAST message in history must NOT be 'user', because the next action is a User sending a message!
        if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
            chatHistory.pop();
        }

        // Vertex AI usually expects history to be alternating and start with user or be empty
        const chat = generativeModel.startChat({
            history: chatHistory,
        });

        // 5. Send Message and Get Response (fallback to no-RAG if cross-region corpus fails)
        let result;
        try {
            result = await chat.sendMessage(userMessage);
        } catch (ragErr: any) {
            console.warn("RAG-enabled call failed, retrying without RAG:", ragErr?.message);
            const fallbackModel = vertexAI.getGenerativeModel(baseModelConfig);
            const fallbackChat = fallbackModel.startChat({ history: chatHistory });
            result = await fallbackChat.sendMessage(userMessage);
        }
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
