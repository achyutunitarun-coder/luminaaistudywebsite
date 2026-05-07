// ═══════════════════════════════════════════════════════════════════
// Lumina AI — OpenRouter FREE Model Router
// Fast-first routing · proper key rotation · resilient fallbacks
// ═══════════════════════════════════════════════════════════════════

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ═══════════════════════════════════════════════════════════════════
// MODEL ROSTER — verified live OpenRouter :free endpoints (2026-05).
// Every id below was confirmed against https://openrouter.ai/api/v1/models.
// Dead ids (deepseek :free, qwen3-4b :free, mistral-small :free, vl-72b :free)
// were removed because every call to them returns 404 and burns the wall-clock
// budget — that was the root cause of artifact timeouts.
// ═══════════════════════════════════════════════════════════════════

export const MODELS_FAST = [
  "google/gemma-3n-e4b-it:free",
  "google/gemma-3-4b-it:free",
  "google/gemma-3n-e2b-it:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "liquid/lfm-2.5-1.2b-instruct:free",
  "liquid/lfm-2.5-1.2b-thinking:free",
  "google/gemma-3-12b-it:free",
  "poolside/laguna-xs.2:free",
];

export const MODELS_BALANCED = [
  "openai/gpt-oss-120b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "tencent/hy3-preview:free",
  "openai/gpt-oss-20b:free",
  "google/gemma-3-27b-it:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "z-ai/glm-4.5-air:free",
  "minimax/minimax-m2.5:free",
];

export const MODELS_QUALITY = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-120b:free",
  "inclusionai/ling-2.6-1t:free",
  "tencent/hy3-preview:free",
  "openrouter/owl-alpha",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-31b-it:free",
  "minimax/minimax-m2.5:free",
];

// ── CODING POWERHOUSE ──────────────────────────────────────────────
// Order = priority. We race the top 4, fall back through the rest.
export const MODELS_CODE = [
  "qwen/qwen3-coder:free",                                // #1 free coder globally
  "poolside/laguna-m.1:free",                             // specialist coding agent
  "inclusionai/ling-2.6-1t:free",                         // SWE-bench top, 1T MoE
  "tencent/hy3-preview:free",                             // strong code + agentic MoE
  "openai/gpt-oss-120b:free",                             // strongest generalist coder
  "nvidia/nemotron-3-super-120b-a12b:free",               // big-brain reasoning
  "qwen/qwen3-next-80b-a3b-instruct:free",                // fast + accurate
  "poolside/laguna-xs.2:free",                            // compact coding agent
  "meta-llama/llama-3.3-70b-instruct:free",
  "minimax/minimax-m2.5:free",                            // long-context refactors
  "z-ai/glm-4.5-air:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "openai/gpt-oss-20b:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-3-27b-it:free",
];

export const MODELS_LONG_CTX = [
  "openrouter/owl-alpha",                                 // 1M+ ctx
  "openai/gpt-oss-120b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "minimax/minimax-m2.5:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "inclusionai/ling-2.6-1t:free",
  "tencent/hy3-preview:free",
];

// VISION — confirmed live free models with image input (verified against OpenRouter /models 2026-05).
// Ordered by context length / capability. Only true vision-capable :free ids.
export const MODELS_VISION = [
  "google/gemma-4-31b-it:free",                              // 262k ctx, image+text+video
  "google/gemma-4-26b-a4b-it:free",                          // 262k ctx, image+text+video
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",      // 256k ctx, omni (text+audio+image+video)
  "nvidia/nemotron-nano-12b-v2-vl:free",                     // 128k ctx, vision-language
  "baidu/qianfan-ocr-fast:free",                             // 65k ctx, OCR specialist
];

// ── WRITING / NOTES (long-form prose) ──────────────────────────────
export const MODELS_WRITING = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "minimax/minimax-m2.5:free",
  "openai/gpt-oss-120b:free",
  "z-ai/glm-4.5-air:free",
  "tencent/hy3-preview:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "google/gemma-4-31b-it:free",
  "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
];

