// ═══════════════════════════════════════════════════════════════════
// Lumina AI — OpenRouter FREE Model Router
// Fast-first routing · proper key rotation · resilient fallbacks
// ═══════════════════════════════════════════════════════════════════

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ═══════════════════════════════════════════════════════════════════
// MODEL ROSTER — verified live OpenRouter :free endpoints (2026-06).
// Categorized per launch-day routing spec:
//
//   High-Reasoning & Frontier    → MODELS_QUALITY
//   Software Engineering & Code  → MODELS_CODE
//   Multimodal, Vision & Video   → MODELS_VISION
//   Generalists & Efficiency     → MODELS_BALANCED / MODELS_FAST
//   The Automator                → openrouter/free
// ═══════════════════════════════════════════════════════════════════

export const OWL = "meta-llama/llama-3.3-70b-instruct:free";
// NOTE: openrouter/owl-alpha returns 404 "No endpoints found" as of June 2026.
// Switch back when OpenRouter resolves the routing:
// export const OWL = "openrouter/owl-alpha";

// FAST — Generalists & Efficiency (low-latency)
export const MODELS_FAST = [
  OWL,
  "liquid/lfm-2.5-1.2b-instruct:free",
  "liquid/lfm-2.5-1.2b-thinking:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "openai/gpt-oss-20b:free",
  "poolside/laguna-xs.2:free",
  "cohere/north-mini-code:free",
];

// BALANCED — Generalists & Efficiency for daily tasks
export const MODELS_BALANCED = [
  OWL,
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "google/gemma-4-31b-instruct:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "openai/gpt-oss-20b:free",
];

// QUALITY — High-Reasoning & Frontier Models
export const MODELS_QUALITY = [
  OWL,
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
];

