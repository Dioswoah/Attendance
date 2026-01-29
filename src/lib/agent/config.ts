export const AGENT_CONFIG = {
    name: "RISA",
    fullName: "Redadair Intelligent Staff Assistant",
    modelName: "gemini-2.0-flash", // Using the latest stable available in Vertex
    location: "us-central1",
    temperature: 0.2, // Keep it grounded
    maxOutputTokens: 1024,
};

export type UserRole = 'ADMIN' | 'MANAGER' | 'USER';
