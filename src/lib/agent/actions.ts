/**
 * Lumina agentic actions — executed client-side from the AI chat.
 * Detects high-confidence intents (send email, create calendar event/timetable,
 * navigate, create task) and runs them through the existing connector APIs.
 *
 * Returns a result that ChatPage can render as an assistant confirmation,
 * or `null` when no agentic intent applies (chat falls through to the LLM).
 */

import { gmailApi, calendarApi } from "@/lib/connectors/api";
import { supabase } from "@/integrations/supabase/client";
import { streamSSE } from "@/lib/aiStream";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

/**
 * Ask Lumina to draft a real subject + body from an instruction.
 * Falls back to the raw instruction if anything goes wrong.
 */
async function draftEmailWithAI(
  instruction: string,
  recipient: string,
): Promise<{ subject: string; body: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("no_session");

    const sys =
      "You are Lumina, drafting a real email on the user's behalf. " +
      "Given an instruction, produce a polished, sincere email — appropriate tone, natural human phrasing, no AI tells, no preamble. " +
      "Output STRICT JSON only, no markdown fences, no commentary: " +
      `{"subject":"...","body":"..."} ` +
      "Subject ≤ 80 chars. Body is plain text with real line breaks (\\n). " +
      "If the recipient is a family member or friend, use a warm personal tone. " +
      "Sign off with the user's first name only if obvious, otherwise no signature.";

    const userMsg =
      `Recipient: ${recipient}\nInstruction: ${instruction}\n\nReturn only the JSON.`;

    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userMsg },
        ],
        mode: "conversational",
      }),
    });
    if (!res.ok) throw new Error(`chat ${res.status}`);

    let full = "";
    await streamSSE(res, { onDelta: (c) => { full += c; } });

    const cleaned = full
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("no_json");
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const subject = String(parsed.subject || "").trim().slice(0, 200);
    const body = String(parsed.body || "").trim();
    if (!subject || !body) throw new Error("empty_draft");
    return { subject, body };
  } catch (e) {
    console.warn("[draftEmailWithAI] falling back to raw:", e);
    return {
      subject: "A message for you",
      body: instruction,
    };
  }
}

export type AgentAction =
  | { kind: "send_email"; to: string; subject: string; body: string; instruction?: string; draft?: boolean }
  | { kind: "create_event"; title: string; start: Date; end: Date; description?: string }
  | { kind: "create_timetable"; blocks: Array<{ title: string; start: Date; end: Date }> }
  | { kind: "navigate"; path: string; label: string }
  | { kind: "create_task"; title: string; when?: Date };

export interface AgentResult {
  ok: boolean;
  message: string;
}

// ───────────── helpers ─────────────