// ── CODING — Software Engineering Specialists ──────────────────────
export const MODELS_CODE = [
  OWL,
  "qwen/qwen3-coder:free",
  "poolside/laguna-m.1:free",
  "poolside/laguna-xs.2:free",
  "cohere/north-mini-code:free",
  "openai/gpt-oss-120b:free",
  "openai/gpt-oss-20b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

// ── LONG CONTEXT — deep research, reports, artifacts ──────────────
export const MODELS_LONG_CTX = [
  OWL,                                                    // 1M+ ctx
  "qwen/qwen3-coder:free",
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "google/gemma-4-31b-instruct:free",
  "google/gemma-4-26b-a4b-it:free",
];

// ── VISION — Multimodal, Vision & Video Specialists ───────────────
export const MODELS_VISION = [
  OWL,
  "google/gemma-4-31b-instruct:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
];

// ── WRITING / NOTES (long-form prose) ──────────────────────────────
export const MODELS_WRITING = [
  OWL,
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-120b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "google/gemma-4-31b-instruct:free",
];

// ── SAFETY — content moderation / guardrail filtering ─────────────
export const MODELS_SAFETY = [
  "nvidia/nemotron-3.5-content-safety:free",
];

export const MODELS_EXTRA = [
  OWL,
  "openai/gpt-oss-20b:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "google/gemma-4-26b-a4b-it:free",
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
  Deno.env.get("OPENROUTER_KEY_6"),
  Deno.env.get("OPENROUTER_KEY_7"),
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
  if (ALL_KEYS.length === 0) throw new Error("OPENROUTER_API_KEY not configured — set it in your Supabase project env vars");
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

// ── Moonshot (Kimi) direct API ─────────────────────────────────────
// When KIMI_API_KEY is configured we call Moonshot directly for any
// `moonshotai/kimi*` model id — bypassing OpenRouter's :free rate caps and
// unlocking K2.6's full output budget (multi-file, 40k+ LOC generations).
const KIMI_API_KEY = Deno.env.get("KIMI_API_KEY") ?? "";
const KIMI_URL = Deno.env.get("KIMI_API_URL") ?? "https://api.moonshot.ai/v1/chat/completions";
const KIMI_MODEL_DEFAULT = Deno.env.get("KIMI_MODEL_ID") ?? "kimi-k2.6";
function mapToMoonshotModel(orId: string): string {
  // Strip provider prefix + ":free" suffix; keep Kimi K2.6 on the real K2.6 id.
  const tail = orId.replace(/^moonshotai\//, "").replace(/:free$/, "").toLowerCase();
  if (/k2\.?6|k2-?thinking/.test(tail)) return KIMI_MODEL_DEFAULT;
  if (/k2\.?5/.test(tail))              return "kimi-k2-0905-preview";
  if (/k2\b|k2-base/.test(tail))        return "kimi-k2-0711-preview";
  return KIMI_MODEL_DEFAULT;
}
async function callKimiDirect(
  orModel: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  tag: string,
): Promise<Response | null> {
  if (!KIMI_API_KEY) return null;
  const moonshotModel = mapToMoonshotModel(orModel);
  try {
    const res = await fetchWithTimeout(
      KIMI_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${KIMI_API_KEY}`,
        },
        body: JSON.stringify({ ...body, model: moonshotModel }),
      },
      timeoutMs,
    );
    if (res.ok) {
      console.log(`[${tag}] ✓ kimi-direct ${moonshotModel}`);
      return res;
    }
    const err = await readErrorText(res);
    console.warn(`[${tag}] kimi-direct ${moonshotModel} -> ${res.status} ${err}`);
    try { await res.body?.cancel(); } catch { /* ignore */ }
    return null;
  } catch (e) {
    console.warn(`[${tag}] kimi-direct ${moonshotModel} network/timeout`, e);
    return null;
  }
}

const PARALLEL_RACE_COUNT = 4;          // race more models for snappier first-token
const OWL_KEY_FANOUT = 3;               // fire OWL on this many keys in parallel — first responder wins
// Long, generous budgets — we don't cap output length, so the wall-clock has to be big enough
// for full games / long files to finish streaming through the gateway.
const STREAM_TOTAL_BUDGET_MS = 150_000; // practical edge-safe streaming budget
const TEXT_TOTAL_BUDGET_MS = 90_000;    // keep JSON tools responsive
const OCR_TOTAL_BUDGET_MS = 120_000;
const PRIMARY_RACE_TIMEOUT_MS = 9_000;  // give primary model TTFB headroom; tiny models still win earlier

// Models confirmed dead by 404 — skipped entirely for this process lifetime.
const _deadModels = new Set<string>();

type RouteMeta = {
  model: string;
  mode: string;
};

function sanitizeMessages(messages: any[]) {
  return messages.map((message) => {
    const role = message?.role === "assistant" || message?.role === "system" ? message.role : "user";
    const content = Array.isArray(message?.content)
      ? message.content
          .map((part: any) => {
            if (part?.type === "image_url" && part?.image_url?.url) {
              return { type: "image_url", image_url: { url: String(part.image_url.url) } };
            }
            if (part?.type === "text") return { type: "text", text: String(part.text ?? "") };
            return { type: "text", text: String(part?.text ?? "") };
          })
          .filter((part: any) => part.type !== "text" || part.text.trim())
      : typeof message?.content === "string" ? message.content : String(message?.content ?? "");
    return { role, content };
  });
}

export function messageText(message: any): string {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => part?.type === "text" ? String(part.text ?? "") : "[attached image]").join("\n");
  return String(content ?? "");
}

export function messagesHaveImages(messages: any[]): boolean {
  return messages.some((m) => Array.isArray(m?.content) && m.content.some((p: any) => p?.type === "image_url" && p?.image_url?.url));
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
  if (_deadModels.has(model)) return null;
  if (ALL_KEYS.length === 0) {
    console.warn(`[${tag}] no API keys — skipping ${model}`);
    return null;
  }
  // Prefer Moonshot direct API when the caller asked for a kimi model.
  if (KIMI_API_KEY && /^moonshotai\//.test(model)) {
    const direct = await callKimiDirect(model, body, timeoutMs, tag);
    if (direct) return direct;
    // fall through to OpenRouter on failure
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

// Fire the SAME model on N different keys in parallel — first responder wins.
// Racing keys cuts effective latency dramatically for high-TTFB models.
async function callModelKeyFanout(
  model: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  tag: string,
  fanout: number,
): Promise<Response | null> {
  if (_deadModels.has(model)) return null;
  if (KIMI_API_KEY && /^moonshotai\//.test(model)) {
    return callModel(model, body, timeoutMs, tag);
  }
  const healthyKeys: number[] = [];
  for (let i = 0; i < ALL_KEYS.length; i++) {
    if (_isHealthy(i, model)) healthyKeys.push(i);
  }
  const picks = (healthyKeys.length > 0 ? healthyKeys : ALL_KEYS.map((_, i) => i)).slice(0, Math.max(1, Math.min(fanout, ALL_KEYS.length)));
  if (picks.length <= 1) return callModel(model, body, timeoutMs, tag);

  const controllers: AbortController[] = [];
  const attempts = picks.map((keyIdx) => {
    const ctrl = new AbortController();
    controllers.push(ctrl);
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    return (async () => {
      try {
        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: { ...HEADERS_BASE, Authorization: `Bearer ${ALL_KEYS[keyIdx]}` },
          body: JSON.stringify({ ...body, model }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          console.log(`[${tag}] ✓ ${model} (key ${keyIdx + 1}) [fanout]`);
          return { res, keyIdx };
        }
        if (res.status === 429) markKeyModelCooled(keyIdx, model, KEY_MODEL_COOLDOWN_MS, "429");
        else if (res.status === 401 || res.status === 403) markKeyCooled(keyIdx, KEY_BAD_COOLDOWN_MS, `${res.status}`);
        else if (res.status === 404) { _deadModels.add(model); }
        try { await res.body?.cancel(); } catch { /* ignore */ }
        throw new Error(`${model} key ${keyIdx + 1} -> ${res.status}`);
      } catch (e) {
        clearTimeout(timer);
        throw e;
      }
    })();
  });

  try {
    const { res, keyIdx } = await Promise.any(attempts);
    // Abort losing in-flight requests to free server/network resources.
    for (let i = 0; i < controllers.length; i++) {
      if (picks[i] !== keyIdx) {
        try { controllers[i].abort(); } catch { /* ignore */ }
      }
    }
    return res;
  } catch {
    return null;
  }
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
    const res = model === OWL
      ? await callModelKeyFanout(model, body, timeoutMs, tag, OWL_KEY_FANOUT)
      : await callModel(model, body, timeoutMs, tag);
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
  const isComputer = /computer|mun|lumina/i.test(tag);
  const isArtifact = /artifact|html|generate-html|slides|code/i.test(tag) || isComputer;

  // ── STRATEGY: PRIMARY MODEL + FREE ROUTER FALLBACK ──
  // Primary uses key-fanout for low latency. Falls back to openrouter/free.
  // This guarantees <4s TTFB for 95%+ of requests.

  // Primary with 3-key fanout. For artifacts, use longer timeout.
  // Artifact generation needs 60-90s; chat needs <8s. Scale by tag type.
  const isArtifactCall = /artifact|html-artifact|generate-html/i.test(tag);
  const primaryRawMs = isArtifactCall ? Math.min(120_000, timeoutMs) : Math.min(8_000, timeoutMs);
  const primaryTimeout = primaryRawMs;
  if (primaryTimeout > 1000) {
    try {
      const res = await callModelKeyFanout(OWL, baseBody, primaryTimeout, tag, OWL_KEY_FANOUT);
      if (res) return { response: res, model: OWL };
    } catch {
      console.warn(`[${tag}] OWL-alpha failed, trying free router`);
    }
  }

  // Fallback: openrouter/free. For artifacts, use longer timeout.
  const fallbackRawMs = isArtifactCall ? Math.min(90_000, timeoutMs) : Math.min(6_000, timeoutMs);
  const fallbackTimeout = fallbackRawMs;
  if (fallbackTimeout > 1000) {
    try {
      const res = await callModel(MODEL_FREE_ROUTER, baseBody, fallbackTimeout, `${tag}/free`);
      if (res) return { response: res, model: MODEL_FREE_ROUTER };
    } catch {
      console.warn(`[${tag}] free router also failed`);
    }
  }

  // Last resort: try the original model list sequentially
  // For artifacts, use longer timeout; for chat, keep it short
  if (isArtifact || !isStreaming) {
    const shortTimeout = isArtifactCall ? Math.min(120_000, timeoutMs) : Math.min(15_000, timeoutMs);
    for (const model of models) {
      if (_deadModels.has(model)) continue;
      try {
        const res = model === OWL
          ? await callModelKeyFanout(model, baseBody, shortTimeout, tag, 1)
          : await callModel(model, baseBody, shortTimeout, tag);
        if (res) return { response: res, model };
      } catch { continue; }
    }
  }

  const helpMsg = ALL_KEYS.length === 0
    ? "OPENROUTER_API_KEY not configured — set it in your Supabase project env vars or .env file"
    : "Lumina is experiencing high demand. Please try again in a moment.";
  throw new Error(helpMsg);
}

// ── Auto-continuation config ───────────────────────────────────────
// When a model stops because it hit its output cap (finish_reason = "length"),
// transparently fire a follow-up "continue" request and stitch the result.
// This gives every caller "infinite generation" without changing their code.
const CONTINUATION_MAX_ROUNDS = 14;       // up to 15 total chunks per response — long Computer/code outputs
const CONTINUATION_USER_PROMPT =
  "Continue exactly where you left off. Do not repeat anything. Do not summarize. Resume in the middle of the sentence/code/JSON if needed.";

export async function callAIText(
  messages: any[],
  models: string[],
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
  tag: string,
): Promise<string> {
  const { response, model } = await callWithFallback(messages, models, maxTokens, temperature, timeoutMs, tag);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  let finish = data?.choices?.[0]?.finish_reason;
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    throw new Error(`[callAIText:${tag}] empty response from ${model}`);
  }

  let full = content;
  let rounds = 0;
  while (finish === "length" && rounds < CONTINUATION_MAX_ROUNDS) {
    rounds++;
    const contMessages = [
      ...messages,
      { role: "assistant", content: full },
      { role: "user", content: CONTINUATION_USER_PROMPT },
    ];
    try {
      const { response: r2 } = await callWithFallback(
        contMessages,
        [model, ...models.filter((m) => m !== model)],
        maxTokens, temperature, timeoutMs, `${tag}/cont${rounds}`,
      );
      const d2 = await r2.json();
      const chunk = d2?.choices?.[0]?.message?.content;
      finish = d2?.choices?.[0]?.finish_reason;
      if (!chunk || typeof chunk !== "string" || !chunk.trim()) break;
      full += chunk;
      console.log(`[callAIText:${tag}] continued +${chunk.length} chars (round ${rounds})`);
    } catch (e) {
      console.warn(`[callAIText:${tag}] continuation ${rounds} failed:`, e);
      break;
    }
  }
  return full;
}

function parseSSEChunk(line: string): { delta?: string; finish?: string | null; usage?: any } {
  if (!line.startsWith("data:")) return {};
  const payload = line.slice(5).trim();
  if (!payload || payload === "[DONE]") return {};
  try {
    const j = JSON.parse(payload);
    const choice = j?.choices?.[0];
    return {
      delta: choice?.delta?.content ?? "",
      finish: choice?.finish_reason ?? null,
      usage: j?.usage,
    };
  } catch {
    return {};
  }
}

export async function streamAI(
  messages: any[],
  models: string[],
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
  tag: string,
): Promise<Response> {
  const { response: first, model: firstModel } = await callWithFallback(
    messages, models, maxTokens, temperature, timeoutMs, tag, { stream: true },
  );

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const merged = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sendMeta = (m: RouteMeta) =>
        controller.enqueue(encoder.encode(encodeSseData({ lumina_meta: m })));

      sendMeta({ model: firstModel, mode: tag.split("/")[1] ?? tag });

      let assistantSoFar = "";
      let totalTokens = 0;
      let rounds = 0;
      let currentModel = firstModel;
      let currentResponse: Response | null = first;

      const consumeOne = async (resp: Response): Promise<{ finish: string | null; usage: any }> => {
        if (!resp.body) return { finish: null, usage: null };
        const reader = resp.body.getReader();
        let buf = "";
        let finish: string | null = null;
        let usage: any = null;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const raw of lines) {
              const line = raw.trim();
              if (!line) continue;
              if (line === "data: [DONE]") continue; // swallow upstream DONE
              const parsed = parseSSEChunk(line);
              if (parsed.usage) usage = parsed.usage;
              if (parsed.finish) finish = parsed.finish;
              if (parsed.delta) {
                assistantSoFar += parsed.delta;
                controller.enqueue(encoder.encode(line + "\n\n"));
              } else if (!parsed.finish && !parsed.usage) {
                controller.enqueue(encoder.encode(line + "\n\n"));
              }
            }
          }
        } catch (e) {
          console.warn(`[streamAI:${tag}] read error:`, e);
        } finally {
          try { reader.releaseLock(); } catch { /* ignore */ }
        }
        return { finish, usage };
      };

      try {
        let { finish, usage } = await consumeOne(currentResponse);
        if (usage?.total_tokens) totalTokens += usage.total_tokens;

        while (finish === "length" && rounds < CONTINUATION_MAX_ROUNDS) {
          rounds++;
          console.log(`[streamAI:${tag}] auto-continue round ${rounds}`);
          const contMessages = [
            ...messages,
            { role: "assistant", content: assistantSoFar },
            { role: "user", content: CONTINUATION_USER_PROMPT },
          ];
          try {
            const { response: next, model: nextModel } = await callWithFallback(
              contMessages,
              [currentModel, ...models.filter((m) => m !== currentModel)],
              maxTokens, temperature, timeoutMs, `${tag}/cont${rounds}`,
              { stream: true },
            );
            if (nextModel !== currentModel) {
              sendMeta({ model: nextModel, mode: `${tag.split("/")[1] ?? tag}/cont` });
            }
            currentModel = nextModel;
            const r = await consumeOne(next);
            finish = r.finish;
            if (r.usage?.total_tokens) totalTokens += r.usage.total_tokens;
          } catch (e) {
            console.warn(`[streamAI:${tag}] continuation ${rounds} failed:`, e);
            break;
          }
        }

        // Final usage meta — clients can render "[n] tokens · model".
        controller.enqueue(encoder.encode(encodeSseData({
          lumina_usage: { total_tokens: totalTokens, model: currentModel, continuations: rounds },
        })));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(merged, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
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
- **NEVER hallucinate APIs, libraries, or functions that don't exist.** If you're unsure about a library's API, use a well-known alternative or check the documentation. When in doubt, use standard Web APIs (fetch, DOM, Canvas) that you know work.
- **NEVER reference files, paths, or resources that don't exist in the user's environment.** Only use CDN links from the approved list (cdnjs.cloudflare.com, cdn.jsdelivr.net, fonts.googleapis.com, fonts.gstatic.com).
- **If you don't know the exact API signature, use a simpler approach you're confident in** rather than guessing a complex one.

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

## ANTI-HALLUCINATION PROTOCOL — STRICT:
- NEVER fabricate facts, dates, names, statistics, or scientific claims. If you are not 100% certain, say so: "I'm not entirely sure about this — let me verify" or "Based on my knowledge, ... but you should double-check."
- NEVER invent citations, URLs, or source references. Only cite sources you actually know exist.
- NEVER present speculation as fact. Distinguish clearly between "this is established fact" and "this is one perspective/theory."
- For numerical calculations: show your work step by step. Verify each step. If you make a mistake, correct it immediately.
- For science/medicine/law: always add appropriate disclaimers. You are a tutor, not a doctor/lawyer.
- If asked about something you don't know: say "I don't have reliable information on this specific topic" — do NOT guess or make up an answer.
- When citing specific data (population, dates, statistics), add "(verify)" if you're not certain.
- NEVER write "According to [Source]" unless you can name the actual source. If you can't, say "From what I recall..." or "Based on general knowledge..."

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
  // OWL is the primary model for every artifact type (per user direction).
  // Each chain is ordered: OWL first → quality fallbacks → global fallback fills rest.
  switch (type) {
    case "html":
      return [OWL, "qwen/qwen3-coder:free", "poolside/laguna-m.1:free", "openai/gpt-oss-120b:free", ...MODELS_CODE];
    case "react":
      return [OWL, "qwen/qwen3-coder:free", "poolside/laguna-m.1:free", "openai/gpt-oss-20b:free", ...MODELS_CODE];
    case "python":
      return [OWL, "qwen/qwen3-coder:free", "poolside/laguna-m.1:free", "nvidia/nemotron-3-super-120b-a12b:free", ...MODELS_CODE];
    case "javascript":
      return [OWL, "poolside/laguna-xs.2:free", "qwen/qwen3-coder:free", "cohere/north-mini-code:free", ...MODELS_CODE];
    case "code":
      return [OWL, "openai/gpt-oss-120b:free", "openai/gpt-oss-20b:free", "qwen/qwen3-coder:free", ...MODELS_CODE];
    case "svg":
      return [OWL, "qwen/qwen3-coder:free", "google/gemma-4-31b-instruct:free", "poolside/laguna-xs.2:free", ...MODELS_CODE];
    case "mermaid":
      return [OWL, "openai/gpt-oss-120b:free", "qwen/qwen3-next-80b-a3b-instruct:free", "nvidia/nemotron-3-super-120b-a12b:free"];
    case "slides":
      return [OWL, "nvidia/nemotron-3-super-120b-a12b:free", "openai/gpt-oss-120b:free", "meta-llama/llama-3.3-70b-instruct:free", ...MODELS_WRITING];
    case "notes":
      return [OWL, "nvidia/nemotron-3-super-120b-a12b:free", "nousresearch/hermes-3-llama-3.1-405b:free", "meta-llama/llama-3.3-70b-instruct:free", ...MODELS_WRITING];
    case "flashcards":
      return [OWL, "openai/gpt-oss-20b:free", "meta-llama/llama-3.3-70b-instruct:free", "google/gemma-4-31b-instruct:free", ...MODELS_BALANCED];
    case "math":
      return [OWL, "qwen/qwen3-next-80b-a3b-instruct:free", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "liquid/lfm-2.5-1.2b-thinking:free", ...MODELS_QUALITY];
    case "exam":
      return [OWL, "nvidia/nemotron-3-super-120b-a12b:free", "openai/gpt-oss-120b:free", "qwen/qwen3-next-80b-a3b-instruct:free", ...MODELS_QUALITY];
    case "general":
    default:
      return [OWL, MODEL_FREE_ROUTER, "nvidia/nemotron-3-super-120b-a12b:free", "openai/gpt-oss-120b:free", ...MODELS_BALANCED];
  }
}