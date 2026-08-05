// Lumina v2 — Token budget constants
// Pure constants, no logic.

export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "nvidia/nemotron-3-ultra-550b-a55b:free": 1000000,
  "nvidia/nemotron-3-super-120b-a12b:free": 262144,
  "google/gemma-4-31b-it:free": 262144,
  "google/gemma-4-26b-a4b-it:free": 262144,
  "cohere/north-mini-code:free": 256000,
  "poolside/laguna-s-2.1:free": 262144,
  "poolside/laguna-xs-2.1:free": 262144,
  "openai/gpt-oss-20b:free": 131072,
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": 256000,
  "nvidia/nemotron-3-nano-30b-a3b:free": 256000,
  "nvidia/nemotron-nano-9b-v2:free": 128000,
  "nvidia/nemotron-nano-12b-v2-vl:free": 128000,
  "nvidia/nemotron-3.5-content-safety:free": 128000,
  "inclusionai/ling-3.0-flash:free": 262144,
  "openrouter/free": 128000,
};

export const MODEL_OUTPUT_CAPS: Record<string, number> = {
  "nvidia/nemotron-3-ultra-550b-a55b:free": 32768,
  "nvidia/nemotron-3-super-120b-a12b:free": 32768,
  "google/gemma-4-31b-it:free": 32768,
  "google/gemma-4-26b-a4b-it:free": 32768,
  "cohere/north-mini-code:free": 32768,
  "poolside/laguna-s-2.1:free": 32768,
  "poolside/laguna-xs-2.1:free": 32768,
  "openai/gpt-oss-20b:free": 32768,
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": 32768,
  "nvidia/nemotron-3-nano-30b-a3b:free": 8192,
  "nvidia/nemotron-nano-9b-v2:free": 8192,
  "nvidia/nemotron-nano-12b-v2-vl:free": 32768,
  "nvidia/nemotron-3.5-content-safety:free": 8192,
  "inclusionai/ling-3.0-flash:free": 32768,
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
