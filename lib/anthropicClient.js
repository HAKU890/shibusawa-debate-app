import Anthropic from "@anthropic-ai/sdk";

let client = null;

export function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set. Create a .env file (see .env.example).");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function generateText({ system, messages, maxTokens = 1200 }) {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system,
    messages,
  });
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
