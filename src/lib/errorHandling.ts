// Lumina v2 — Error handling utilities.

export enum LuminaErrorCode {
  RATE_LIMITED = "rate_limited",
  CONTEXT_OVERFLOW = "context_overflow",
  MODEL_UNAVAILABLE = "model_unavailable",
  TIMEOUT = "timeout",
  INVALID_JSON = "invalid_json",
  AUTH_REQUIRED = "auth_required",
  UNKNOWN = "unknown",
}

export const ERROR_MAP: Record<LuminaErrorCode, string> = {
  [LuminaErrorCode.RATE_LIMITED]:
    "Lumina is catching its breath — trying a different route.",
  [LuminaErrorCode.CONTEXT_OVERFLOW]:
    "This thread got long — summarising earlier context to keep going.",
  [LuminaErrorCode.MODEL_UNAVAILABLE]:
    "That model is unavailable right now — switching to a backup.",
  [LuminaErrorCode.TIMEOUT]:
    "Took too long — retrying with a faster model.",
  [LuminaErrorCode.INVALID_JSON]:
    "The response came back a little messy — cleaning it up.",
  [LuminaErrorCode.AUTH_REQUIRED]:
    "Please sign in to use this feature.",
  [LuminaErrorCode.UNKNOWN]:
    "Something unexpected happened — please try again.",
};

/**
 * Robustly parse JSON from a model response.
 * Strips ```json fences, trims, falls back to extracting first {...} block.
 */
export function safeParseJSON<T = unknown>(raw: string): T {
  let s = (raw ?? "").trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(s) as T;
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        // fall through
      }
    }
    const a = s.match(/\[[\s\S]*\]/);
    if (a) {
      try {
        return JSON.parse(a[0]) as T;
      } catch {
        // fall through
      }
    }
    throw new Error("invalid_json");
  }
}
