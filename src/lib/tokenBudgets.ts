// Lumina v2 — Token budget constants
// Pure constants, no logic.

export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "openrouter/owl-alpha": 200000,
  "openai/gpt-oss-120b:free": 128000,
  "openai/gpt-oss-20b:free": 128000,
  "z-ai/glm-4.5-air:free": 128000,
  "moonshotai/kimi-k2.6": 128000,
  "qwen/qwen3-coder:free": 128000,
  "nvidia/nemotron-3-super-120b-a12b:free": 128000,
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": 128000,
  "poolside/laguna-m.1:free": 128000,
  "meta-llama/llama-3.2-3b-instruct:free": 128000,
  "openrouter/free": 128000,
};

export const MODEL_OUTPUT_CAPS: Record<string, number> = {
  "openrouter/owl-alpha": 65000,
  "openai/gpt-oss-120b:free": 16000,
  "openai/gpt-oss-20b:free": 8000,
  "z-ai/glm-4.5-air:free": 16000,
  "moonshotai/kimi-k2.6": 32000,
  "qwen/qwen3-coder:free": 32000,
  "nvidia/nemotron-3-super-120b-a12b:free": 16000,
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": 16000,
  "poolside/laguna-m.1:free": 16000,
  "meta-llama/llama-3.2-3b-instruct:free": 4000,
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
