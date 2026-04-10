// ═══════════════════════════════════════════════════════════════════
// Lumina AI — OpenRouter FREE Model Router
// Full 24-model pool · parallel race · smart tier routing
// ═══════════════════════════════════════════════════════════════════

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ─── TIER 1: ULTRA-FAST TEXT ───
export const MODELS_FAST = [
  "google/gemma-3n-e2b-it:free",
  "google/gemma-3n-e4b-it:free",
  "google/gemma-3-4b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "liquid/lfm-2.5-1.2b-instruct:free",
];

// ─── TIER 2: BALANCED (study, chat, notes, flashcards) ───
export const MODELS_BALANCED = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "google/gemma-4-31b-it:free",
  "openai/gpt-oss-20b:free",
  "z-ai/glm-4.5-air:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-3-4b-it:free",
];

// ─── TIER 3: QUALITY / DEEP REASONING ───
export const MODELS_QUALITY = [
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-3-27b-it:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "google/gemma-3-12b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

// ─── TIER 4: CODING ───
export const MODELS_CODE = [
  "qwen/qwen3-coder:free",
  "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
  "openai/gpt-oss-120b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

// ─── TIER 5: LONG CONTEXT (documents, notes, plans) ───
export const MODELS_LONG_CTX = [
  "minimax/minimax-m2.5:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-4-31b-it:free",
];

// ─── TIER 6: VISION / OCR ───
export const MODELS_VISION = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "google/gemma-3-12b-it:free",
];

// ─── EXTRA FALLBACK POOL ───
export const MODELS_EXTRA = [
  "arcee-ai/trinity-large-preview:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "liquid/lfm-2.5-1.2b-thinking:free",
];

// ─── FREE ROUTER: OpenRouter's automatic selector (nuclear fallback) ───
export const MODEL_FREE_ROUTER = "openrouter/free";

// ═══════════════════════════════════════════════════════════════════
// CORE UTILITIES
// ═══════════════════════════════════════════════════════════════════

export function getApiKey(): string {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) throw new Error("OPENROUTER_API_KEY not set");
  return key;
}

const HEADERS_BASE = {
  "Content-Type": "application/json",
  "HTTP-Referer": "https://luminaaistudywebsite.lovable.app",
  "X-Title": "Lumina AI Study",
};

const PARALLEL_RACE_COUNT = 3;
const STREAM_TOTAL_BUDGET_MS = 12_000;
const TEXT_TOTAL_BUDGET_MS = 18_000;
const OCR_TOTAL_BUDGET_MS = 28_000;

