// Shared free model fallback chains for all edge functions
// Updated 2026-04-08 with currently available models on OpenRouter

export const FREE_MODELS_FAST = [
  "qwen/qwen3.6-plus:free",
  "openai/gpt-oss-20b:free",
  "stepfun/step-3.5-flash:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "google/gemma-3-12b-it:free",
  "minimax/minimax-m2.5:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openrouter/auto",
];

export const FREE_MODELS_QUALITY = [
  "qwen/qwen3.6-plus:free",
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "minimax/minimax-m2.5:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "z-ai/glm-4.5-air:free",
  "openrouter/auto",
];

export const FREE_MODELS_LONG = [
  "qwen/qwen3.6-plus:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-120b:free",
  "minimax/minimax-m2.5:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "z-ai/glm-4.5-air:free",
  "google/gemma-3-27b-it:free",
  "openrouter/auto",
];

export const FREE_MODELS_CODE = [
  "qwen/qwen3-coder:free",
  "qwen/qwen3.6-plus:free",
  "openai/gpt-oss-120b:free",
  "minimax/minimax-m2.5:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
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
