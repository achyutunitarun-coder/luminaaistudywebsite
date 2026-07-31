// Lumina v2 — Token budget constants
// Pure constants, no logic.

export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "nvidia/nemotron-3-ultra-550b-a55b:free": 1_000_000,
  "nvidia/nemotron-3-super-120b-a12b:free": 1_000_000,
  "google/gemma-4-31b-it:free": 262_000,
  "google/gemma-4-26b-a4b-it:free": 262_000,
  "cohere/north-mini-code:free": 256_000,
  "poolside/laguna-s-2.1:free": 262_000,
  "poolside/laguna-xs-2.1:free": 262_000,
  "openai/gpt-oss-20b:free": 131_000,
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": 256_000,
  "nvidia/nemotron-3-nano-30b-a3b:free": 256_000,
  "nvidia/nemotron-nano-9b-v2:free": 128_000,
  "nvidia/nemotron-nano-12b-v2-vl:free": 128_000,
  "nvidia/nemotron-3.5-content-safety:free": 128_000,
  "inclusionai/ling-3.0-flash:free": 128_000,
  "openrouter/free": 128_000,
};

export const MODEL_OUTPUT_CAPS: Record<string, number> = {
  "nvidia/nemotron-3-ultra-550b-a55b:free": 32768,
  "nvidia/nemotron-3-super-120b-a12b:free": 32768,
  "google/gemma-4-31b-it:free": 16384,
  "google/gemma-4-26b-a4b-it:free": 32768,
  "cohere/north-mini-code:free": 64000,
  "poolside/laguna-s-2.1:free": 32768,
  "poolside/laguna-xs-2.1:free": 32768,
  "openai/gpt-oss-20b:free": 32768,
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": 16384,
  "nvidia/nemotron-3-nano-30b-a3b:free": 8192,
  "nvidia/nemotron-nano-9b-v2:free": 8192,
  "nvidia/nemotron-nano-12b-v2-vl:free": 16384,
  "nvidia/nemotron-3.5-content-safety:free": 8192,
  "inclusionai/ling-3.0-flash:free": 8192,
  "openrouter/free": 32768,
};

export const HISTORY_BUDGET_FRACTION = 0.5;

export function getModelContextWindow(model: string): number {
  return MODEL_CONTEXT_WINDOWS[model] ?? 128000;
}

export function getModelOutputCap(model: string): number {
  return MODEL_OUTPUT_CAPS[model] ?? 8000;
}

/** Return token threshold above which a continuation is required. */
export function getContinuationThreshold(model: string): number {
  return Math.floor(getModelOutputCap(model) * 0.9);
}
