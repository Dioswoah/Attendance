
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Load .env
const path = require('path');
const envPath = path.resolve(__dirname, '.env');
const dotenv = require('dotenv');
dotenv.config({ path: envPath });

(async () => {
    // We can't easily list models with the high-level SDK in some versions,
    // but let's try to access the `getGenerativeModel` method again with a different model.
    // Actually, let's try to fetch the list of models using fetch directly if possible, 
    // or just try more model names.

    const modelsToTest = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-001",
        "gemini-1.5-flash-latest",
        "gemini-pro",
        "gemini-1.0-pro",
        "gemini-1.0-pro-latest",
        "gemini-pro-vision"
    ];

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

    for (const modelName of modelsToTest) {
        console.log(`Testing ${modelName}...`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hi");
            console.log(`SUCCESS: ${modelName}`);
            return; // Found one!
        } catch (error) {
            console.log(`FAILED: ${modelName} - ${error.message.split('\n')[0]}`);
        }
    }
})();
