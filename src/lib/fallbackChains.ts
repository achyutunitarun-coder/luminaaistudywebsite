// Lumina v2 — Typed fallback chains.
// Cross-class fallback is BLOCKED.

export type ModelClass =
  | "fast"
  | "balanced"
  | "reasoning"
  | "coding"
  | "long_ctx"
  | "vision";

export const FALLBACK_CHAINS: Record<ModelClass, string[]> = {
  fast: [
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "meta-llama/llama-3.2-3b-instruct:free",
  ],
  balanced: [
    "openai/gpt-oss-120b:free",
    "openai/gpt-oss-20b:free",
    "google/gemma-4-26b-a4b-it:free",
  ],
  reasoning: [
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
  ],
  coding: [
    "cohere/north-mini-code:free",
    "qwen/qwen3-coder:free",
    "poolside/laguna-m.1:free",
    "poolside/laguna-xs-2.1:free",
    "poolside/laguna-xs-2.1:free",
  ],
  long_ctx: [
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
  ],
  vision: [
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
  ],
};

const BACKOFF_MS = [500, 1000, 2000];

/**
 * Generic typed-fallback caller.
 * `callerFn(model)` should perform a single LLM call and throw on failure.
 * Tries the requested model first, then the rest of its class chain.
 */
export async function callWithTypedFallback<T>(
  preferredModel: string,
  modelClass: ModelClass,
  callerFn: (model: string) => Promise<T>,
): Promise<T> {
  const chain = [preferredModel, ...FALLBACK_CHAINS[modelClass].filter(m => m !== preferredModel)];
  let lastErr: unknown;
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    try {
      return await callerFn(model);
    } catch (err) {
      lastErr = err;
      if (i < chain.length - 1) {
        await new Promise(r => setTimeout(r, BACKOFF_MS[Math.min(i, BACKOFF_MS.length - 1)]));
      }
    }
  }
  throw lastErr ?? new Error("All models in fallback chain failed");
}
