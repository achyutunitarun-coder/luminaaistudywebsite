// ───────────────────────────────────────────────────────────────────
// Lumina v2 — Server-side preflight: crisis detection + state machine
// + hot-cache lookup. Crisis responses are HARDCODED. No LLM ever
// handles an active crisis.
// ───────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CRISIS_HARD_SIGNALS = [
  "want to kill myself", "going to kill myself", "planning to end it",
  "want to die", "decided to end my life", "saying goodbye",
  "took pills", "hurt myself", "cutting myself",
  "wrote a note", "given away my things",
  "last time talking to you", "won't be here tomorrow",
  "nobody will miss me", "better off without me",
];

const DISTRESS_SIGNALS: Array<{ phrase: string; weight: number }> = [
  { phrase: "can't keep doing this", weight: 3 },
  { phrase: "what's the point", weight: 3 },
  { phrase: "sleep forever", weight: 4 },
  { phrase: "no reason to", weight: 3 },
  { phrase: "i give up", weight: 2 },
  { phrase: "nobody cares", weight: 3 },
  { phrase: "completely alone", weight: 3 },
  { phrase: "can't go on", weight: 4 },
  { phrase: "disappear", weight: 2 },
  { phrase: "worthless", weight: 3 },
  { phrase: "don't deserve", weight: 3 },
  { phrase: "hate myself", weight: 3 },
  { phrase: "done with everything", weight: 3 },
  { phrase: "want to die", weight: 2 },
  { phrase: "killing me", weight: 1 },
  { phrase: "this is torture", weight: 1 },
  { phrase: "can't take it anymore", weight: 2 },
];

const NEGATION_CONTEXT = [
  "laughing", "funny", "lol", "lmao", "haha", "joke", "meme",
  "this problem", "this question", "this exam", "this chapter",
  "bored", "tired of studying",
];

export type CrisisTier = "safe" | "stress" | "crisis";
export type CrisisState =
  | "first_intercept" | "acknowledged" | "resource_rejected"
  | "de_escalating" | "resolved" | "escalated";

export function scoreCrisisSignal(text: string): { score: number; tier: CrisisTier } {
  const lower = (text || "").toLowerCase();
  if (CRISIS_HARD_SIGNALS.some((s) => lower.includes(s))) {
    return { score: 10, tier: "crisis" };
  }
  const negation = NEGATION_CONTEXT.some((n) => lower.includes(n));
  let score = DISTRESS_SIGNALS.reduce(
    (acc, { phrase, weight }) => (lower.includes(phrase) ? acc + weight : acc),
    0,
  );
  if (negation) score = Math.floor(score * 0.3);
  const tier: CrisisTier =
    score >= 6 ? "crisis" : score >= 3 ? "stress" : "safe";
  return { score, tier };
}

export const CRISIS_RESPONSES: Record<CrisisState, string> = {
  first_intercept: `Hey.\n\nWhatever is happening right now — I need you to stop for a second. Not the studying. Everything.\n\nIf you're having thoughts of hurting yourself, please reach out to someone who can actually be with you:\n\n**iCall:** 9152987821 — free, trained counsellors, confidential\n**Vandrevala Foundation:** 1860-2662-345 (available 24/7)\n**AASRA:** 9820466627\n\nYou don't have to explain anything to them. You can just call and say "I'm not okay."\n\nI'm not going anywhere. Are you safe right now?`,
  acknowledged: `I'm glad you're talking to me.\n\nYou don't have to figure this out alone. Whatever is making this feel so unbearable right now — it's real, and it makes sense that you're struggling.\n\nIs there someone near you right now? A parent, a friend, anyone in the building?`,
  resource_rejected: `I hear you. That's incredibly frustrating — you reached out and it didn't work.\n\nLet's try a different one. **iCall (9152987821)** specifically trains counsellors for this. Not the same as a generic helpline.\n\nIf calling feels like too much right now, you can also text. **iCall has a chat option** at icallhelpline.org.\n\nAre you somewhere safe physically right now? I just want to know you're okay.`,
  de_escalating: `Okay. I'm here.\n\nYou don't have to do anything right now except breathe. No studying, no pressure, no expectations.\n\nWhen you're ready — and only when you're ready — tell me what's been building up. I'm not going to try to fix it. I'm just going to listen.`,
  resolved: `I'm really glad you're still here.\n\nTake tonight off. Genuinely. The work will be there tomorrow. You've been carrying something heavy and you need to put it down for one night.\n\nIf it comes back — and sometimes it does — you know where I am. And you know the numbers.`,
  escalated: `Please call emergency services right now — 112 in India.\n\nIf you can't call, text a family member or anyone near you where you are.\n\nI can't be there physically. Someone needs to be with you. Please reach out to someone near you right now.`,
};

