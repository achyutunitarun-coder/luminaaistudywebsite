// ═══════════════════════════════════════════════════════════════════
// Lumina AI — OpenRouter FREE Model Router
// Fast-first routing · proper key rotation · resilient fallbacks
// ═══════════════════════════════════════════════════════════════════

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const MODELS_FAST = [
  "google/gemma-3-4b-it:free",
  "google/gemma-3n-e4b-it:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "liquid/lfm-2.5-1.2b-instruct:free",
  "google/gemma-3-12b-it:free",
  "qwen/qwen3-4b:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
];

export const MODELS_BALANCED = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-4-31b-it:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "openai/gpt-oss-20b:free",
  "google/gemma-3-27b-it:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "deepseek/deepseek-chat-v3.1:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
];

export const MODELS_QUALITY = [
  "deepseek/deepseek-r1:free",
  "deepseek/deepseek-chat-v3.1:free",
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-3-27b-it:free",
];

// ── CODING POWERHOUSE ──────────────────────────────────────────────
// Stacked with the strongest free coding/reasoning models on OpenRouter.
// Order = priority. We race the top 3, fall back through the rest.
export const MODELS_CODE = [
  "qwen/qwen3-coder:free",
  "deepseek/deepseek-r1:free",
  "deepseek/deepseek-chat-v3.1:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "openai/gpt-oss-120b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "z-ai/glm-4.5-air:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "openai/gpt-oss-20b:free",
];

export const MODELS_LONG_CTX = [
  "google/gemma-4-31b-it:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "deepseek/deepseek-chat-v3.1:free",
  "openai/gpt-oss-120b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "minimax/minimax-m2.5:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

export const MODELS_VISION = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "google/gemma-3-27b-it:free",
  "qwen/qwen2.5-vl-72b-instruct:free",
];

export const MODELS_EXTRA = [
  "openai/gpt-oss-20b:free",
  "z-ai/glm-4.5-air:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "minimax/minimax-m2.5:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-3-4b-it:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "deepseek/deepseek-chat-v3.1:free",
];

export const MODEL_FREE_ROUTER = "openrouter/free";

// ═══════════════════════════════════════════════════════════════════
// Smart key rotation with per-key cooldown
// - Round-robin across HEALTHY keys only
// - On 429: quarantine that key for KEY_COOLDOWN_MS
// - On 401/403: long cooldown (key is bad)
// - Auto-heal after cooldown expires
// ═══════════════════════════════════════════════════════════════════

const ALL_KEYS: string[] = [
  Deno.env.get("OPENROUTER_API_KEY"),
  Deno.env.get("OPENROUTER_KEY_2"),
  Deno.env.get("OPENROUTER_KEY_3"),
  Deno.env.get("OPENROUTER_KEY_4"),
  Deno.env.get("OPENROUTER_KEY_5"),
].filter(Boolean) as string[];

if (ALL_KEYS.length === 0) {
  console.error("No OpenRouter API keys configured!");
}
console.log(`[keys] ${ALL_KEYS.length} OpenRouter key(s) loaded`);

const KEY_COOLDOWN_MS = 45_000;          // generic 429
const KEY_MODEL_COOLDOWN_MS = 90_000;    // 429 specifically on (key,model) — model-level RL
const KEY_BAD_COOLDOWN_MS = 10 * 60_000; // 401/403 / invalid

// cooledUntil[i] = epoch ms when key i is globally usable again (0 = healthy)
const _cooledUntil: number[] = ALL_KEYS.map(() => 0);
// per-(key,model) cooldown — a 429 on model X doesn't ban the key from model Y
const _modelCooledUntil: Map<string, number> = new Map();
let _keyCursor = 0;

function _mkKey(i: number, model: string) { return `${i}::${model}`; }

function _isHealthy(i: number, model?: string): boolean {
  if (_cooledUntil[i] > Date.now()) return false;
  if (model) {
    const m = _modelCooledUntil.get(_mkKey(i, model)) ?? 0;
    if (m > Date.now()) return false;
  }
  return true;
}

function _healthyCount(model?: string): number {
  let n = 0;
  for (let i = 0; i < ALL_KEYS.length; i++) if (_isHealthy(i, model)) n++;
  return n;
}

