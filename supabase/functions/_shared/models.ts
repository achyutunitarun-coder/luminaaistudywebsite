// Shared AI infrastructure — OpenRouter FREE models (April 2026)
// All models are $0/M input & output tokens

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ═══════════════════════════════════════════════════════════
// MODEL TIERS — categorized by capability and speed
// ═══════════════════════════════════════════════════════════

// QUALITY: Best reasoning, complex tasks (tests, analysis, study plans)
export const MODELS_QUALITY = [
  "nvidia/nemotron-3-super-120b-a12b:free",    // 120B hybrid MoE, 262K ctx
  "openai/gpt-oss-120b:free",                   // 117B MoE, 131K ctx
  "arcee-ai/trinity-large-preview:free",         // 400B MoE 13B active, 131K
  "minimax/minimax-m2.5:free",                   // strong coding & office, 197K
  "qwen/qwen3-coder:free",                      // 480B MoE code-focused, 262K
];

// BALANCED: Good quality + reasonable speed (chat, notes, flashcards)
export const MODELS_BALANCED = [
  "google/gemma-4-31b-it:free",                  // 31B dense, 262K ctx, multimodal
  "z-ai/glm-4.5-air:free",                       // MoE with thinking mode, 131K
  "nvidia/nemotron-3-super-120b-a12b:free",
  "meta-llama/llama-3.3-70b-instruct:free",      // 70B, 66K ctx
  "openai/gpt-oss-120b:free",
];

// FAST: Speed-optimized for quick responses (doubt solver, quick study)
export const MODELS_FAST = [
  "google/gemma-4-26b-a4b-it:free",              // 26B MoE 4B active, 262K ctx
  "nvidia/nemotron-3-nano-30b-a3b:free",          // 30B MoE 3B active, 256K
  "openai/gpt-oss-20b:free",                     // 21B MoE 3.6B active, 131K
  "nvidia/nemotron-nano-9b-v2:free",              // 9B, 128K ctx
  "arcee-ai/trinity-mini:free",                   // 26B MoE 3B active, 131K
  "qwen/qwen3-next-80b-a3b-instruct:free",       // 80B MoE 3B active
];

// VISION: Models supporting image input (OCR, image analysis)
export const MODELS_VISION = [
  "google/gemma-4-31b-it:free",                   // text+image, 262K ctx
  "google/gemma-4-26b-a4b-it:free",               // text+image+video, 262K ctx
  "nvidia/nemotron-nano-12b-v2-vl:free",           // 12B VL, OCR-optimized, 128K
];

// LONG CONTEXT: For very long documents (262K+ context)
export const MODELS_LONG_CTX = [
  "nvidia/nemotron-3-super-120b-a12b:free",       // 262K
  "qwen/qwen3-coder:free",                        // 262K
  "google/gemma-4-31b-it:free",                    // 262K
  "google/gemma-4-26b-a4b-it:free",                // 262K
  "nvidia/nemotron-3-nano-30b-a3b:free",           // 256K
];

// CODING: Optimized for code generation tasks
export const MODELS_CODE = [
  "qwen/qwen3-coder:free",                        // 480B code-focused
  "minimax/minimax-m2.5:free",                     // strong SWE-bench
  "openai/gpt-oss-120b:free",                     // agentic + tool use
  "nvidia/nemotron-3-super-120b-a12b:free",
];

// FREE ROUTER: OpenRouter's automatic free model selector
export const MODEL_FREE_ROUTER = "openrouter/free";

// ═══════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════

export function getApiKey(): string {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) throw new Error("OPENROUTER_API_KEY not set");
  return key;
}

export async function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  timeoutMs: number,
): Promise<Response> {
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
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://luminaaistudywebsite.lovable.app",
    "X-Title": "Lumina AI Study",
  };

  for (const model of models) {
    try {
      const res = await fetchWithTimeout(
        OPENROUTER_URL,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
            ...extraOpts,
          }),
        },
        timeoutMs,
      );

      if (!res.ok) {
        const e = await res.text();
        console.error(`[${tag}] ${model} ${res.status}: ${e.slice(0, 200)}`);
        // On 429 rate limit, try next model immediately
        if (res.status === 429) continue;
        // On 402 payment required, skip
        if (res.status === 402) continue;
        // On other errors, try next
        continue;
      }

      console.log(`[${tag}] ✓ ${model}`);
      return res;
    } catch (e) {
      const isTimeout =
        e instanceof DOMException && e.name === "AbortError";
      console.error(
        `[${tag}] ${model} ${isTimeout ? "TIMEOUT" : "err"}:`,
        isTimeout ? `>${timeoutMs}ms` : e,
      );
    }
  }

  // Last resort: try the free router
  try {
    console.log(`[${tag}] Trying free router as last resort...`);
    const res = await fetchWithTimeout(
      OPENROUTER_URL,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: MODEL_FREE_ROUTER,
          messages,
          max_tokens: maxTokens,
          temperature,
          ...extraOpts,
        }),
      },
      timeoutMs,
    );
    if (res.ok) {
      console.log(`[${tag}] ✓ free-router`);
      return res;
    }
    const errText = await res.text();
    console.error(`[${tag}] free-router ${res.status}: ${errText.slice(0, 200)}`);
  } catch (e) {
    console.error(`[${tag}] free-router failed:`, e);
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
  const res = await callWithFallback(
    messages,
    models,
    maxTokens,
    temperature,
    timeoutMs,
    tag,
  );
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
  return callWithFallback(
    messages,
    models,
    maxTokens,
    temperature,
    timeoutMs,
    tag,
    { stream: true },
  );
}
