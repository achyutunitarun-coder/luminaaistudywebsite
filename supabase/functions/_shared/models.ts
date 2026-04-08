// Shared AI infrastructure — uses Lovable AI Gateway (reliable, no rate limits)
// Updated 2026-04-08: Migrated from OpenRouter free tier to Lovable AI Gateway

export const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Model tiers for different use cases
export const MODELS_FAST = ["google/gemini-2.5-flash-lite", "google/gemini-2.5-flash"];
export const MODELS_BALANCED = ["google/gemini-2.5-flash", "google/gemini-3-flash-preview"];
export const MODELS_QUALITY = ["google/gemini-2.5-flash", "google/gemini-2.5-pro"];
export const MODELS_VISION = ["google/gemini-2.5-flash", "google/gemini-2.5-pro"];

export function getApiKey(): string {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY not set");
  return key;
}

export async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

export async function callWithFallback(
  messages: any[],
  models: string[],
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
  tag: string,
  extraOpts: Record<string, any> = {},
): Promise<Response> {
  const apiKey = getApiKey();
  for (const model of models) {
    try {
      const res = await fetchWithTimeout(AI_GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature, ...extraOpts }),
      }, timeoutMs);

      if (!res.ok) {
        const e = await res.text();
        console.error(`[${tag}] ${model} ${res.status}: ${e.slice(0, 200)}`);
        continue;
      }

      console.log(`[${tag}] ✓ ${model}`);
      return res;
    } catch (e) {
      const isTimeout = e instanceof DOMException && e.name === "AbortError";
      console.error(`[${tag}] ${model} ${isTimeout ? "TIMEOUT" : "err"}:`, isTimeout ? `>${timeoutMs}ms` : e);
    }
  }
  throw new Error("AI is temporarily busy — please try again in a moment");
}

export async function callAIText(
  messages: any[],
  models: string[],
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
  tag: string,
): Promise<string> {
  const res = await callWithFallback(messages, models, maxTokens, temperature, timeoutMs, tag);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  return content;
}

export async function streamAI(
  messages: any[],
  models: string[],
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
  tag: string,
): Promise<Response> {
  return callWithFallback(messages, models, maxTokens, temperature, timeoutMs, tag, { stream: true });
}
