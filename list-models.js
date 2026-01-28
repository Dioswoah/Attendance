
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

// Check environment variable loading
const path = require('path');
const envPath = path.resolve(__dirname, '.env');
const dotenv = require('dotenv');
dotenv.config({ path: envPath });

(async () => {
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) {
        console.error("No API Key found");
        return;
    }

    // Explicitly use node-fetch or native fetch
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();

        if (data.error) {
            console.error("API Error:", JSON.stringify(data.error, null, 2));
        } else {
            console.log("Available Models:");
            if (data.models) {
                data.models.forEach(m => console.log(`- ${m.name} (${m.supportedGenerationMethods})`));
            } else {
                console.log("No models returned.");
            }
        }
    } catch (e) {
        console.error("Fetch error:", e);
    }
})();
