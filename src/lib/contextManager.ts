// Lumina v2 — Thread context manager with summarization.

import { supabase } from "@/integrations/supabase/client";
import {
  HISTORY_BUDGET_FRACTION,
  getModelContextWindow,
} from "./tokenBudgets";

export interface ChatMsg {
  role: "user" | "assistant" | "system";
  content: string;
}
interface DBMessage extends ChatMsg {
  id?: string;
  created_at?: string;
}

const SUMMARIZE_THRESHOLD = 30;
const KEEP_RECENT = 10;

function approxTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}

/** Trim oldest messages until total tokens fits the history budget. */
export function trimHistoryToFit(
  history: DBMessage[],
  model: string,
  systemPromptTokens: number,
): ChatMsg[] {
  const ctx = getModelContextWindow(model);
  const budget = Math.floor(ctx * HISTORY_BUDGET_FRACTION) - systemPromptTokens;
  const out: ChatMsg[] = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    const t = approxTokens(m.content);
    if (used + t > budget) break;
    used += t;
    out.unshift({ role: m.role, content: m.content });
  }
  return out;
}

/**
 * Generate a dense summary of older messages.
 * Uses a fast free model via the openrouter-proxy edge function.
 */
export async function generateThreadSummary(
  _threadId: string,
  messages: DBMessage[],
): Promise<string> {
  const transcript = messages
    .map(m => `${m.role === "user" ? "Student" : "Lumina"}: ${m.content}`)
    .join("\n\n");

  const prompt = `You are summarising a tutoring session for a study AI's memory system.
Produce a dense, factual summary of what was discussed. Include:
- Every topic and concept that was explained
- Any formulas, definitions, or examples that were introduced
- Student's demonstrated understanding gaps (what they struggled with)
- Any commitments or next steps mentioned

Format: flowing prose. No headers. Maximum 400 words.
Be specific — "we covered torque and the right-hand rule for cross products" not "we discussed physics."

TRANSCRIPT:
${transcript}`;

  try {
    const { data, error } = await supabase.functions.invoke("openrouter-proxy", {
      body: {
        model: "openai/gpt-oss-20b:free",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1200,
        temperature: 0.3,
        stream: false,
      },
    });
    if (error) throw error;
    const content =
      data?.choices?.[0]?.message?.content ??
      data?.content ??
      "";
    return String(content).trim() || fallbackSummary(messages);
  } catch {
    return fallbackSummary(messages);
  }
}

function fallbackSummary(messages: DBMessage[]): string {
  const topics = messages
    .filter(m => m.role === "user")
    .map(m => m.content.slice(0, 80))
    .slice(0, 8)
    .join(" · ");
  return `Earlier in this session the student asked about: ${topics}`;
}

/**
 * Returns the message list to send to the model.
 * If the thread is long, an earlier-context summary replaces older messages.
 */
export async function getContextForRequest(
  threadId: string,
  model: string,
  systemPromptTokens: number,
): Promise<{ messages: ChatMsg[]; hadSummary: boolean }> {
  const { data: rows } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("chat_id", threadId)
    .order("created_at", { ascending: true });

  const history = (rows ?? []) as DBMessage[];

  if (history.length < SUMMARIZE_THRESHOLD) {
    return {
      messages: trimHistoryToFit(history, model, systemPromptTokens),
      hadSummary: false,
    };
  }

  const olderMessages = history.slice(0, history.length - KEEP_RECENT);
  const recentMessages = history.slice(-KEEP_RECENT);

  // Look up most recent summary for this thread.
  const { data: existing } = await (supabase as any)
    .from("thread_summaries")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let summaryText: string;
  if (existing && existing.messages_covered >= olderMessages.length) {
    summaryText = existing.summary_text;
  } else {
    summaryText = await generateThreadSummary(threadId, olderMessages);
    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user) {
      await (supabase as any).from("thread_summaries").insert({
        thread_id: threadId,
        user_id: auth.user.id,
        summary_text: summaryText,
        messages_covered: olderMessages.length,
        token_count: approxTokens(summaryText),
      });
    }
  }

  const contextMessages: ChatMsg[] = [
    {
      role: "user",
      content: `[CONVERSATION SUMMARY — what we covered earlier in this session]\n${summaryText}`,
    },
    {
      role: "assistant",
      content: "Got it — I have that context. What do you need next?",
    },
    ...recentMessages.map(m => ({ role: m.role, content: m.content })),
  ];

  return { messages: contextMessages, hadSummary: true };
}
