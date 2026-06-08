/**
 * Lumina agentic actions — executed client-side from the AI chat.
 * Detects high-confidence intents (send email, create calendar event/timetable,
 * navigate, create task) and runs them through the existing connector APIs.
 *
 * Returns a result that ChatPage can render as an assistant confirmation,
 * or `null` when no agentic intent applies (chat falls through to the LLM).
 */

import { gmailApi, calendarApi } from "@/lib/connectors/api";

export type AgentAction =
  | { kind: "send_email"; to: string; subject: string; body: string }
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
  const low = t.toLowerCase();

  // Send email
  const sendEmail = /^(send|write|compose|draft|email|mail)\b.*\b(to|@)\b/i.test(t) &&
    /@/.test(t);
  if (sendEmail) {
    const toMatch = t.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
    if (toMatch) {
      const to = toMatch[1];
      // Subject: after "about" / "subject:" / "saying"
      const subjMatch = t.match(/(?:subject:|about|regarding|re:)\s*["“']?([^"”'\n]+?)["”']?(?:\s+(?:saying|body:|with body|that says|content:|message:|telling them)|[.!?]|$)/i);
      const bodyMatch = t.match(/(?:saying|body:|content:|message:|telling them|that says)\s*["“']?([\s\S]+?)["”']?$/i);
      const subject = (subjMatch?.[1] || "Message from Lumina").trim().slice(0, 200);
      const body = (bodyMatch?.[1] || subjMatch?.[1] || t).trim();
      return { kind: "send_email", to, subject, body };
    }
  }

  // Calendar timetable
  if (/\b(create|make|build|generate)\b.*\b(timetable|schedule|study\s*plan)\b/i.test(t)) {
    // Parse "from 9am to 5pm" range, otherwise default 9-17
    const range = t.match(/from\s+([\d:apm]+)\s+to\s+([\d:apm]+)/i);
    const start = parseTimeOfDay(range?.[1] || "9am") ?? { h: 9, m: 0 };
    const end = parseTimeOfDay(range?.[2] || "5pm") ?? { h: 17, m: 0 };
    const subjects = (t.match(/(?:for|covering|with subjects?)\s+([^.]+)$/i)?.[1] || "")
      .split(/,| and /i).map(s => s.trim()).filter(Boolean);
    const base = nextDateFor(low.includes("tomorrow") ? "tomorrow" : "today");
    base.setSeconds(0, 0);
    const totalMinutes = (end.h * 60 + end.m) - (start.h * 60 + start.m);
    const slots = Math.max(1, subjects.length || 4);
    const slotLen = Math.max(30, Math.floor(totalMinutes / slots));
    const blocks: AgentAction extends infer A ? A extends { kind: "create_timetable" } ? A["blocks"] : never : never = [];
    for (let i = 0; i < slots; i++) {
      const s = new Date(base);
      s.setHours(start.h, start.m + i * slotLen, 0, 0);
      const e = new Date(s);
      e.setMinutes(s.getMinutes() + slotLen - 5);
      blocks.push({ title: subjects[i] || `Study Block ${i + 1}`, start: s, end: e });
    }
    return { kind: "create_timetable", blocks };
  }

  // Single calendar event / task
  const eventMatch = t.match(/\b(add|schedule|create|set)\b.*\b(event|meeting|reminder|study\s*block|session)\b\s+(?:for|at|on)?\s*([\s\S]+)/i);
  if (eventMatch || /\b(remind me|add to (my )?calendar)\b/i.test(t)) {
    const time = parseTimeOfDay(t) ?? { h: 18, m: 0 };
    const base = nextDateFor(low.includes("tomorrow") ? "tomorrow" : "today");
    base.setHours(time.h, time.m, 0, 0);
    const end = new Date(base); end.setHours(end.getHours() + 1);
    const titleMatch = t.match(/(?:for|about|titled|called|named)\s+["“']?([^"”'\n]+?)["”']?(?:\s+(?:at|on|tomorrow|today)|[.!?]|$)/i);
    const title = (titleMatch?.[1] || "Study Block").trim();
    return { kind: "create_event", title, start: base, end };
  }

  // Navigation
  if (/^(go|navigate|open|take me|show me|jump)\s+(to|into)?\b/i.test(t)) {
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
