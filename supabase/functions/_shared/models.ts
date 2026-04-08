// Shared free model fallback chains for all edge functions
// openrouter/auto auto-routes to the best available free model
// The rest are manually curated high-quality free models spread across providers

export const FREE_MODELS_FAST = [
  "openrouter/auto",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-4-maverick:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "qwen/qwen3-235b-a22b:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-12b-it:free",
];

export const FREE_MODELS_QUALITY = [
  "openrouter/auto",
  "qwen/qwen3-235b-a22b:free",
  "meta-llama/llama-4-maverick:free",
  "google/gemma-3-27b-it:free",
  "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-12b-it:free",
];

export const FREE_MODELS_LONG = [
  "openrouter/auto",
  "qwen/qwen3-235b-a22b:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-4-maverick:free",
  "google/gemma-3-27b-it:free",
  "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-12b-it:free",
];

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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
  apiKey: string,
  messages: any[],
  models: string[],
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
  tag: string,
  extraOpts: Record<string, any> = {},
): Promise<Response> {
  for (const model of models) {
    try {
      const res = await fetchWithTimeout(OPENROUTER_URL, {
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
  throw new Error("All models failed — please try again in a moment");
}

export async function callAIText(
  apiKey: string,
  messages: any[],
  models: string[],
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
  tag: string,
): Promise<string> {
  const res = await callWithFallback(apiKey, messages, models, maxTokens, temperature, timeoutMs, tag);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  return content;
}
