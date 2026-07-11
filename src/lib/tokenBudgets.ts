// Lumina v2 — Token budget constants
// Pure constants, no logic.

export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "nvidia/nemotron-3-ultra-550b-a55b:free": 1_000_000,
  "nvidia/nemotron-3-super:free": 1_000_000,
  "meta-llama/llama-3.3-70b-instruct:free": 131_000,
  "google/gemma-4-31b-it:free": 1_000_000,
  "google/gemma-4-31b-it:free": 262_000,
  "google/gemma-4-26b-a4b-it:free": 262_000,
  "cohere/north-mini-code:free": 256_000,
  "poolside/laguna-m.1:free": 262_000,
  "poolside/laguna-xs.2:free": 262_000,
  "poolside/laguna-xs-2.1:free": 262_000,
  "qwen/qwen3-coder:free": 128_000,
  "qwen/qwen3-next-80b-a3b-instruct:free": 262_000,
  "openai/gpt-oss-120b:free": 131_000,
  "openai/gpt-oss-20b:free": 131_000,
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": 256_000,
  "nvidia/nemotron-3-nano-30b-a3b:free": 256_000,
  "nvidia/nemotron-nano-9b-v2:free": 128_000,
  "nvidia/nemotron-nano-12b-v2-vl:free": 128_000,
  "nvidia/nemotron-3.5-content-safety:free": 128_000,
  "nousresearch/hermes-3-llama-3.1-405b:free": 131_000,
  "qwen/qwen3-next-80b-a3b-instruct:free": 32_000,
  "meta-llama/llama-3.3-70b-instruct:free": 33_000,
  "meta-llama/llama-3.2-3b-instruct:free": 131_000,
  "liquid/lfm-2.5-1.2b-instruct:free": 33_000,
  "liquid/lfm-2.5-1.2b-thinking:free": 33_000,
  "openrouter/free": 128_000,
};

export const MODEL_OUTPUT_CAPS: Record<string, number> = {
  "nvidia/nemotron-3-ultra-550b-a55b:free": 32768,
  "nvidia/nemotron-3-super:free": 32768,
  "meta-llama/llama-3.3-70b-instruct:free": 32768,
  "google/gemma-4-31b-it:free": 1_000_000,
  "google/gemma-4-31b-it:free": 16384,
  "google/gemma-4-26b-a4b-it:free": 32768,
  "cohere/north-mini-code:free": 64000,
  "poolside/laguna-m.1:free": 32768,
  "poolside/laguna-xs.2:free": 32768,
  "poolside/laguna-xs-2.1:free": 32768,
  "qwen/qwen3-coder:free": 32768,
  "qwen/qwen3-next-80b-a3b-instruct:free": 32768,
  "openai/gpt-oss-120b:free": 32768,
  "openai/gpt-oss-20b:free": 32768,
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": 16384,
  "nvidia/nemotron-3-nano-30b-a3b:free": 8192,
  "nvidia/nemotron-nano-9b-v2:free": 8192,
  "nvidia/nemotron-nano-12b-v2-vl:free": 16384,
  "nvidia/nemotron-3.5-content-safety:free": 8192,
  "nousresearch/hermes-3-llama-3.1-405b:free": 32768,
  "qwen/qwen3-next-80b-a3b-instruct:free": 32768,
  "meta-llama/llama-3.3-70b-instruct:free": 8192,
  "meta-llama/llama-3.2-3b-instruct:free": 8192,
  "liquid/lfm-2.5-1.2b-instruct:free": 8192,
  "liquid/lfm-2.5-1.2b-thinking:free": 8192,
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
