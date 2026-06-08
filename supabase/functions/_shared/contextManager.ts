// ───────────────────────────────────────────────────────────────────
// Server-side conversation summarizer.
// Centralizes what src/lib/contextManager.ts did per-client so every
// chat surface (chat, hub, squad, computer) gets summarization without
// each component re-implementing it.
//
// Strategy:
//   - If incoming history has < SUMMARIZE_THRESHOLD messages, return as-is.
//   - Otherwise, take the OLDER slice (everything except the last
//     KEEP_RECENT messages), summarize via a fast free model, and prepend
//     a single synthetic user+assistant pair that carries the summary.
//   - The recent KEEP_RECENT messages are preserved verbatim.
// ───────────────────────────────────────────────────────────────────

import { callAIText } from "./models.ts";

export interface ChatMsg {
  role: "user" | "assistant" | "system" | string;
  // content may be a string OR an array of OpenAI content parts (text/image).
  content: unknown;
}

const SUMMARIZE_THRESHOLD = 30;
const KEEP_RECENT = 10;
const SUMMARY_MODELS = [
  "openai/gpt-oss-20b:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "nvidia/nemotron-nano-9b-v2:free",
];

function asText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) =>
        typeof part === "string"
          ? part
          : typeof part?.text === "string"
            ? part.text
            : part?.type === "image_url"
              ? "[image]"
              : "",
      )
      .join(" ")
      .trim();
  }
  return "";
}

async function summarizeOlder(messages: ChatMsg[]): Promise<string> {
  const transcript = messages
    .map((m) => `${m.role === "user" ? "Student" : "Lumina"}: ${asText(m.content)}`)
    .filter((l) => l.length > 4)
    .join("\n\n")
    .slice(0, 24_000);

  const prompt = `You are summarising a tutoring session for a study AI's memory.
Produce a dense, factual summary of what was discussed. Include:
- Every topic, concept, formula, example introduced
- The student's demonstrated understanding gaps
- Any commitments, decisions, or next steps mentioned

Format: flowing prose. No headers. Max 400 words.
Be specific. "We covered torque and the right-hand rule for cross products" — not "we discussed physics."

TRANSCRIPT:
${transcript}`;

  try {
    const out = await callAIText(
      [{ role: "user", content: prompt }],
      SUMMARY_MODELS,
      1200,
      0.3,
      45_000,
      "context/summarize",
    );
    const text = (out || "").trim();
    if (text) return text;
  } catch (e) {
    console.warn("[contextManager] summary call failed", e);
  }
  // Fallback: list the first few user questions.
  const topics = messages
    .filter((m) => m.role === "user")
    .map((m) => asText(m.content).slice(0, 80))
    .slice(0, 8)
    .join(" · ");
  return `Earlier in this session the student asked about: ${topics}`;
}

export interface CondenseResult {
  messages: ChatMsg[];
  summarized: boolean;
  summary?: string;
  originalCount: number;
}

/**
 * Condense a long message history by summarizing older messages.
 * Always returns a `messages` array safe to pass to the model.
 */
export async function condenseHistory(messages: ChatMsg[]): Promise<CondenseResult> {
  if (!Array.isArray(messages) || messages.length < SUMMARIZE_THRESHOLD) {
    return { messages: messages ?? [], summarized: false, originalCount: messages?.length ?? 0 };
  }

  const older = messages.slice(0, messages.length - KEEP_RECENT);
  const recent = messages.slice(-KEEP_RECENT);

  // If the older slice is empty or trivially short, skip.
  const olderText = older.map((m) => asText(m.content)).join(" ");
  if (olderText.length < 800) {
    return { messages, summarized: false, originalCount: messages.length };
  }

  const summary = await summarizeOlder(older);

  const synthetic: ChatMsg[] = [
    {
      role: "user",
      content: `[CONVERSATION SUMMARY — what we covered earlier in this session]\n${summary}`,
    },
    {
      role: "assistant",
      content: "Got it — I have that context. What do you need next?",
    },
  ];

  return {
    messages: [...synthetic, ...recent],
    summarized: true,
    summary,
    originalCount: messages.length,
  };
}
