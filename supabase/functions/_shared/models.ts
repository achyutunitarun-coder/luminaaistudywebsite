// Shared free model fallback chains for all edge functions
// Fastest models first, openrouter/auto as last-resort fallback

export const FREE_MODELS_FAST = [
  "meta-llama/llama-4-maverick:free",
  "google/gemma-3-27b-it:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-12b-it:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "qwen/qwen3-235b-a22b:free",
  "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "openrouter/auto",
];

export const FREE_MODELS_QUALITY = [
  "meta-llama/llama-4-maverick:free",
  "qwen/qwen3-235b-a22b:free",
  "google/gemma-3-27b-it:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-12b-it:free",
  "openrouter/auto",
];

export const FREE_MODELS_LONG = [
  "qwen/qwen3-235b-a22b:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-4-maverick:free",
  "google/gemma-3-27b-it:free",
  "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-12b-it:free",
  "openrouter/auto",
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