export async function fetchWithTimeout(
  url: string, opts: RequestInit, timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ═══════════════════════════════════════════════════════════════════
// PARALLEL RACE — Send to N models, return FIRST valid response
// ═══════════════════════════════════════════════════════════════════

async function raceModels(
  models: string[],
  body: Record<string, unknown>,
  timeoutMs: number,
  tag: string,
  onRateLimit?: () => void,
): Promise<Response> {
  const apiKey = getApiKey();
  const headers = { ...HEADERS_BASE, Authorization: `Bearer ${apiKey}` };

  const racers = models.slice(0, PARALLEL_RACE_COUNT).map(async (model) => {
    const res = await fetchWithTimeout(OPENROUTER_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, model }),
    }, timeoutMs);
    if (!res.ok) {
      if (res.status === 429) onRateLimit?.();
      const errText = await res.text();
      console.error(`[${tag}] ${model} ${res.status}: ${errText.slice(0, 120)}`);
      throw new Error(`${model} failed: ${res.status}`);
    }
    console.log(`[${tag}] ✓ ${model} (race winner)`);
    return res;
  });

  try {
    return await Promise.any(racers);
  } catch {
    console.log(`[${tag}] Race failed, falling back...`);
    throw new Error("race_failed");
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN DISPATCHER — Race → Sequential → Extra → Free router
// ═══════════════════════════════════════════════════════════════════

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
  const headers = { ...HEADERS_BASE, Authorization: `Bearer ${apiKey}` };
  const baseBody = { messages, max_tokens: maxTokens, temperature, ...extraOpts };
  const isStreaming = extraOpts.stream === true;
  const totalBudget = Math.min(
    timeoutMs,
    tag.includes("ocr") ? OCR_TOTAL_BUDGET_MS : isStreaming ? STREAM_TOTAL_BUDGET_MS : TEXT_TOTAL_BUDGET_MS,
  );
  const deadline = Date.now() + totalBudget;
  const remainingBudget = () => deadline - Date.now();
  const nextPhaseTimeout = (preferredMs: number) => {
    const remaining = remainingBudget();
    if (remaining <= 1_200) return 0;
    return Math.min(preferredMs, remaining);
  };
  const raceTimeout = nextPhaseTimeout(tag.includes("ocr") ? 12_000 : isStreaming ? 4_500 : 8_000);
  const sequentialTimeout = () => nextPhaseTimeout(tag.includes("ocr") ? 9_000 : isStreaming ? 3_500 : 6_000);
  const fallbackTimeout = nextPhaseTimeout(tag.includes("ocr") ? 7_000 : isStreaming ? 4_000 : 5_000);
  let sawRateLimit = false;

  // PHASE 1: Parallel race (top 3 max)
  if (models.length >= 2 && raceTimeout > 0) {
    try {
      return await raceModels(models, baseBody, raceTimeout, tag, () => { sawRateLimit = true; });
    } catch { /* continue */ }
  }

  // PHASE 2: Sequential fallback (remaining from primary tier)
  const remaining = models.length >= PARALLEL_RACE_COUNT ? models.slice(PARALLEL_RACE_COUNT) : models;
  for (const model of remaining) {
    const phaseTimeout = sequentialTimeout();
    if (phaseTimeout <= 0) break;
    try {
      const res = await fetchWithTimeout(OPENROUTER_URL, {
        method: "POST", headers,
        body: JSON.stringify({ ...baseBody, model }),
      }, phaseTimeout);
      if (!res.ok) {
        if (res.status === 429) sawRateLimit = true;
        const e = await res.text();
        console.error(`[${tag}] ${model} ${res.status}: ${e.slice(0, 120)}`);
        continue;
      }
      console.log(`[${tag}] ✓ ${model}`);
      return res;
    } catch (e) {
      const isTimeout = e instanceof DOMException && e.name === "AbortError";
      console.error(`[${tag}] ${model} ${isTimeout ? "TIMEOUT" : "err"}`);
    }
  }

  // PHASE 3: Extra fallback pool
  for (const model of MODELS_EXTRA) {
    const phaseTimeout = sequentialTimeout();
    if (phaseTimeout <= 0) break;
    try {
      const res = await fetchWithTimeout(OPENROUTER_URL, {
        method: "POST", headers,
        body: JSON.stringify({ ...baseBody, model }),
      }, phaseTimeout);
      if (!res.ok) {
        if (res.status === 429) sawRateLimit = true;
        continue;
      }
      console.log(`[${tag}] ✓ ${model} (extra)`);
      return res;
    } catch { /* continue */ }
  }

  // PHASE 4: Free router as last resort
  const finalTimeout = fallbackTimeout;
  try {
    console.log(`[${tag}] → free router fallback`);
    const res = await fetchWithTimeout(OPENROUTER_URL, {
      method: "POST", headers,
      body: JSON.stringify({ ...baseBody, model: MODEL_FREE_ROUTER }),
    }, finalTimeout > 0 ? finalTimeout : 2_500);
    if (res.ok) {
      console.log(`[${tag}] ✓ free-router`);
      return res;
    }
    if (res.status === 429) sawRateLimit = true;
    const errText = await res.text();
    console.error(`[${tag}] free-router ${res.status}: ${errText.slice(0, 120)}`);
  } catch (e) {
    console.error(`[${tag}] free-router failed:`, e);
  }

  throw new Error(sawRateLimit
    ? "Free AI models are busy right now — please retry in a few seconds"
    : "AI is temporarily busy — please try again in a moment");
}

// ═══════════════════════════════════════════════════════════════════
// HIGH-LEVEL HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Non-streaming text completion */
export async function callAIText(
  messages: any[], models: string[], maxTokens: number,
  temperature: number, timeoutMs: number, tag: string,
): Promise<string> {
  const res = await callWithFallback(messages, models, maxTokens, temperature, timeoutMs, tag);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  return content;
}

/** Streaming SSE response */
export async function streamAI(
  messages: any[], models: string[], maxTokens: number,
  temperature: number, timeoutMs: number, tag: string,
): Promise<Response> {
  return callWithFallback(messages, models, maxTokens, temperature, timeoutMs, tag, { stream: true });
}

// ═══════════════════════════════════════════════════════════════════
// INTENT CLASSIFIER — For adaptive tutor behavior
// ═══════════════════════════════════════════════════════════════════

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
      return MODELS_QUALITY;
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
