import type { ConversationStore } from "./conversation-store.ts";
import type { CheckpointData } from "./conversation-store.ts";

const TRUNCATION_PATTERNS = [
  /\.\.\.\s*$/m,
  /\[truncated\]$/i,
  /\[cut off\]$/i,
  /\[incomplete\]$/i,
  /\/\/\s*\.\.\./,
  /\/\*\s*\.\.\.\s*\*\//,
];

const CONTINUATION_PROMPT =
  "Continue exactly where you left off. Do NOT repeat ANYTHING already written. Do NOT restart. Do NOT summarize. Resume mid-sentence, mid-code, or mid-JSON if needed. Output ONLY the direct continuation \u2014 no prefixes, no explanations, no markdown fences.";

const JSON_TRUNCATION_PROMPT =
  "The JSON above was truncated and INCOMPLETE. Continue and COMPLETE the JSON object. Output ONLY the remaining properties/key-value pairs to close the outermost object/array. No explanations, no markdown fences, no prefixes.";

export function isTruncated(text: string): boolean {
  if (!text || text.trim().length === 0) return true;
  const trimmed = text.trim();
  if (TRUNCATION_PATTERNS.some((p) => p.test(trimmed))) return true;
  return false;
}

export function extractLastJsonObject(text: string): string | null {
  const stack: string[] = [];
  let lastValidEnd = -1;
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"' && !escape) { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}") {
      if (stack.length > 0 && stack[stack.length - 1] === "{") { stack.pop(); if (stack.length === 0) lastValidEnd = i; }
    } else if (ch === "]") {
      if (stack.length > 0 && stack[stack.length - 1] === "[") { stack.pop(); if (stack.length === 0) lastValidEnd = i; }
    }
  }
  if (lastValidEnd > 0) return text.slice(0, lastValidEnd + 1);
  return null;
}

export function looksLikeTruncatedJson(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
  let braceCount = 0, bracketCount = 0, inStr = false, esc = false;
  for (const ch of trimmed) {
    if (esc) { esc = false; continue; }
    if (ch === "\\" && inStr) { esc = true; continue; }
    if (ch === '"' && !esc) { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") braceCount++;
    else if (ch === "}") braceCount--;
    else if (ch === "[") bracketCount++;
    else if (ch === "]") bracketCount--;
  }
  return braceCount > 0 || bracketCount > 0;
}

function buildContextAwarePrompt(
  partial: string,
  isJson: boolean,
  checkpoint?: CheckpointData | null,
  conversationSummary?: string,
): string {
  const parts: string[] = [];

  if (checkpoint) {
    parts.push(`[CONTEXT: You were working on step ${checkpoint.step}/${checkpoint.totalSteps} of a ${checkpoint.mode} task. Your goal: ${checkpoint.context.slice(0, 300)}]`);
  }

  if (conversationSummary) {
    parts.push(`[CONVERSATION HISTORY]\n${conversationSummary.slice(0, 1500)}\n[/CONVERSATION HISTORY]`);
  }

  if (isJson) {
    parts.push(JSON_TRUNCATION_PROMPT);
  } else {
    parts.push(CONTINUATION_PROMPT);
  }

  parts.push(`\n--- PARTIAL OUTPUT (resume from here) ---\n${partial.slice(-3000)}`);

  return parts.join("\n\n");
}

export interface ModelClient {
  complete(messages: any[], opts?: { maxTokens?: number; temperature?: number; tag?: string }): Promise<string>;
}

export async function completeTruncated(
  client: ModelClient,
  partial: string,
  tag: string,
  isJson: boolean,
  maxTokens = 4096,
  checkpoint?: CheckpointData | null,
  conversationSummary?: string,
): Promise<string> {
  const prompt = buildContextAwarePrompt(partial, isJson, checkpoint, conversationSummary);

  const continuation = await client.complete(
    [{ role: "user", content: prompt }],
    { maxTokens, temperature: 0.1, tag: `${tag}/truncation-recovery` },
  );

  let cleaned = continuation.trim();
  if (cleaned.startsWith("```")) {
    const endIdx = cleaned.indexOf("\n", 3);
    cleaned = endIdx > 0 ? cleaned.slice(endIdx + 1).trim() : cleaned;
  }
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3).trim();

  if (cleaned.startsWith("ASSISTANT:") || cleaned.startsWith("assistant:")) {
    cleaned = cleaned.slice(cleaned.indexOf(":") + 1).trim();
  }

  const stitched = partial.endsWith("\n") ? partial + cleaned : partial + "\n" + cleaned;

  if (isJson) {
    const recovered = extractLastJsonObject(stitched);
    if (recovered) {
      try { JSON.parse(recovered); return recovered; } catch {}
    }
    try { JSON.parse(stitched); return stitched; } catch {}
    for (let i = stitched.length; i > 0; i--) {
      try { JSON.parse(stitched.slice(0, i)); return stitched.slice(0, i); } catch { continue; }
    }
  }

  return stitched;
}

export async function safeJsonParse<T>(
  client: ModelClient,
  text: string,
  tag: string,
  maxTokens = 4096,
  checkpoint?: CheckpointData | null,
  conversationSummary?: string,
): Promise<{ data: T | null; raw: string; recovered: boolean }> {
  let raw = text;

  if (isTruncated(raw) || looksLikeTruncatedJson(raw)) {
    raw = await completeTruncated(client, raw, tag, true, maxTokens, checkpoint, conversationSummary);
  }

  try {
    const data = JSON.parse(raw) as T;
    return { data, raw, recovered: raw !== text };
  } catch {
    const extracted = extractLastJsonObject(raw);
    if (extracted) {
      try {
        const data = JSON.parse(extracted) as T;
        return { data, raw: extracted, recovered: true };
      } catch {}
    }
    return { data: null, raw, recovered: false };
  }
}
