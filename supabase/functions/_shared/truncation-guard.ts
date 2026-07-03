import type { ConversationStore } from "./conversation-store.ts";
import type { CheckpointData } from "./conversation-store.ts";

export type TruncationSignal = "api" | "structural" | "content" | "none";

export interface TruncationResult {
  truncated: boolean;
  signal: TruncationSignal;
  detail: string;
  finishReason?: string;
}

export interface ContinuationEvent {
  tag: string;
  round: number;
  signal: TruncationSignal;
  originalLength: number;
  continuationLength: number;
  model: string;
}

const _continuationLog: ContinuationEvent[] = [];

export function getContinuationLog(): ContinuationEvent[] {
  return _continuationLog;
}

export function logContinuationEvent(event: Omit<ContinuationEvent, "timestamp"> & { timestamp?: number }): void {
  _continuationLog.push({ ...event, timestamp: event.timestamp ?? Date.now() });
  console.log(
    `[truncation-guard] cont-round=${event.round} signal=${event.signal} tag=${event.tag} ` +
    `orig=${event.originalLength} cont=${event.continuationLength} model=${event.model}`,
  );
}

export function isLengthTruncated(finishReason: string | null | undefined): boolean {
  return finishReason === "length" || finishReason === "max_tokens";
}

const CONTENT_PATTERNS = [
  /\.\.\.\s*$/m,
  /\[truncated\]$/i,
  /\[cut off\]$/i,
  /\[incomplete\]$/i,
  /\/\/\s*\.\.\./,
  /\/\*\s*\.\.\.\s*\*\//,
  /\[rest (unchanged|omitted|of .+ unchanged)\]/i,
  /\/\/\s*rest\s+(of\s+)?(code|implementation|the\s+function|the\s+class|omitted)/i,
];

