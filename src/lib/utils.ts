// arc/lib/utils.ts
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

const MODELS = [
  "deepseek/deepseek-r1:free",
  "deepseek/deepseek-chat-v3.1:free",
  "meta-llama/llama-4-maverick:free",
  "qwen/qwen3-235b:free"
];

export async function callStudyAI(prompt: string): Promise<string> {
  for (const model of MODELS) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You are a study assistant AI." },
            { role: "user", content: prompt }
          ],
          max_tokens: 512,
          temperature: 0.8
        })
      });

      if (!res.ok) continue;

      const data = await res.json();
      if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content;
      }
    } catch {
      continue;
    }
  }
  throw new Error("All OpenRouter models failed!");
}
