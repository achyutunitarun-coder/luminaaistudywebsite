// Lumina v2 — Token budget constants
// Pure constants, no logic.

export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "openrouter/owl-alpha": 200000,
  "openai/gpt-oss-120b:free": 128000,
  "openai/gpt-oss-20b:free": 128000,
  "meta-llama/llama-3.3-70b-instruct:free": 128000,
  "meta-llama/llama-3.2-3b-instruct:free": 128000,
  "qwen/qwen3-coder:free": 128000,
  "qwen/qwen3-next-80b-a3b-instruct:free": 128000,
  "google/gemma-4-31b-instruct:free": 128000,
  "google/gemma-4-26b-a4b-it:free": 128000,
  "nvidia/nemotron-3-super-120b-a12b:free": 128000,
  "nvidia/nemotron-3-ultra-550b-a55b:free": 128000,
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": 128000,
  "nvidia/nemotron-nano-9b-v2:free": 128000,
  "nvidia/nemotron-nano-12b-v2-vl:free": 128000,
  "nvidia/nemotron-3.5-content-safety:free": 128000,
  "nousresearch/hermes-3-llama-3.1-405b:free": 128000,
  "poolside/laguna-m.1:free": 128000,
  "poolside/laguna-xs.2:free": 128000,
  "cohere/north-mini-code:free": 128000,
  "liquid/lfm-2.5-1.2b-instruct:free": 128000,
  "liquid/lfm-2.5-1.2b-thinking:free": 128000,
  "openrouter/free": 128000,
};

export const MODEL_OUTPUT_CAPS: Record<string, number> = {
  "openrouter/owl-alpha": 65000,
  "openai/gpt-oss-120b:free": 16000,
  "openai/gpt-oss-20b:free": 8000,
  "meta-llama/llama-3.3-70b-instruct:free": 16000,
  "meta-llama/llama-3.2-3b-instruct:free": 4000,
  "qwen/qwen3-coder:free": 32000,
  "qwen/qwen3-next-80b-a3b-instruct:free": 16000,
  "google/gemma-4-31b-instruct:free": 16000,
  "google/gemma-4-26b-a4b-it:free": 16000,
  "nvidia/nemotron-3-super-120b-a12b:free": 16000,
  "nvidia/nemotron-3-ultra-550b-a55b:free": 32000,
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": 16000,
  "nvidia/nemotron-nano-9b-v2:free": 8000,
  "nvidia/nemotron-nano-12b-v2-vl:free": 16000,
  "nvidia/nemotron-3.5-content-safety:free": 8000,
  "nousresearch/hermes-3-llama-3.1-405b:free": 16000,
  "poolside/laguna-m.1:free": 16000,
  "poolside/laguna-xs.2:free": 8000,
  "cohere/north-mini-code:free": 8000,
  "liquid/lfm-2.5-1.2b-instruct:free": 4000,
  "liquid/lfm-2.5-1.2b-thinking:free": 4000,
  "openrouter/free": 8000,
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