export function detectContentTruncation(text: string): TruncationResult | null {
  if (!text || text.trim().length === 0) {
    return { truncated: true, signal: "content", detail: "empty response" };
  }
  const trimmed = text.trimEnd();
  if (trimmed.length === 0) {
    return { truncated: true, signal: "content", detail: "whitespace-only response" };
  }

  if (CONTENT_PATTERNS.some((p) => p.test(trimmed))) {
    return { truncated: true, signal: "content", detail: "truncation pattern detected at end" };
  }

  const lastChar = trimmed[trimmed.length - 1];
  const secondLast = trimmed.length > 1 ? trimmed[trimmed.length - 2] : "";

  const sentenceEnders = [".", "!", "?", ":", ";"] as const;
  const blockEnders = ["}", "]", ")", "`", ">", "|"] as const;
  const isProperEnd = [...sentenceEnders, ...blockEnders].includes(lastChar as any);

  if (!isProperEnd) {
    const wordEnd = /[a-zA-Z0-9_]/;
    if (wordEnd.test(lastChar)) {
      const before = trimmed.slice(0, -50).trimEnd();
      const lastWordBreak = Math.max(before.lastIndexOf(" "), before.lastIndexOf("\n"));
      const trailing = trimmed.slice(lastWordBreak + 1);
      if (trailing.length > 1 && !/[.!?:;}\])`]/.test(secondLast)) {
        if (trimmed.length > 200) {
          return {
            truncated: true,
            signal: "content",
            detail: `ends mid-word/line: "...${trailing.slice(-30)}"`,
          };
        }
      }
    }

    if (lastChar === "," || lastChar === "-" || lastChar === "—" || lastChar === "(" || lastChar === "[" || lastChar === "{") {
      return { truncated: true, signal: "content", detail: `ends with hanging character '${lastChar}'` };
    }
  }

  return null;
}

export function detectStructuralTruncation(text: string): TruncationResult | null {
  if (!text || text.trim().length === 0) return null;

  const trimmed = text.trimEnd();

  const fencedBlocks = trimmed.match(/```/g);
  if (fencedBlocks && fencedBlocks.length % 2 !== 0) {
    return { truncated: true, signal: "structural", detail: "unclosed fenced code block" };
  }

  let braceCount = 0, bracketCount = 0, parenCount = 0, inString = false, escaped = false;
  for (const ch of trimmed) {
    if (escaped) { escaped = false; continue; }
    if (ch === "\\" && inString) { escaped = true; continue; }
    if (ch === '"' && !escaped) { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") braceCount++;
    else if (ch === "}") braceCount--;
    else if (ch === "[") bracketCount++;
    else if (ch === "]") bracketCount--;
    else if (ch === "(") parenCount++;
    else if (ch === ")") parenCount--;
  }
  if (braceCount > 0) {
    return { truncated: true, signal: "structural", detail: `unbalanced braces (+${braceCount})` };
  }
  if (bracketCount > 0) {
    return { truncated: true, signal: "structural", detail: `unbalanced brackets (+${bracketCount})` };
  }
  if (parenCount > 0) {
    return { truncated: true, signal: "structural", detail: `unbalanced parentheses (+${parenCount})` };
  }

  const tableLines = trimmed.split("\n").filter((l) => l.trim().startsWith("|"));
  if (tableLines.length > 1) {
    const lastLine = tableLines[tableLines.length - 1].trim();
    const parts = lastLine.split("|");
    const firstLine = tableLines[0].trim();
    const firstParts = firstLine.split("|");
    if (parts.length < firstParts.length) {
      return { truncated: true, signal: "structural", detail: "incomplete table row" };
    }
    const lastCell = parts[parts.length - 1]?.trim() ?? "";
    if (lastCell && !lastCell.endsWith("|")) {
      if (parts.length !== firstParts.length) {
        return { truncated: true, signal: "structural", detail: "dangling table cell" };
      }
    }
  }

  if (trimmed.endsWith("|") && !trimmed.endsWith("||")) {
    const beforePipe = trimmed.slice(0, -1).trimEnd();
    if (beforePipe.endsWith("|")) {
      return { truncated: true, signal: "structural", detail: "dangling pipe at end" };
    }
  }

  return null;
}

export function detectApiTruncation(
  finishReason: string | null | undefined,
  responseLength: number,
  minExpected?: number,
): TruncationResult | null {
  if (isLengthTruncated(finishReason)) {
    return {
      truncated: true,
      signal: "api",
      detail: `finish_reason=${finishReason}`,
      finishReason: finishReason ?? undefined,
    };
  }
  if (minExpected && responseLength < minExpected) {
    return {
      truncated: true,
      signal: "api",
      detail: `response too short (${responseLength} < ${minExpected})`,
      finishReason: finishReason ?? undefined,
    };
  }
  return null;
}

export function detectTruncation(
  text: string,
  finishReason?: string | null,
  opts?: { structural?: boolean; content?: boolean; minExpected?: number },
): TruncationResult {
  if (opts?.structural !== false) {
    const s = detectStructuralTruncation(text);
    if (s) return s;
  }
  if (opts?.content !== false) {
    const c = detectContentTruncation(text);
    if (c) return c;
  }
  const a = detectApiTruncation(finishReason, text.length, opts?.minExpected);
  if (a) return a;
  return { truncated: false, signal: "none", detail: "response appears complete" };
}

export function spliceContinuation(original: string, continuation: string): string {
  let cleaned = continuation.trim();

  if (cleaned.startsWith("```")) {
    const nl = cleaned.indexOf("\n", 3);
    cleaned = nl > 0 ? cleaned.slice(nl + 1) : cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3).trimEnd();

  cleaned = cleaned.replace(/^(ASSISTANT:|assistant:)\s*/i, "").trim();

  const orig = original.endsWith("\n") ? original : original + "\n";
  const lastNL = orig.lastIndexOf("\n", orig.length - 2);
  const lastLine = orig.slice(lastNL + 1, -1);

  if (cleaned.startsWith(lastLine.trim())) {
    const matchLen = lastLine.trim().length;
    const overlap = cleaned.slice(0, matchLen);
    if (overlap.trim() === lastLine.trim()) {
      return original + "\n" + cleaned.slice(matchLen).trimStart();
    }
  }

  return orig + cleaned;
}

export function findSpliceBoundary(text: string, maxLookback = 200): number {
  const len = text.length;
  const start = Math.max(0, len - maxLookback);
  const window = text.slice(start);

  const boundaries = [
    window.lastIndexOf("\n\n"),
    window.lastIndexOf("\n"),
    window.lastIndexOf(". "),
    window.lastIndexOf("; "),
    window.lastIndexOf("}"),
    window.lastIndexOf("]"),
    window.lastIndexOf("`"),
  ]
    .filter((i) => i >= 0)
    .sort((a, b) => b - a);

  if (boundaries.length > 0) {
    return start + boundaries[0];
  }

  return len;
}

export function smartSplice(original: string, continuation: string): string {
  const boundary = findSpliceBoundary(original);
  const head = original.slice(0, boundary + 1);
  const tail = continuation.trimStart();
  if (head.endsWith("\n") && tail.startsWith("\n")) {
    return head + tail.slice(1);
  }
  if (!head.endsWith("\n") && !tail.startsWith("\n")) {
    return head + "\n" + tail;
  }
  return head + tail;
}

export type ChunkResult<T> = {
  success: true;
  data: T;
  continuationRounds: number;
  truncated: boolean;
} | {
  success: false;
  error: string;
  partial: string;
  continuationRounds: number;
};

export async function generateWithContinuation(
  generateFn: () => Promise<{ text: string; finishReason?: string | null; model: string }>,
  opts: {
    tag: string;
    maxContinuationRounds?: number;
    minExpectedLength?: number;
    structuralCheck?: boolean;
    contentCheck?: boolean;
  },
): Promise<ChunkResult<string>> {
  const maxRounds = opts.maxContinuationRounds ?? 5;
  let accumulated = "";
  let lastModel = "";
  let totalRounds = 0;

  for (let round = 0; round <= maxRounds; round++) {
    const result = await generateFn();
    lastModel = result.model;
    const text = round === 0 ? result.text : result.text;
    accumulated = round === 0 ? text : spliceContinuation(accumulated, text);

    const detection = detectTruncation(accumulated, result.finishReason, {
      structural: opts.structuralCheck,
      content: opts.contentCheck,
      minExpected: opts.minExpectedLength,
    });

    totalRounds = round;

    if (!detection.truncated) {
      return {
        success: true,
        data: accumulated,
        continuationRounds: round,
        truncated: false,
      };
    }

    logContinuationEvent({
      tag: opts.tag,
      round,
      signal: detection.signal,
      originalLength: accumulated.length,
      continuationLength: text.length,
      model: lastModel,
    });

    if (round >= maxRounds) {
      return {
        success: true,
        data: accumulated,
        continuationRounds: round,
        truncated: true,
      };
    }
  }

  return {
    success: true,
    data: accumulated,
    continuationRounds: totalRounds,
    truncated: true,
  };
}

export interface AssemblyCheck {
  name: string;
  check: () => boolean | Promise<boolean>;
  detail: string;
}

export async function verifyAssembly(
  checks: AssemblyCheck[],
): Promise<{ passed: boolean; failures: { name: string; detail: string }[] }> {
  const failures: { name: string; detail: string }[] = [];
  for (const check of checks) {
    try {
      const passed = await check.check();
      if (!passed) failures.push({ name: check.name, detail: check.detail });
    } catch (e) {
      failures.push({ name: check.name, detail: `${check.detail}: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
  return { passed: failures.length === 0, failures };
}

export function honestFailureReport(
  deliverableType: string,
  failures: { name: string; detail: string }[],
  sessionSummary?: string,
): string {
  const parts: string[] = [
    `**${deliverableType} generation encountered issues.**`,
    "",
    "The following problems could not be automatically resolved:",
    ...failures.map((f, i) => `${i + 1}. **${f.name}** — ${f.detail}`),
  ];
  if (sessionSummary) {
    parts.push("", `_Session: ${sessionSummary}_`);
    parts.push("", "You can resume from the last checkpoint once capacity is available.");
  }
  return parts.join("\n");
}

export function isTruncated(text: string, minExpected?: number): boolean {
  return detectTruncation(text, null, { structural: true, content: true, minExpected }).truncated;
}

export function looksLikeTruncatedJson(text: string): boolean {
  if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) return false;
  return detectStructuralTruncation(text)?.detail.includes("brace") ?? false;
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
