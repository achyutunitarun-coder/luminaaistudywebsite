/**
 * Tool budget classifier (Section 3 of the architecture spec).
 *
 * Distinguishes between lightweight conversational turns and full task execution.
 * Lightweight turns get a bounded tool-call budget (~10);
 * full task execution (any deliverable mode) gets effectively unlimited calls.
 *
 * A fast/cheap model role (regex + heuristic) routes incoming requests
 * without requiring the user to manually pick a mode every time.
 */

export type BudgetTier = "lightweight" | "full";

export interface BudgetDecision {
  tier: BudgetTier;
  maxToolCalls: number;
  maxTokens: number;
  reason: string;
}

const LIGHTWEIGHT_CONFIG = {
  maxToolCalls: 10,
  maxTokens: 8192,
};

const FULL_CONFIG = {
  maxToolCalls: 500,
  maxTokens: 65536,
};

/**
 * Keywords that suggest a lightweight conversational turn (no deliverable needed).
 */
const LIGHTWEIGHT_PATTERNS = [
  /^(hi|hello|hey|what's up|how are you|good morning|good evening)\b/i,
  /^(thanks|thank you|ok|okay|sure|great|nice|awesome|perfect)\b/i,
  /\b(what (is|are|can|do) (you|your)\b.*(name|capabilities|do|help)\b)/i,
  /\b(who (are|made|created) you)\b/i,
  /\b(how (does this|does it|do you|can i|to)\b.*(work|use|start|begin)\b)/i,
  /^(yes|no|maybe|perhaps|right|correct|wrong|nope|yep)$/i,
  /^(can you|will you|would you) (repeat|clarify|explain|simplify)\b/i,
  /^(what (was|is) (that|this|the question|the last|the previous))/i,
  /^(i (don't|do not) understand|(can you )?help me understand)/i,
];

/**
 * Keywords that suggest a full deliverable task.
 */
const DELIVERABLE_PATTERNS = [
  /\b(build|create|generate|make|develop|write|produce|craft)\b.*\b(website|app|page|dashboard|tool|game)\b/i,
  /\b(research|investigate|analyze|study|explore|find out|look into)\b/i,
  /\b(write|draft|compose|author|prepare)\b.*\b(doc|document|report|paper|article|blog|essay)\b/i,
  /\b(create|build|design|make)\b.*\b(slide|presentation|deck|pitch)\b/i,
  /\b(create|build|make)\b.*\b(sheet|spreadsheet|table|chart|graph)\b.*\b(data|formula|analysis)\b/i,
  /\b(create|design|build)\b.*\b(website|webpage|landing|site|html|frontend)\b/i,
  /\b(convert|transform|change|turn)\b.*\b(into)\b.*\b(slides|doc|sheet|website|report)\b/i,
  /^(deep research|research|study|analyze)\b/i,
];

/**
 * Classify a user message into a budget tier.
 * Uses regex-based pattern matching for speed (no LLM call needed for routing).
 */
export function classifyBudget(messages: { role: string; content: string }[]): BudgetDecision {
  // Get the last user message
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const query = lastUser?.content ?? "";

  // Check for deliverable patterns first (higher priority)
  for (const pattern of DELIVERABLE_PATTERNS) {
    if (pattern.test(query)) {
      return {
        tier: "full",
        ...FULL_CONFIG,
        reason: "matched deliverable pattern",
      };
    }
  }

  // Check for lightweight patterns
  for (const pattern of LIGHTWEIGHT_PATTERNS) {
    if (pattern.test(query)) {
      return {
        tier: "lightweight",
        ...LIGHTWEIGHT_CONFIG,
        reason: "matched conversational pattern",
      };
    }
  }

  // Short messages (< 5 words, no punctuation besides basic) are likely lightweight
  const wordCount = query.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 3 && query.length < 40) {
    return {
      tier: "lightweight",
      ...LIGHTWEIGHT_CONFIG,
      reason: "very short message",
    };
  }

  // Check if the request is a simple clarification ("what does this code do?")
  if (/^(what|how|why|when|where|which) /.test(query) && wordCount <= 8) {
    return {
      tier: "lightweight",
      ...LIGHTWEIGHT_CONFIG,
      reason: "simple question",
    };
  }

  // Default: full task execution for anything substantial
  return {
    tier: "full",
    ...FULL_CONFIG,
    reason: "default — full task execution",
  };
}

/**
 * Determine budget mode from the Lumina mode selection.
 * If a mode is already selected, it's always full execution.
 */
export function getBudgetForMode(luminaMode: string | undefined | null): BudgetDecision {
  if (luminaMode && ["research", "doc", "sheet", "slide", "website"].includes(luminaMode)) {
    return { tier: "full", ...FULL_CONFIG, reason: `explicit ${luminaMode} mode` };
  }
  // Default: lightweight until classified
  return { tier: "lightweight", ...LIGHTWEIGHT_CONFIG, reason: "no mode selected — lightweight fallback" };
}