export function getNextKeyIndex(model?: string): number {
  if (ALL_KEYS.length === 0) throw new Error("No OpenRouter API keys configured");
  for (let step = 0; step < ALL_KEYS.length; step++) {
    const i = (_keyCursor + step) % ALL_KEYS.length;
    if (_isHealthy(i, model)) {
      _keyCursor = (i + 1) % ALL_KEYS.length;
      return i;
    }
  }
  let best = 0;
  let bestUntil = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ALL_KEYS.length; i++) {
    const g = _cooledUntil[i];
    const m = model ? (_modelCooledUntil.get(_mkKey(i, model)) ?? 0) : 0;
    const until = Math.max(g, m);
    if (until < bestUntil) { best = i; bestUntil = until; }
  }
  console.warn(`[keys] all cooling for ${model ?? "*"}, forcing key ${best + 1} (recovers in ${Math.round((bestUntil - Date.now()) / 1000)}s)`);
  _keyCursor = (best + 1) % ALL_KEYS.length;
  return best;
}

export function getNextKey(): string {
  return ALL_KEYS[getNextKeyIndex()];
}

export function getApiKey(): string {
  return getNextKey();
}

function markKeyCooled(i: number, ms: number, reason: string) {
  const until = Date.now() + ms;
  if (until > _cooledUntil[i]) _cooledUntil[i] = until;
  console.warn(`[keys] key ${i + 1} GLOBAL cooled ${Math.round(ms / 1000)}s (${reason}). healthy: ${_healthyCount()}/${ALL_KEYS.length}`);
}

function markKeyModelCooled(i: number, model: string, ms: number, reason: string) {
  const until = Date.now() + ms;
  const cur = _modelCooledUntil.get(_mkKey(i, model)) ?? 0;
  if (until > cur) _modelCooledUntil.set(_mkKey(i, model), until);
  console.warn(`[keys] key ${i + 1} cooled ${Math.round(ms / 1000)}s on ${model} (${reason})`);
}

const HEADERS_BASE = {
  "Content-Type": "application/json",
  "HTTP-Referer": "https://luminaai.co.in",
  "X-Title": "Lumina AI",
};

const PARALLEL_RACE_COUNT = 3;        // race 3 models for fastest first-token
const STREAM_TOTAL_BUDGET_MS = 75_000;
const TEXT_TOTAL_BUDGET_MS = 65_000;
const OCR_TOTAL_BUDGET_MS = 85_000;
const PRIMARY_RACE_TIMEOUT_MS = 8_000; // tighter primary race for snappier UX

type RouteMeta = {
  model: string;
  mode: string;
};

function sanitizeMessages(messages: any[]) {
  return messages.map((message) => {
    const role = message?.role === "assistant" || message?.role === "system" ? message.role : "user";
    const content = typeof message?.content === "string" ? message.content : String(message?.content ?? "");
    return { role, content };
  });
}

export async function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readErrorText(res: Response) {
  try {
    return (await res.text()).slice(0, 180);
  } catch {
    return "";
  }
}

async function callModel(
  model: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  tag: string,
): Promise<Response | null> {
  const maxAttempts = Math.max(1, ALL_KEYS.length);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const keyIdx = getNextKeyIndex(model);
    const key = ALL_KEYS[keyIdx];
    try {
      const res = await fetchWithTimeout(
        OPENROUTER_URL,
        {
          method: "POST",
          headers: { ...HEADERS_BASE, Authorization: `Bearer ${key}` },
          body: JSON.stringify({ ...body, model }),
        },
        timeoutMs,
      );

      if (res.ok) {
        console.log(`[${tag}] ✓ ${model} (key ${keyIdx + 1})`);
        return res;
      }

      if (res.status === 429) {
        // Per-model cooldown so this key can still serve other models
        markKeyModelCooled(keyIdx, model, KEY_MODEL_COOLDOWN_MS, `429`);
        try { await res.body?.cancel(); } catch { /* ignore */ }
        continue;
      }

      if (res.status === 401 || res.status === 403) {
        markKeyCooled(keyIdx, KEY_BAD_COOLDOWN_MS, `${res.status} invalid/forbidden`);
        try { await res.body?.cancel(); } catch { /* ignore */ }
        continue;
      }

      const errorText = await readErrorText(res);
      console.warn(`[${tag}] ${model} -> ${res.status} ${errorText} (key ${keyIdx + 1})`);

      if (res.status >= 500 || res.status === 408 || res.status === 524) {
        continue;
      }

      return null;
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === "AbortError";
      console.warn(`[${tag}] ${model} ${isTimeout ? "TIMEOUT" : "NETWORK"} (key ${keyIdx + 1})`);
    }
  }

  return null;
}