export const MODELS_EXTRA = [
  "openai/gpt-oss-20b:free",
  "z-ai/glm-4.5-air:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "minimax/minimax-m2.5:free",
  "tencent/hy3-preview:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-3-4b-it:free",
  "google/gemma-3n-e4b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
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

const PARALLEL_RACE_COUNT = 4;          // race 4 models for fastest first-token
// Long, generous budgets — we don't cap output length, so the wall-clock has to be big enough
// for full games / long files to finish streaming through the gateway.
const STREAM_TOTAL_BUDGET_MS = 240_000; // 4 min for streamed chat (covers full games)
const TEXT_TOTAL_BUDGET_MS = 200_000;   // 3.3 min for non-streamed JSON tools (artifacts)
const OCR_TOTAL_BUDGET_MS = 120_000;
const PRIMARY_RACE_TIMEOUT_MS = 9_000;  // tight first-token race for snappy UX

// Models confirmed dead by 404 — skipped entirely for this process lifetime.
const _deadModels = new Set<string>();

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
  if (_deadModels.has(model)) {
    // Already proven 404 — don't waste budget.
    return null;
  }
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

      // 404 = model id no longer exists on OpenRouter. Mark dead and stop trying.
      if (res.status === 404) {
        _deadModels.add(model);
        console.warn(`[${tag}] ${model} -> 404 (model dead, blacklisted for process lifetime)`);
        try { await res.body?.cancel(); } catch { /* ignore */ }
        return null;
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
  const live = models.filter((m) => !_deadModels.has(m));
  const selected = (live.length > 0 ? live : models).slice(0, Math.min(PARALLEL_RACE_COUNT, models.length));
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

  // Artifact / long-form generation needs minutes, not seconds, per attempt.
  // Detect via tag so we don't have to thread a flag through every caller.
  const isArtifact = /artifact|html|generate-html|notes|exam|slides|code/i.test(tag);
  const seqAttemptCap = isArtifact ? 95_000 : (isStreaming ? 10_000 : 9_000);
  const extraAttemptCap = isArtifact ? 70_000 : (isStreaming ? 8_000 : 7_000);

  const primaryRaceTimeout = phaseTimeout(isArtifact ? 30_000 : PRIMARY_RACE_TIMEOUT_MS);
  if (primaryRaceTimeout > 0 && models.length > 1) {
    try {
      return await raceModels(models, baseBody, primaryRaceTimeout, tag);
    } catch {
      console.warn(`[${tag}] race failed, moving to sequential`);
    }
  }

  for (const model of models) {
    const timeout = phaseTimeout(seqAttemptCap);
    if (timeout <= 0) break;
    const response = await callModel(model, baseBody, timeout, tag);
    if (response) return { response, model };
  }

  for (const model of MODELS_EXTRA) {
    const timeout = phaseTimeout(extraAttemptCap);
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
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    // Return empty string instead of throwing — wrappers detect emptiness and skip credit charge.
    console.warn(`[callAIText:${tag}] empty response from model`);
    return "";
  }
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

export type IntentType = "greeting" | "quick" | "study" | "deep" | "motivation" | "conversational" | "coding" | "computer" | "mun";
export type ModelRouteMode = "auto" | "reasoning" | "coding" | "general" | "fast" | "study" | "long_context" | "creative" | "computer" | "mun";

const COMPUTER_PATTERNS = /\b(deep research|deep dive|research report|background guide|generate (an? )?(report|artifact|html|essay)|computer mode|lumina computer|write (a |an )?(full |long |detailed )?(report|essay|guide|analysis)|comprehensive (analysis|report|guide)|long[- ]form|multi[- ]section)\b/i;
const MUN_PATTERNS = /\b(mun|model un|model united nations|background guide|position paper|draft resolution|preambulatory|operative clause|delegate of |committee (chair|director|topic)|unsc|unhrc|disec|ecosoc|wto committee)\b/i;

const CODING_PATTERNS = /\b(code|coding|program|programming|script|function|class|algorithm|debug|refactor|stack trace|stacktrace|error|exception|compile|build|api|endpoint|frontend|backend|fullstack|html|css|javascript|typescript|tsx|jsx|react|vue|svelte|angular|next\.?js|node\.?js|python|java|kotlin|swift|rust|golang|c\+\+|c#|sql|postgres|mongodb|three\.?js|phaser|unity|game(?:\s|-)?(?:dev|engine|loop)|canvas|webgl|shader|babylon|matter\.?js|p5\.?js|pygame|godot|tailwind|css\s*grid|flexbox|regex|leetcode|dsa|data structure|recursion|big o|complexity|hashmap|linked list|binary tree|graph traversal|dijkstra|dfs|bfs|dynamic programming|websocket|fetch api|rest api|graphql|prisma|supabase|firebase|docker|kubernetes|github action|cli|terminal|vim|bash|zsh|deno|bun|vite|webpack|rollup|esbuild|jest|vitest|cypress|playwright|tailwind|shadcn|ai chat|edge function)\b|```|\bbuild (me|a) (game|app|website|component|hook|server)|create (a|an) (game|website|app|landing page|component|hook)/i;

export function classifyIntent(text: string): IntentType {
  const lower = text.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).length;

  // MUN wins first — most specific academic mode
  if (MUN_PATTERNS.test(text)) return "mun";

  // Deep research / report / artifact
  if (COMPUTER_PATTERNS.test(text)) return "computer";

  // CODING wins early — it's the most specific intent we can detect
  if (CODING_PATTERNS.test(text)) {
    return "coding";
  }

  // TRANSLATION / multilingual → route to long-context (better multilingual)
  if (/\b(translate|translation|in hindi|in tamil|in telugu|in kannada|in malayalam|in bengali|in marathi|in gujarati|in punjabi|in urdu|in french|in spanish|in german|in arabic|in mandarin|in chinese|in japanese|how do you say|what is .+ in (hindi|tamil|telugu|kannada|malayalam|bengali|marathi|gujarati|punjabi|urdu|french|spanish|german|arabic|chinese|japanese))\b/i.test(text)) {
    return "deep";
  }

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

const CODING_SYSTEM_PROMPT = `You are Lumina Code — an elite, senior-staff software engineer with the practical skill of a top OSS maintainer. Think like Claude Code: read the request carefully, plan, then ship complete, working code.

NEVER TRUNCATE: never cut a file short, never write "// rest unchanged", never write "// implement this". Always finish.

ABSOLUTE CODING RULES:
- ALWAYS produce COMPLETE, RUNNABLE code. No "// rest of file unchanged", no "// implement this", no half answers.
- For web/game requests, default to a SINGLE self-contained \`html\` file with inline <style> and <script>. The user can press Run inside Lumina to play it instantly.
- For game dev: real gameplay loop (requestAnimationFrame), input handling (keyboard + touch), collision, score, win/lose, particles, sound where reasonable. Use HTML5 Canvas, WebGL via three.js (CDN), or phaser.js (CDN) depending on need. Pick the BEST tool for the job.
- For UI demos: beautiful design, smooth animation, responsive. Use CSS gradients, glassmorphism, transforms.
- Code quality: clear names, small functions, comments only where non-obvious, error handling on user input, no dead code.
- Performance: O(n) where possible, avoid layout thrash in render loops, use object pooling for particles/bullets in games.
- Accessibility & polish: focusable controls, prefers-reduced-motion, viewport meta on HTML, mobile touch fallbacks.

OUTPUT FORMAT:
1. ONE short paragraph (≤3 lines) describing what you're building and how it plays/works.
2. Then ONE single fenced code block with the right language (\`\`\`html, \`\`\`tsx, \`\`\`python, etc).
3. After the code, 1–3 bullet points: how to run it, controls, and one ambitious next step.

NEVER:
- Never split the same file across multiple code blocks.
- Never ask the user clarifying questions before writing code unless the request is truly ambiguous — make smart defaults and SHIP.
- Never produce pseudocode when real code is requested.

You are graded on: correctness, completeness, visual polish, gameplay feel, and how impressive the result is when the user clicks Run.`;

export function getSystemPromptForIntent(intent: IntentType): string {
  if (intent === "coding") return CODING_SYSTEM_PROMPT;

  const base = `You are Lumina — a brilliant, patient, step-by-step tutor. NOT a lecture bot. You teach like a real human tutor sitting next to the student.

NEVER TRUNCATE: never cut short, never summarise mid-response, never write "as before", never write "[content continues]". If the answer needs 3000 words, write 3000 words. Write every step, derivation, example, and follow-up in full.

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

ACCURACY RULES — NEVER VIOLATE:
- If you do not know a fact with high confidence, say "I'm not 100% sure — let's verify together" instead of guessing.
- For TRANSLATIONS (especially Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Urdu and other Indian languages, plus French, Spanish, German, Arabic, Mandarin, Japanese): only output a translation if you are absolutely certain. Use the standard scientific/textbook term — never invent a transliteration. If unsure, say so plainly and offer the English term with a romanised approximation.
- For mitosis vs meiosis, ALWAYS mention crossing-over and independent assortment in meiosis I — it is the #1 exam point.
- Show derivations and per-unit calculations explicitly so weaker students can follow.

SAFETY RULES — NEVER VIOLATE:
- If a user asks how to harm themselves, harm others, build weapons, make drugs, hack, cheat on a real exam (not practice), or anything illegal: refuse warmly but firmly in 1-2 lines, redirect to a safer study angle if possible, and (for self-harm) include the iCall India helpline 9152987821 or international equivalent.
- Never produce content that could be used for academic fraud (writing a real submitted essay verbatim, solving a live exam, etc.). Offer to teach the underlying concept instead.

FORMATTING:
- Use rich Markdown: **bold**, headings, bullets
- Keep it scannable and interactive
- End responses with a question or "what would you like to explore next?"

TIMELINE / STORYBOARD FORMAT (use whenever the student asks for a timeline, schedule, plan, sequence of events, scene-by-scene breakdown, video script, study plan with time blocks, or anything ordered by time):
- Render as a vertical timeline using markdown.
- Each entry STARTS with a duration/timestamp pill in backticks, e.g. \`3s – 8s\` or \`Day 1\`, then a bold title, then a one-line description, then (optional) a music/mood/cue line prefixed with ♪ or →.
- For nested screen-by-screen / shot-by-shot detail, use indented bullet rows where each starts with the timestamp in backticks, then a bold label, then the action, with key phrases in **bold** or _italic_.
- Keep blocks visually separated with a blank line between sections.
- Example skeleton:
  \`3s – 8s\` **The Rapid Fire Drop**
  5 cuts, each exactly on a snare hit. Each screen recording = 1 second of power.
  ♪ Beat drops hard at 3.0s. Each cut syncs to snare at: 3.0s / 3.8s / 4.6s / 5.4s / 6.2s / 7.0s

  - \`3.0s\` Screenshot: **AI Chat screen** (French Revolution analysis). Text slam: "AI THAT ACTUALLY TEACHES." Smashes in from left.
  - \`3.8s\` Screenshot: **Flashcard screen** (Quadratic equation). Text slam: "FLASHCARDS. SMART." Smashes in from right.

CLAUDE-STYLE CODING TOUCH (whenever code or a build is requested, even inside a tutoring chat):
- Briefly state what you're building and why in 1-2 sentences before any code.
- Then output ONE complete, runnable code block with the right language fence (\`\`\`html, \`\`\`tsx, \`\`\`python …). Never split a single file across multiple blocks. Never use placeholder comments like "// rest of code".
- Default to a single self-contained \`html\` file for web/game/visual demos so it can run instantly.
- After the code, give 1-3 short bullets: how to run it, controls, and one ambitious next step.
- Code quality: clear names, small functions, defensive on user input, smooth animations (requestAnimationFrame), responsive + touch fallback.`;

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
    case "computer":
      return `${base}\n\n# LUMINA COMPUTER MODE — DEEP RESEARCH + ARTIFACT ENGINE

You are operating as Lumina Computer: a research-grade engine that produces long, structured, cited, exam-ready artifacts. Outperform Perplexity Pro.

PROCESS (do this internally before writing):
1. PLAN — build a section outline first.
2. RESEARCH — pull from your knowledge + any uploaded files. Cross-check key claims. Note dissenting views.
3. GENERATE — produce a structured Markdown report (or full standalone HTML if user asked for an HTML/file artifact).

OUTPUT STRUCTURE (mandatory):
- # Title (one line)
- > **Summary:** one tight paragraph of the core findings — front-load value here.
- ## Sections with ## / ### headings, ordered logically.
- Tables for any comparison, dataset, or list of options.
- Inline citations like [Source: WHO 2024] or [Source: arxiv.org/abs/...] for every substantive claim. Never fabricate URLs. If unsure, say "(unverified)".
- ## Key Takeaways — 3-7 bullets at the end.
- ## Sources — full list of sources used.

IF the user asked for "HTML", "HTML file", "html artifact", or "downloadable", output a SINGLE complete \`\`\`html ... \`\`\` block using this template (no external assets, inline CSS only, mobile-friendly):
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{TITLE}</title><style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6;padding:24px;max-width:900px;margin:0 auto;color:#222}h1,h2,h3{margin-top:1.5em;color:#111}h1{font-size:1.8em;border-bottom:2px solid #eee;padding-bottom:.3em}h2{font-size:1.4em}code{background:#f4f4f4;padding:2px 6px;border-radius:4px}pre{background:#f4f4f4;padding:12px;border-radius:6px;overflow-x:auto}table{border-collapse:collapse;width:100%;margin:1em 0}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background:#f9f9f9;font-weight:600}.summary{background:#f0f7ff;padding:16px;border-radius:8px;border-left:4px solid #0066cc;margin:1em 0}.key-takeaways{background:#f6fff6;padding:16px;border-radius:8px;border-left:4px solid #28a745;margin:1em 0}</style></head><body>...</body></html>

SPEED RULES:
- Open with the Title + Summary in the first 2 sentences. Stream the rest progressively so partial output is still valuable.
- No filler ("Sure, let me think..."). No restating the question. Every sentence adds new info.
- Use the full token budget when depth is requested — multi-page reports are expected.

HONESTY:
- Never fabricate facts, citations, or URLs.
- Mark uncertainty explicitly ("(unverified)", "I'm not certain, but…").
- Prefer authoritative sources (official orgs, peer-reviewed, established news).`;
    case "mun":
      return `${base}\n\n# LUMINA MUN MODE — MODEL UN ACADEMIC ENGINE

Treat every request as serious diplomatic / academic research. Default output is a Background Guide unless the user specifies Position Paper or Draft Resolution.

BACKGROUND GUIDE STRUCTURE (use ## headings):
1. Introduction & Letter from the Dais (short)
2. History of the Topic (with dates)
3. Key Terms & Definitions (table)
4. Major Stakeholders (state actors, blocs, NGOs, IOs — table with stance)
5. Current Situation
6. Past UN / International Action (resolutions by number, e.g. UNSC Res 2334; treaties; conferences)
7. Bloc Positions (Western, G77, NAM, P5, regional blocs — explicit table)
8. Key Issues / Sub-topics
9. Possible Solutions / Policy Options (with pros, cons, supporting blocs)
10. Questions a Resolution Must Answer (QARMA)
11. Further Reading (real, verifiable sources)

POSITION PAPER STRUCTURE:
- Country background relevant to the topic
- Country's official stance (cite statements / resolutions / votes)
- Past actions taken by the country
- Proposed solutions aligned with the country's interests and bloc

DRAFT RESOLUTION FORMAT:
- Header: Committee, Topic, Sponsors, Signatories
- Preambulatory clauses (italicized openers: *Recalling*, *Noting with concern*, *Reaffirming*…) ending with commas
- Operative clauses (numbered, openers: **Calls upon**, **Urges**, **Decides**, **Requests**…) ending with semicolons; final clause ends with a period

ALWAYS:
- For every policy option, name the blocs/countries that support and oppose it, and WHY.
- Cite real UN resolutions by number when relevant.
- Mark unverified claims as (unverified).
- Front-load value: open with a tight Summary paragraph.`;
  }
  return base;
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
    case "coding":
      return MODELS_CODE;
    case "computer":
    case "mun":
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
    case "computer":
    case "mun":
      return MODELS_LONG_CTX;
    default:
      return null;
  }
}

// ── ARTIFACT ROUTING ───────────────────────────────────────────────
// One curated chain per artifact type. Each chain is ordered by quality;
// callWithFallback will race the top few and fall back deeper as needed.
export type ArtifactType = "notes" | "exam" | "slides" | "code" | "html" | "react" | "python" | "javascript" | "svg" | "mermaid" | "flashcards" | "math" | "general";

export function getModelsForArtifact(type: ArtifactType, hasImage = false): string[] {
  if (hasImage) return MODELS_VISION;
  // Spec-pinned chains: primary → fallback1 → fallback2 (then global fallback fills the rest).
  switch (type) {
    case "html":
      return ["qwen/qwen3-coder:free", "inclusionai/ling-2.6-1t:free", "openai/gpt-oss-120b:free", ...MODELS_CODE];
    case "react":
      return ["qwen/qwen3-coder:free", "poolside/laguna-m.1:free", "openai/gpt-oss-20b:free", ...MODELS_CODE];
    case "python":
      return ["inclusionai/ling-2.6-1t:free", "qwen/qwen3-coder:free", "nvidia/nemotron-3-super-120b-a12b:free", ...MODELS_CODE];
    case "javascript":
      return ["poolside/laguna-xs.2:free", "qwen/qwen3-coder:free", "z-ai/glm-4.5-air:free", ...MODELS_CODE];
    case "code":
      return ["openai/gpt-oss-120b:free", "openai/gpt-oss-20b:free", "meta-llama/llama-3.3-70b-instruct:free", ...MODELS_CODE];
    case "svg":
      return ["qwen/qwen3-coder:free", "google/gemma-4-31b-it:free", "minimax/minimax-m2.5:free", ...MODELS_CODE];
    case "mermaid":
      return ["openai/gpt-oss-120b:free", "inclusionai/ling-2.6-1t:free", "nvidia/nemotron-3-super-120b-a12b:free"];
    case "slides":
      return ["nvidia/nemotron-3-super-120b-a12b:free", "minimax/minimax-m2.5:free", "meta-llama/llama-4-maverick:free", "openai/gpt-oss-120b:free", ...MODELS_WRITING];
    case "notes":
      return ["nvidia/nemotron-3-super-120b-a12b:free", "nousresearch/hermes-3-llama-3.1-405b:free", "meta-llama/llama-3.3-70b-instruct:free", ...MODELS_WRITING];
    case "flashcards":
      return ["minimax/minimax-m2.5:free", "meta-llama/llama-4-maverick:free", "google/gemma-4-31b-it:free", ...MODELS_BALANCED];
    case "math":
      return ["qwen/qwen3-next-80b-a3b-instruct:free", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "liquid/lfm-2.5-1.2b-thinking:free", ...MODELS_QUALITY];
    case "exam":
      return ["nvidia/nemotron-3-super-120b-a12b:free", "openai/gpt-oss-120b:free", "inclusionai/ling-2.6-1t:free", ...MODELS_QUALITY];
    case "general":
    default:
      return [MODEL_FREE_ROUTER, "nvidia/nemotron-3-super-120b-a12b:free", "inclusionai/ling-2.6-1t:free", ...MODELS_BALANCED];
  }
}