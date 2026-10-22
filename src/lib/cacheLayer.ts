// Lumina v2 — Cache layer (policy-driven, in-memory).
// Note: the persistent AI answer cache (hot_cache) is served exclusively
// server-side by edge functions; the client never queries it directly.

export type CachePolicy = "permanent" | "week" | "day" | "none";

export const CACHE_POLICIES: Record<string, CachePolicy> = {
  notes: "permanent",
  flashcards: "permanent",
  test_gen: "permanent",
  podcast: "permanent",
  resources: "permanent",

  study_planner: "week",
  exam_planner: "week",

  chat_fast: "none",
  chat_auto: "none",
  chat_study: "none",
  chat_coding: "none",
  chat_reasoning: "none",
  chat_deepdive: "none",
  chat_creative: "none",
  chat_general: "none",
  doubt_simple: "none",
  doubt_exam: "none",
  doubt_deep: "none",
  guided_lesson: "none",
  quick_study: "none",
  analytics: "none",
  neural_insight: "none",
};

const STOP_WORDS_RE =
  /\b(what|is|the|a|an|of|for|and|or|to|how|does|do|are|was)\b/g;

/** Normalize a query for fingerprinting. */
export function fingerprintQuery(query: string): string {
  return (query || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(STOP_WORDS_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hashKey(fingerprint: string): string {
  // btoa is browser-safe for ASCII (fingerprint is already normalised ASCII).
  try {
    return btoa(unescape(encodeURIComponent(fingerprint))).slice(0, 32);
  } catch {
    return fingerprint.slice(0, 32);
  }
}

const GENERIC_PATTERNS = [
  /^(what is|define|explain|what are|what does)\b/i,
  /^(formula for|equation for|law of)\b/i,
];
const PERSONAL_PATTERNS = [
  /\b(i|my|me|we|our|you|your)\b/i,
  /\b(this|that|it|above|below|previous)\b/i,
];

export function isGenericQuery(query: string): boolean {
  const q = (query || "").trim();
  if (!q) return false;
  const generic = GENERIC_PATTERNS.some(p => p.test(q));
  const personal = PERSONAL_PATTERNS.some(p => p.test(q));
  return generic && !personal;
}

/**
 * Policy-driven cache wrapper. For "none" policy, just runs the generator.
 * Currently uses an in-memory cache for non-hot-path features keyed by `cacheKey`.
 * Permanent / week entries survive for the lifetime of the page session;
 * persistent storage per-feature is left to the caller's existing tables.
 */
const memoryCache = new Map<string, { value: any; expiresAt: number }>();

function policyTtlMs(policy: CachePolicy): number {
  switch (policy) {
    case "permanent": return Number.MAX_SAFE_INTEGER;
    case "week": return 7 * 24 * 3600 * 1000;
    case "day": return 24 * 3600 * 1000;
    default: return 0;
  }
}

export async function withCache<T>(
  cacheKey: string,
  feature: string,
  generator: () => Promise<T>,
): Promise<T> {
  const policy = CACHE_POLICIES[feature] ?? "none";
  if (policy === "none") return generator();

  const hit = memoryCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const value = await generator();
  memoryCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + policyTtlMs(policy),
  });
  return value;
}

export function buildCacheKey(
  feature: string,
  parts: Record<string, string | number | undefined>,
): string {
  const norm = Object.keys(parts)
    .sort()
    .map(k => `${k}=${String(parts[k] ?? "").toLowerCase().trim()}`)
    .join("|");
  return `${feature}::${norm}`;
}