async function raceModels(
  models: string[],
  body: Record<string, unknown>,
  timeoutMs: number,
  tag: string,
): Promise<{ response: Response; model: string }> {
  const selected = models.slice(0, Math.min(PARALLEL_RACE_COUNT, models.length));
  const racers = selected.map(async (model) => {
    const res = await callModel(model, body, timeoutMs, tag);
    if (!res) throw new Error(`${model} failed`);
    return { response: res, model };
  });

  return Promise.any(racers);
}

function encodeSseData(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function withMetaStream(response: Response, meta: RouteMeta): Response {
  if (!response.body) return response;

  const source = response.body.getReader();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(encodeSseData({ lumina_meta: meta })));

      try {
        while (true) {
          const { done, value } = await source.read();
          if (done) break;
          controller.enqueue(value);
        }
      } finally {
        controller.close();
        source.releaseLock();
      }
    },
  });

  return new Response(stream, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export async function callWithFallback(
  messages: any[],
  models: string[],
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
  tag: string,
  extraOpts: Record<string, any> = {},
): Promise<{ response: Response; model: string }> {
  const safeMessages = sanitizeMessages(messages);
  const baseBody = {
    messages: safeMessages,
    max_tokens: maxTokens,
    temperature,
    ...extraOpts,
  };
  const isStreaming = extraOpts.stream === true;
  const totalBudget = Math.min(
    timeoutMs,
    tag.includes("ocr") ? OCR_TOTAL_BUDGET_MS : isStreaming ? STREAM_TOTAL_BUDGET_MS : TEXT_TOTAL_BUDGET_MS,
  );
  const deadline = Date.now() + totalBudget;
  const remainingBudget = () => deadline - Date.now();
  const phaseTimeout = (preferred: number) => Math.max(0, Math.min(preferred, remainingBudget()));

  const primaryRaceTimeout = phaseTimeout(PRIMARY_RACE_TIMEOUT_MS);
  if (primaryRaceTimeout > 0 && models.length > 1) {
    try {
      return await raceModels(models, baseBody, primaryRaceTimeout, tag);
    } catch {
      console.warn(`[${tag}] race failed, moving to sequential`);
    }
  }

  for (const model of models) {
    const timeout = phaseTimeout(isStreaming ? 10_000 : 9_000);
    if (timeout <= 0) break;
    const response = await callModel(model, baseBody, timeout, tag);
    if (response) return { response, model };
  }

  for (const model of MODELS_EXTRA) {
    const timeout = phaseTimeout(isStreaming ? 8_000 : 7_000);
    if (timeout <= 0) break;
    const response = await callModel(model, baseBody, timeout, tag);
    if (response) return { response, model };
  }

  const freeRouterTimeout = phaseTimeout(isStreaming ? 8_000 : 7_000);
  if (freeRouterTimeout > 0) {
    const response = await callModel(MODEL_FREE_ROUTER, baseBody, freeRouterTimeout, `${tag}/free-router`);
    if (response) return { response, model: MODEL_FREE_ROUTER };
  }

  throw new Error("Lumina is experiencing high demand. Please try again in a moment.");
}

export async function callAIText(
  messages: any[],
  models: string[],
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
  tag: string,
): Promise<string> {
  const { response } = await callWithFallback(messages, models, maxTokens, temperature, timeoutMs, tag);
  const data = await response.json();
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
  const { response, model } = await callWithFallback(messages, models, maxTokens, temperature, timeoutMs, tag, { stream: true });
  return withMetaStream(response, { model, mode: tag.split("/")[1] ?? tag });
}

export type IntentType = "greeting" | "quick" | "study" | "deep" | "motivation" | "conversational";
export type ModelRouteMode = "auto" | "reasoning" | "coding" | "general" | "fast" | "study" | "long_context" | "creative";

export function classifyIntent(text: string): IntentType {
  const lower = text.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).length;

  if (wordCount <= 3 && /^(hi|hello|hey|sup|yo|hola|namaste|howdy|what's up|whats up|greetings)\b/.test(lower) && !lower.includes("?")) {
    return "greeting";
  }

  if (/\b(stressed|anxious|worried|scared|nervous|can't do|give up|hopeless|overwhelmed|struggling|failing|depressed|sad|unmotivated|lazy|tired of studying)\b/.test(lower)) {
    return "motivation";
  }

  if (/\b(explain why|prove that|derive|compare and contrast|analyze|evaluate|critically|in depth|detailed|comprehensive|step by step|root cause|how does .+ work)\b/.test(lower) || wordCount > 80) {
    return "deep";
  }

  if (/\b(study|learn|teach|concept|formula|theorem|equation|definition|chapter|syllabus|exam|test|quiz|practice|revision|notes|flashcard|topic|subject|lecture|homework|assignment)\b/.test(lower)) {
    return "study";
  }

  if (wordCount <= 8 && /\b(thanks|thank you|ok|okay|got it|cool|nice|great|awesome|perfect|lol|haha|hmm|oh|wow|sure|yep|nope|alright)\b/.test(lower)) {
    return "conversational";
  }

  if (wordCount <= 25) return "quick";
  return "study";
}

export function getSystemPromptForIntent(intent: IntentType): string {
  const base = `You are Lumina — a brilliant, patient, step-by-step tutor. NOT a lecture bot. You teach like a real human tutor sitting next to the student.

CORE TUTOR RULES:
- Break explanations into small digestible steps — ONE concept at a time
- After explaining, verify understanding before moving on
- Use analogies, real-world examples, and "aha moment" connections
- Bold **key terms** always
- Use LaTeX for math: $x^2$, $\\frac{a}{b}$, $$\\int_0^1 f(x)dx$$
- Use markdown TABLES when comparing things
- NEVER dump walls of text — keep paragraphs to 2-3 lines max
- Ask follow-up questions to guide thinking
- If the student seems confused, simplify and try a different angle

FORMATTING:
- Use rich Markdown: **bold**, headings, bullets
- Keep it scannable and interactive
- End responses with a question or "what would you like to explore next?"`;

  switch (intent) {
    case "greeting":
      return `${base}\n\nThe user is greeting you. Reply with ONE short, warm line like "Hey! What are we diving into today?" — nothing more. Do NOT start a lesson unprompted.`;
    case "quick":
      return `${base}\n\nQUICK ANSWER MODE: Be direct. Answer in 1-3 short paragraphs. Get to the point. No fluff. Still bold key terms. End with "Want me to go deeper on this?"`;
    case "study":
      return `${base}\n\nSTEP-BY-STEP TEACHING MODE:
1. Start with the simplest foundation concept
2. Explain in 2-3 lines with an analogy
3. Bold the **key term**
4. Give a quick example
5. Ask "Does this make sense?" or a mini-question to check understanding
6. Only then move to the next concept

NEVER dump everything at once. Teach progressively like a patient tutor.`;
    case "deep":
      return `${base}\n\nDEEP ANALYSIS MODE:
- Break the topic into logical sections with ## headings
- Each section: 2-3 lines of explanation → worked example → key insight
- Show derivations step-by-step with numbered steps
- Use tables for comparisons
- Address common misconceptions with "⚠️ Common mistake:"
- End each section with a thought-provoking question before moving on`;
    case "motivation":
      return `${base}\n\nMOTIVATION MODE: Be warm, empathetic, and encouraging. Acknowledge their feelings genuinely. Share ONE practical strategy they can start RIGHT NOW. End with something that makes them feel capable. Keep it personal, not generic. Max 4-5 lines.`;
    case "conversational":
      return `${base}\n\nCONVERSATIONAL MODE: Be brief and natural. Match their casual energy. One or two sentences max.`;
  }
}

export function getModelsForIntent(intent: IntentType): string[] {
  switch (intent) {
    case "greeting":
    case "conversational":
      return MODELS_FAST;
    case "quick":
    case "motivation":
      return MODELS_FAST;
    case "study":
      return MODELS_BALANCED;
    case "deep":
      return MODELS_LONG_CTX;
  }
}

export function getModelsForMode(mode?: string): string[] | null {
  switch (mode as ModelRouteMode | undefined) {
    case "reasoning":
      return MODELS_QUALITY;
    case "coding":
      return MODELS_CODE;
    case "general":
    case "study":
    case "creative":
      return MODELS_BALANCED;
    case "fast":
      return MODELS_FAST;
    case "long_context":
      return MODELS_LONG_CTX;
    default:
      return null;
  }
}