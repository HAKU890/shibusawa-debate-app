import { GoogleGenerativeAI } from "@google/generative-ai";

let client = null;

export function getClient() {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set. Create a .env file (see .env.example).");
    }
    client = new GoogleGenerativeAI(apiKey);
  }
  return client;
}

export async function generateText({ system, parts, maxTokens = 1200 }) {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: system,
  });
  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
    generationConfig: { maxOutputTokens: maxTokens },
  });
  return result.response.text();
}
