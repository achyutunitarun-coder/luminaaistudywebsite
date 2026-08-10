// ════════════════════════════════════════════════════════════════════
// Verified OpenRouter free-tier output caps (source: GET /api/v1/models,
// top_provider.max_completion_tokens). Keep in sync with
// src/lib/tokenBudgets.ts.
// ════════════════════════════════════════════════════════════════════

/** Practical ceiling we never exceed regardless of what a provider advertises. */
export const GLOBAL_OUTPUT_CEILING = 32768;

export const FREE_MODEL_OUTPUT_CAPS: Record<string, number> = {
  "nvidia/nemotron-3-super-120b-a12b:free": 65536,
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": 65536,
  "nvidia/nemotron-nano-12b-v2-vl:free": 32768,
  "nvidia/nemotron-3-nano-30b-a3b:free": 8192,
  "nvidia/nemotron-nano-9b-v2:free": 8192,
  "nvidia/nemotron-3.5-content-safety:free": 8192,
  "cohere/north-mini-code:free": 64000,
  "inclusionai/ling-3.0-flash:free": 32768,
  "poolside/laguna-s-2.1:free": 32768,
  "poolside/laguna-xs-2.1:free": 32768,
  "google/gemma-4-26b-a4b-it:free": 32768,
  "google/gemma-4-31b-it:free": 32768,
  "openai/gpt-oss-20b:free": 32768,
  "openrouter/free": 32768,
};

export function modelOutputCap(model: string): number {
  return Math.min(FREE_MODEL_OUTPUT_CAPS[model] ?? 8192, GLOBAL_OUTPUT_CEILING);
}

/** Clamp a requested completion budget to what the given model actually accepts. */
export function clampTokens(model: string, requested: unknown, fallback = 2400): number {
  const want = Number(requested) || fallback;
  return Math.max(512, Math.min(want, modelOutputCap(model)));
}
