// Lumina v2 — Pre-flight: crisis detection + state machine.
// Crisis responses are HARDCODED. LLMs never handle active crisis.

import { supabase } from "@/integrations/supabase/client";

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

const CRISIS_SCORE_THRESHOLD = 6;
const DISTRESS_SCORE_THRESHOLD = 3;

export type CrisisTier = "safe" | "stress" | "crisis";

export function scoreCrisisSignal(text: string): { score: number; tier: CrisisTier } {
  const lower = (text || "").toLowerCase();
  if (CRISIS_HARD_SIGNALS.some(s => lower.includes(s))) {
    return { score: 10, tier: "crisis" };
  }
  const negation = NEGATION_CONTEXT.some(n => lower.includes(n));
  let score = DISTRESS_SIGNALS.reduce(
    (acc, { phrase, weight }) => (lower.includes(phrase) ? acc + weight : acc),
    0,
  );
  if (negation) score = Math.floor(score * 0.3);
  const tier: CrisisTier =
    score >= CRISIS_SCORE_THRESHOLD ? "crisis" :
    score >= DISTRESS_SCORE_THRESHOLD ? "stress" :
    "safe";
  return { score, tier };
}

export type CrisisState =
  | "first_intercept"
  | "acknowledged"
  | "resource_rejected"
  | "de_escalating"
  | "resolved"
  | "escalated";

export const CRISIS_RESPONSES: Record<CrisisState, string> = {
  first_intercept: `Hey.

Whatever is happening right now — I need you to stop for a second. Not the studying. Everything.

If you're having thoughts of hurting yourself, please reach out to someone who can actually be with you:

**iCall:** 9152987821 — free, trained counsellors, confidential
**Vandrevala Foundation:** 1860-2662-345 (available 24/7)
**AASRA:** 9820466627

You don't have to explain anything to them. You can just call and say "I'm not okay."

I'm not going anywhere. Are you safe right now?`,

  acknowledged: `I'm glad you're talking to me.

You don't have to figure this out alone. Whatever is making this feel so unbearable right now — it's real, and it makes sense that you're struggling.

Is there someone near you right now? A parent, a friend, anyone in the building?`,

  resource_rejected: `I hear you. That's incredibly frustrating — you reached out and it didn't work.

Let's try a different one. **iCall (9152987821)** specifically trains counsellors for this. Not the same as a generic helpline.

If calling feels like too much right now, you can also text. **iCall has a chat option** at icallhelpline.org.

Are you somewhere safe physically right now? I just want to know you're okay.`,

  de_escalating: `Okay. I'm here.

You don't have to do anything right now except breathe. No studying, no pressure, no expectations.

When you're ready — and only when you're ready — tell me what's been building up. I'm not going to try to fix it. I'm just going to listen.`,

  resolved: `I'm really glad you're still here.

Take tonight off. Genuinely. The work will be there tomorrow. You've been carrying something heavy and you need to put it down for one night.

If it comes back — and sometimes it does — you know where I am. And you know the numbers.`,

  escalated: `Please call emergency services right now — 112 in India.

If you can't call, text a family member or anyone near you where you are.

I can't be there physically. Someone needs to be with you. Please reach out to someone near you right now.`,
};

async function advanceCrisisState(
  userId: string,
  currentState: CrisisState,
  studentResponse: string,
): Promise<{ nextState: CrisisState; response: string }> {
  const lower = (studentResponse || "").toLowerCase();
  let nextState: CrisisState = currentState;

  if (currentState === "first_intercept") {
    if (/already called|didn't help|hung up|no answer|couldn't get through/i.test(lower)) {
      nextState = "resource_rejected";
    } else if (/safe|i'?m ok|i'?m fine|just stressed/i.test(lower)) {
      nextState = "de_escalating";
    } else {
      nextState = "acknowledged";
    }
  } else if (currentState === "acknowledged" || currentState === "resource_rejected") {
    if (/immediate|right now|can'?t stop|going to|about to/i.test(lower)) {
      nextState = "escalated";
    } else if (/better|calmer|okay|talked to|called|someone/i.test(lower)) {
      nextState = "de_escalating";
    }
  } else if (currentState === "de_escalating") {
    if (/okay now|fine|better|thank you|thanks/i.test(lower)) {
      nextState = "resolved";
    }
  }

  await (supabase as any)
    .from("crisis_sessions")
    .upsert(
      { user_id: userId, state: nextState, last_updated: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  return { nextState, response: CRISIS_RESPONSES[nextState] };
}

export interface PreFlightResult {
  proceed: boolean;
  systemAddon?: string;
  interceptResponse?: string;
}

export async function preFlight(
  userId: string,
  userMessage: string,
  feature: string,
): Promise<PreFlightResult> {
  if (!userId) {
    const { tier } = scoreCrisisSignal(userMessage);
    if (tier === "crisis") {
      return { proceed: false, interceptResponse: CRISIS_RESPONSES.first_intercept };
    }
    return { proceed: true };
  }

  // Already in an active crisis session? Route through state machine.
  const { data: active } = await (supabase as any)
    .from("crisis_sessions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (active && active.state !== "resolved" && active.state !== "escalated") {
    const { response } = await advanceCrisisState(
      userId,
      active.state as CrisisState,
      userMessage,
    );
    return { proceed: false, interceptResponse: response };
  }

  const { tier } = scoreCrisisSignal(userMessage);

  if (tier === "crisis") {
    await (supabase as any)
      .from("crisis_sessions")
      .upsert(
        {
          user_id: userId,
          state: "first_intercept",
          initiated_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    await (supabase as any).from("safety_events").insert({
      user_id: userId,
      event_type: "crisis_intercept",
      feature,
    });
    return { proceed: false, interceptResponse: CRISIS_RESPONSES.first_intercept };
  }

  if (tier === "stress") {
    await (supabase as any).from("safety_events").insert({
      user_id: userId,
      event_type: "stress_flag",
      feature,
    }).catch?.(() => {});
    return {
      proceed: true,
      systemAddon: `
PRIORITY OVERRIDE: Student is showing emotional distress signals.
Before academic content: acknowledge what they're feeling in one warm sentence.
Offer a physical grounding action ("Go splash cold water on your face — I'll hold down the fort").
Return to the academic question only after they signal readiness.
Keep tone: older brother, not therapist.`,
    };
  }

  return { proceed: true };
}