function nextStateFor(current: CrisisState, reply: string): CrisisState {
  const lower = (reply || "").toLowerCase();
  if (current === "first_intercept") {
    if (/already called|didn'?t help|hung up|no answer|couldn'?t get through/i.test(lower)) return "resource_rejected";
    if (/safe|i'?m ok|i'?m fine|just stressed/i.test(lower)) return "de_escalating";
    return "acknowledged";
  }
  if (current === "acknowledged" || current === "resource_rejected") {
    if (/immediate|right now|can'?t stop|going to|about to/i.test(lower)) return "escalated";
    if (/better|calmer|okay|talked to|called|someone/i.test(lower)) return "de_escalating";
  }
  if (current === "de_escalating") {
    if (/okay now|fine|better|thank you|thanks/i.test(lower)) return "resolved";
  }
  return current;
}

export interface PreFlightResult {
  proceed: boolean;
  interceptResponse?: string;
  systemAddon?: string;
}

export interface PreFlightOptions {
  userId: string;
  userMessage: string;
  feature: string;
  authHeader?: string;
}

function svcClient(authHeader?: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
    authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined,
  );
}

export async function preFlight(opts: PreFlightOptions): Promise<PreFlightResult> {
  const { userId, userMessage, feature, authHeader } = opts;
  if (!userMessage || !userId) return { proceed: true };
  const sb = svcClient(authHeader);

  // Re-score the incoming message up front.
  const { tier: incomingTier } = scoreCrisisSignal(userMessage);

  // Existing crisis session?
  try {
    const { data: active } = await sb
      .from("crisis_sessions")
      .select("state, last_updated")
      .eq("user_id", userId)
      .maybeSingle();
    if (active && active.state !== "resolved" && active.state !== "escalated") {
      const ageMs = active.last_updated
        ? Date.now() - new Date(active.last_updated as string).getTime()
        : Infinity;
      const stale = ageMs > 2 * 60 * 60 * 1000; // 2h
      // If the new message is clearly an academic/safe query (no distress signals
      // and not a tiny emotional reply), auto-resolve and proceed normally.
      const clearlySafe = incomingTier === "safe" && userMessage.trim().length > 12;

      if (stale || clearlySafe) {
        await sb.from("crisis_sessions").upsert(
          { user_id: userId, state: "resolved", last_updated: new Date().toISOString() },
          { onConflict: "user_id" },
        );
        // fall through to normal preflight (no intercept)
      } else {
        const next = nextStateFor(active.state as CrisisState, userMessage);
        await sb.from("crisis_sessions").upsert(
          { user_id: userId, state: next, last_updated: new Date().toISOString() },
          { onConflict: "user_id" },
        );
        return { proceed: false, interceptResponse: CRISIS_RESPONSES[next] };
      }
    }
  } catch (e) {
    console.warn("preflight crisis session lookup failed", e);
  }

  const tier = incomingTier;

  if (tier === "crisis") {
    try {
      await sb.from("crisis_sessions").upsert(
        { user_id: userId, state: "first_intercept", last_updated: new Date().toISOString() },
        { onConflict: "user_id" },
      );
      await sb.from("safety_events").insert({ user_id: userId, event_type: "crisis_intercept", feature });
    } catch (e) {
      console.warn("preflight crisis insert failed", e);
    }
    return { proceed: false, interceptResponse: CRISIS_RESPONSES.first_intercept };
  }

  if (tier === "stress") {
    try {
      await sb.from("safety_events").insert({ user_id: userId, event_type: "stress_flag", feature });
    } catch { /* best effort */ }
    return {
      proceed: true,
      systemAddon: `\n\nPRIORITY OVERRIDE: Student is showing emotional distress signals. Before any academic content, acknowledge what they're feeling in one warm sentence. Offer a physical grounding action. Return to the academic question only after they signal readiness. Tone: older brother, not therapist.`,
    };
  }
  return { proceed: true };
}

// ── Hot-cache helpers ─────────────────────────────────────────────────
const STOP_WORDS_RE = /\b(what|is|the|a|an|of|for|and|or|to|how|does|do|are|was)\b/g;
export function fingerprintQuery(query: string): string {
  return (query || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(STOP_WORDS_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}
function hashKey(fp: string): string {
  try { return btoa(unescape(encodeURIComponent(fp))).slice(0, 32); }
  catch { return fp.slice(0, 32); }
}

const GENERIC = [
  /^(what is|define|explain|what are|what does)\b/i,
  /^(formula for|equation for|law of)\b/i,
];
const PERSONAL = [
  /\b(i|my|me|we|our|you|your)\b/i,
  /\b(this|that|it|above|below|previous)\b/i,
];
export function isGenericQuery(q: string): boolean {
  const s = (q || "").trim();
  if (!s) return false;
  return GENERIC.some((p) => p.test(s)) && !PERSONAL.some((p) => p.test(s));
}

export async function hotCacheLookup(query: string, feature: string, authHeader?: string): Promise<string | null> {
  const fp = fingerprintQuery(query);
  if (!fp) return null;
  try {
    const sb = svcClient(authHeader);
    const { data } = await sb
      .from("hot_cache")
      .select("answer")
      .eq("query_hash", hashKey(fp))
      .eq("feature", feature)
      .maybeSingle();
    return data?.answer ?? null;
  } catch { return null; }
}

export async function maybeStoreHotCache(
  query: string, feature: string, answer: string, board = "all",
): Promise<void> {
  if (!isGenericQuery(query)) return;
  const fp = fingerprintQuery(query);
  if (!fp) return;
  try {
    const sb = svcClient();
    await sb.from("hot_cache").insert({
      query_hash: hashKey(fp),
      canonical_query: query,
      feature,
      board,
      answer,
      hit_count: 1,
    });
  } catch { /* best effort */ }
}