function rfc2822Email(to: string, subject: string, body: string): string {
  const msg = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    "",
    body,
  ].join("\r\n");
  // base64url
  return btoa(unescape(encodeURIComponent(msg)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function parseTimeOfDay(s: string): { h: number; m: number } | null {
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

function nextDateFor(when: string): Date {
  const now = new Date();
  const d = new Date(now);
  const lower = when.toLowerCase();
  if (lower.includes("tomorrow")) d.setDate(d.getDate() + 1);
  else if (lower.includes("tonight")) { /* today */ }
  return d;
}

// ───────────── intent detection ─────────────

const NAV_ROUTES: Array<{ keywords: RegExp; path: string; label: string }> = [
  { keywords: /\b(dashboard|home)\b/i, path: "/", label: "Dashboard" },
  { keywords: /\b(tests?|exam(s)?)\b/i, path: "/tests", label: "Tests" },
  { keywords: /\b(flashcards?)\b/i, path: "/flashcards", label: "Flashcards" },
  { keywords: /\b(doubt(s)?|doubt\s*solver)\b/i, path: "/doubt-solver", label: "Doubt Solver" },
  { keywords: /\b(quest|games?)\b/i, path: "/quest", label: "Quest" },
  { keywords: /\b(weakness|radar)\b/i, path: "/weakness-radar", label: "Weakness Radar" },
  { keywords: /\b(study\s*planner|planner|timetable)\b/i, path: "/study-planner", label: "Study Planner" },
  { keywords: /\b(notes?\s*generator|generate\s*notes)\b/i, path: "/notes-generator", label: "Notes Generator" },
  { keywords: /\b(quick\s*study)\b/i, path: "/quick-study", label: "Quick Study" },
  { keywords: /\b(guided\s*lesson)\b/i, path: "/guided-lesson", label: "Guided Lesson" },
  { keywords: /\b(lecture\s*ai|lecture)\b/i, path: "/lecture-ai", label: "Lecture AI" },
  { keywords: /\b(smart\s*notebook)\b/i, path: "/smart-notebook", label: "Smart Notebook" },
  { keywords: /\b(resources)\b/i, path: "/resources", label: "Resources" },
  { keywords: /\b(leaderboard)\b/i, path: "/leaderboard", label: "Leaderboard" },
  { keywords: /\b(performance|analytics)\b/i, path: "/performance", label: "Performance" },
  { keywords: /\b(squad)\b/i, path: "/squad", label: "Study Squads" },
  { keywords: /\b(brain\s*hub|hub|lumina\s*hub)\b/i, path: "/hub", label: "Lumina Hub" },
  { keywords: /\b(lumina\s*computer|computer|agentic)\b/i, path: "/computer", label: "Lumina Computer" },
  { keywords: /\b(documents?)\b/i, path: "/documents", label: "Documents" },
  { keywords: /\b(connectors?)\b/i, path: "/connectors", label: "Connectors" },
  { keywords: /\b(settings?)\b/i, path: "/settings", label: "Settings" },
  { keywords: /\b(upgrade|pricing|plans?)\b/i, path: "/upgrade", label: "Upgrade" },
];

export function detectAgentAction(text: string): AgentAction | null {
  const t = text.trim();
  if (!t) return null;
  const low = t.toLowerCase();

  // ─────────── 1. Send email ───────────
  // Triggers: "send/email/mail/write/draft/compose/shoot/fire off ... to <email>"
  //           OR "<verb> an email/message ... saying/about/regarding ..."
  const emailVerbRx = /\b(send|email|mail|write|draft|compose|shoot|fire\s*off|reply|respond)\b/i;
  const hasEmailAddr = /([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})/i.test(t);
  const mentionsEmail = /\b(email|gmail|mail|message|inbox)\b/i.test(t);
  if (emailVerbRx.test(t) && (hasEmailAddr || mentionsEmail)) {
    const toMatch = t.match(/([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})/i);
    if (toMatch) {
      const to = toMatch[1];
      const subjMatch = t.match(/(?:subject:|about|regarding|re:|titled)\s*["“']?([^"”'\n]+?)["”']?(?:\s+(?:saying|body:|with body|that says|content:|message:|telling them|asking|and (?:say|tell))|[.!?]|$)/i);
      const bodyMatch = t.match(/(?:saying|body:|content:|message:|telling them|that says|and (?:say|tell)(?:\s+(?:him|her|them))?)\s*["“']?([\s\S]+?)["”']?$/i);
      const subject = (subjMatch?.[1] || "Message from Lumina").trim().slice(0, 200);
      const body = (bodyMatch?.[1] || subjMatch?.[1] || t.replace(toMatch[0], "").trim()).trim();
      return { kind: "send_email", to, subject, body };
    }
  }

  // ─────────── 2. Timetable / study plan ───────────
  if (/\b(create|make|build|generate|plan|set\s*up|put\s*together)\b.*\b(timetable|schedule|study\s*plan|study\s*timetable|revision\s*plan|daily\s*plan|weekly\s*plan)\b/i.test(t)
      || /^\s*(timetable|schedule|study\s*plan)\s+(for|covering|with)\b/i.test(t)) {
    const range = t.match(/from\s+([\d:apm\s]+?)\s+to\s+([\d:apm\s]+?)(?:\s|$|[.,])/i);
    const start = parseTimeOfDay(range?.[1] || "9am") ?? { h: 9, m: 0 };
    const end = parseTimeOfDay(range?.[2] || "5pm") ?? { h: 17, m: 0 };
    const subjMatch = t.match(/(?:for|covering|with subjects?|including|on)\s+([^.]+?)(?:\s+from\b|\s+between\b|$)/i);
    const subjects = (subjMatch?.[1] || "")
      .split(/,| and | & /i).map(s => s.trim()).filter(Boolean);
    const base = nextDateFor(low.includes("tomorrow") ? "tomorrow" : "today");
    base.setSeconds(0, 0);
    const totalMinutes = Math.max(60, (end.h * 60 + end.m) - (start.h * 60 + start.m));
    const slots = Math.max(1, Math.min(8, subjects.length || 4));
    const slotLen = Math.max(30, Math.floor(totalMinutes / slots));
    const blocks: Array<{ title: string; start: Date; end: Date }> = [];
    for (let i = 0; i < slots; i++) {
      const s = new Date(base);
      s.setHours(start.h, start.m + i * slotLen, 0, 0);
      const e = new Date(s);
      e.setMinutes(s.getMinutes() + slotLen - 5);
      blocks.push({ title: subjects[i] || `Study Block ${i + 1}`, start: s, end: e });
    }
    return { kind: "create_timetable", blocks };
  }

  // ─────────── 3. Single calendar event / reminder ───────────
  const eventRx = /\b(add|schedule|create|set|put|book)\b.*\b(event|meeting|reminder|study\s*block|session|class|appointment|call|exam)\b/i;
  const remindRx = /\b(remind me|set (?:a )?reminder|add to (?:my )?calendar|put (?:in|on) (?:my )?calendar)\b/i;
  if (eventRx.test(t) || remindRx.test(t)) {
    const time = parseTimeOfDay(t) ?? { h: 18, m: 0 };
    const base = nextDateFor(low.includes("tomorrow") ? "tomorrow" : "today");
    base.setHours(time.h, time.m, 0, 0);
    const end = new Date(base); end.setHours(end.getHours() + 1);
    const titleMatch = t.match(/(?:for|about|titled|called|named|to)\s+["“']?([^"”'\n]+?)["”']?(?:\s+(?:at|on|tomorrow|today|by)|[.!?]|$)/i);
    const title = (titleMatch?.[1] || "Study Block").trim();
    return { kind: "create_event", title, start: base, end };
  }

  // ─────────── 4. Task creation ───────────
  if (/\b(add|create|make)\b.*\b(task|todo|to-do|to do)\b/i.test(t)) {
    const titleMatch = t.match(/(?:task|todo|to-do|to do)\s*(?:to|:|called|named)?\s*["“']?([^"”'\n]+?)["”']?(?:\s+(?:at|on|by|tomorrow|today)|[.!?]|$)/i);
    const title = (titleMatch?.[1] || "New task").trim();
    const time = parseTimeOfDay(t);
    const when = time ? (() => { const d = nextDateFor(low.includes("tomorrow") ? "tomorrow" : "today"); d.setHours(time.h, time.m, 0, 0); return d; })() : undefined;
    return { kind: "create_task", title, when };
  }

  // ─────────── 5. Navigation ───────────
  // Triggers: "go/open/take me/show me/jump/navigate to X", "/X please", "head over to X"
  if (/\b(go|navigate|open|take me|show me|jump|head|bring me|launch)\b.*\b(to|into|over)\b/i.test(t)
      || /^(open|show|launch)\s+/i.test(t)) {
    const hit = NAV_ROUTES.find(r => r.keywords.test(t));
    if (hit) return { kind: "navigate", path: hit.path, label: hit.label };
  }

  return null;
}


// ───────────── executor ─────────────

export async function executeAgentAction(
  action: AgentAction,
  navigate?: (path: string) => void,
): Promise<AgentResult> {
  switch (action.kind) {
    case "send_email": {
      try {
        const raw = rfc2822Email(action.to, action.subject, action.body);
        await gmailApi.send(raw);
        return { ok: true, message: `✅ Email sent to **${action.to}**\n\n**Subject:** ${action.subject}\n\n${action.body}` };
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.includes("not_connected") || msg.includes("missing a required permission")) {
          return { ok: false, message: `I couldn't send that email — Gmail isn't connected with send permission. Go to **Connectors → Gmail** and reconnect with the "Send email" scope, then try again.` };
        }
        return { ok: false, message: `I tried to send the email but Gmail returned an error: ${msg}` };
      }
    }
    case "create_event": {
      try {
        await calendarApi.create({
          summary: action.title,
          description: action.description,
          start: { dateTime: action.start.toISOString() },
          end: { dateTime: action.end.toISOString() },
        });
        return { ok: true, message: `📅 Added **${action.title}** to your Google Calendar — ${action.start.toLocaleString()} → ${action.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` };
      } catch (e: any) {
        return { ok: false, message: `Calendar add failed: ${e?.message || e}. Reconnect Google Calendar from Connectors.` };
      }
    }
    case "create_timetable": {
      const lines: string[] = [];
      let okCount = 0;
      for (const b of action.blocks) {
        try {
          await calendarApi.create({
            summary: b.title,
            start: { dateTime: b.start.toISOString() },
            end: { dateTime: b.end.toISOString() },
          });
          okCount++;
          lines.push(`• **${b.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${b.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}** — ${b.title}`);
        } catch (e: any) {
          lines.push(`• ❌ ${b.title} — ${e?.message || e}`);
        }
      }
      const ok = okCount === action.blocks.length;
      return {
        ok,
        message: `📅 **Timetable for ${action.blocks[0]?.start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}**\n\nAdded ${okCount}/${action.blocks.length} blocks to Google Calendar:\n\n${lines.join("\n")}`,
      };
    }
    case "create_task": {
      // Tasks API not yet wired — represent as calendar event for now
      const end = new Date(action.when || new Date());
      end.setMinutes(end.getMinutes() + 30);
      try {
        await calendarApi.create({
          summary: `[Task] ${action.title}`,
          start: { dateTime: (action.when || new Date()).toISOString() },
          end: { dateTime: end.toISOString() },
        });
        return { ok: true, message: `✅ Task **${action.title}** added to your calendar.` };
      } catch (e: any) {
        return { ok: false, message: `Couldn't create task: ${e?.message || e}` };
      }
    }
    case "navigate": {
      if (navigate) navigate(action.path);
      return { ok: true, message: `🧭 Opening **${action.label}**…` };
    }
  }
}
