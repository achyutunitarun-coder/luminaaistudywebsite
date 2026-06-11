/**
 * Lumina agentic actions — executed client-side from the AI chat.
 * Uses the server-side `agent-plan` edge function for LLM-based intent detection
 * (360° coverage with conversation context), then executes via the connector APIs.
 */

import { gmailApi, calendarApi, driveApi, notionApi, listConnections } from "@/lib/connectors/api";
import { supabase } from "@/integrations/supabase/client";
import { streamSSE } from "@/lib/aiStream";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const PLAN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-plan`;

export type AgentAction =
  | { kind: "send_email"; to: string; subject?: string; body?: string; instruction?: string }
  | { kind: "create_event"; title: string; start: string; end: string; description?: string }
  | { kind: "create_timetable"; blocks: Array<{ title: string; start: string; end: string }> }
  | { kind: "drive_create_doc"; title: string; content: string }
  | { kind: "notion_create_page"; title: string; content: string; parent_id?: string }
  | { kind: "drive_search"; query: string }
  | { kind: "drive_read"; file_id?: string; query?: string }
  | { kind: "notion_search"; query: string }
  | { kind: "notion_read"; page_id?: string; query?: string }
  | { kind: "gmail_search"; query: string }
  | { kind: "navigate"; path: string; label: string }
  | { kind: "artifact"; type: "notes" | "exam" | "slides" | "code"; topic: string };

export interface AgentPlan {
  kind: AgentAction["kind"] | "chat";
  params: Record<string, unknown>;
  summary: string;
  confirmation_required: boolean;
}

export interface AgentResult {
  ok: boolean;
  message: string;
}

function hasGoogleScope(scopes: string[] | undefined, service: "gmail" | "calendar" | "drive"): boolean {
  const joined = (scopes ?? []).join(" ");
  if (service === "gmail") return /gmail/.test(joined);
  if (service === "calendar") return /calendar/.test(joined);
  if (service === "drive") return /drive|documents/.test(joined);
  return false;
}

async function ensureGoogleService(service: "gmail" | "calendar" | "drive") {
  const conns = await listConnections();
  const google = conns.find((c) => c.provider === "google");
  if (!google || !hasGoogleScope(google.scopes, service)) {
    const label = service === "calendar" ? "Google Calendar" : service === "drive" ? "Google Drive" : "Gmail";
    throw new Error(`${label} is not connected with the required permission. Open Connectors, reconnect ${label}, and approve the permission screen.`);
  }
}

// ────────────── plan via edge function ──────────────

/**
 * Ask the LLM router to extract a structured action from natural language + chat history.
 * Returns `{ kind: "chat" }` when no agentic action applies.
 */
export async function planAction(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<AgentPlan> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return chatFallback();

    let connected = { google: false, notion: false, gmail: false, calendar: false, drive: false };
    try {
      const conns = await listConnections();
      const google = conns.find((c) => c.provider === "google");
      connected = {
        google: !!google,
        notion: conns.some((c) => c.provider === "notion"),
        gmail: !!google && hasGoogleScope(google.scopes, "gmail"),
        calendar: !!google && hasGoogleScope(google.scopes, "calendar"),
        drive: !!google && hasGoogleScope(google.scopes, "drive"),
      };
    } catch {}

    const res = await fetch(PLAN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        message,
        history: history.slice(-8),
        connected,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    if (!res.ok) return chatFallback();
    const j = await res.json();
    if (!j?.plan?.kind) return chatFallback();
    return j.plan as AgentPlan;
  } catch (e) {
    console.warn("[planAction] fell back to chat:", e);
    return chatFallback();
  }
}

function chatFallback(): AgentPlan {
  return { kind: "chat", params: {}, summary: "", confirmation_required: false };
}

/** Convert a validated AgentPlan into a strongly-typed AgentAction. Returns null if invalid. */
export function planToAction(plan: AgentPlan): AgentAction | null {
  const p = plan.params as any;
  switch (plan.kind) {
    case "send_email":
      if (!p?.to || typeof p.to !== "string") return null;
      return {
        kind: "send_email",
        to: p.to,
        subject: p.subject || undefined,
        body: p.body || undefined,
        instruction: p.instruction || undefined,
      };
    case "create_event":
      if (!p?.title || !p?.start || !p?.end) return null;
      return { kind: "create_event", title: p.title, start: p.start, end: p.end, description: p.description };
    case "create_timetable":
      if (!Array.isArray(p?.blocks) || p.blocks.length === 0) return null;
      return {
        kind: "create_timetable",
        blocks: p.blocks
          .filter((b: any) => b?.title && b?.start && b?.end)
          .map((b: any) => ({ title: String(b.title), start: String(b.start), end: String(b.end) })),
      };
    case "drive_create_doc":
      if (!p?.title) return null;
      return { kind: "drive_create_doc", title: p.title, content: p.content || "" };
    case "notion_create_page":
      if (!p?.title) return null;
      return { kind: "notion_create_page", title: p.title, content: p.content || "", parent_id: p.parent_id };
    case "drive_search":
      return { kind: "drive_search", query: String(p?.query ?? "") };
    case "drive_read":
      return { kind: "drive_read", file_id: p?.file_id, query: p?.query };
    case "notion_search":
      return { kind: "notion_search", query: String(p?.query ?? "") };
    case "notion_read":
      return { kind: "notion_read", page_id: p?.page_id, query: p?.query };
    case "gmail_search":
      return { kind: "gmail_search", query: String(p?.query ?? "") };
    case "navigate":
      if (!p?.path) return null;
      return { kind: "navigate", path: p.path, label: p.label || p.path };
    case "artifact":
      if (!p?.type || !p?.topic) return null;
      return { kind: "artifact", type: p.type, topic: p.topic };
    default:
      return null;
  }
}

// ────────────── AI-drafted email ──────────────

async function draftEmailWithAI(instruction: string, recipient: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("no_session");
    const sys =
      "You are Lumina, drafting a real email on the user's behalf. Output STRICT JSON only: " +
      `{"subject":"...","body":"..."}. Subject ≤ 80 chars. Body is plain text with \\n line breaks. ` +
      "Warm/personal for family/friends; professional otherwise. Sign off with first name only if obvious.";
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Recipient: ${recipient}\nInstruction: ${instruction}\n\nReturn only the JSON.` },
        ],
        mode: "conversational",
      }),
    });
    let full = "";
    await streamSSE(res, { onDelta: (c) => { full += c; } });
    const cleaned = full.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : cleaned);
    return {
      subject: String(parsed.subject || "").trim().slice(0, 200) || "A message for you",
      body: String(parsed.body || "").trim() || instruction,
    };
  } catch (e) {
    console.warn("[draftEmailWithAI] fallback:", e);
    return { subject: "A message for you", body: instruction };
  }
}

// ────────────── helpers ──────────────

function rfc2822Email(to: string, subject: string, body: string): string {
  const msg = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    "",
    body,
  ].join("\r\n");
  return btoa(unescape(encodeURIComponent(msg)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const USER_TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
})();

/**
 * Build a Google Calendar `EventDateTime`. Accepts naive local ISO
 * ("2026-06-09T09:00:00"), zoned ISO with offset, or Z-suffixed UTC.
 * Always attaches the user's IANA timeZone so wall-clock times land on the
 * intended day — fixes the "event created but invisible" bug caused by naive
 * datetimes being silently coerced to UTC.
 */
function calendarTime(iso: string): { dateTime: string; timeZone: string } {
  const input = String(iso || "").trim();
  const hasOffset = /[zZ]|[+-]\d{2}:?\d{2}$/.test(input);
  if (hasOffset) {
    const d = new Date(input);
    if (!Number.isNaN(d.getTime())) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
        timeZone: USER_TZ,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      }).formatToParts(d).map((p) => [p.type, p.value]));
      return { dateTime: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`, timeZone: USER_TZ };
    }
  }
  const wallTime = input.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?/);
  const clean = wallTime
    ? `${wallTime[1]}T${wallTime[2]}:${wallTime[3] ?? "00"}`
    : input.replace(/\.\d+$/, "").replace(/[zZ]|[+-]\d{2}:?\d{2}$/, "");
  const withSecs = /T\d{2}:\d{2}:\d{2}$/.test(clean)
    ? clean
    : /T\d{2}:\d{2}$/.test(clean) ? `${clean}:00` : clean;
  return { dateTime: withSecs, timeZone: USER_TZ };
}

async function createVerifiedCalendarEvent(event: Record<string, unknown>) {
  await ensureGoogleService("calendar");
  const created = await calendarApi.create(event);
  const data = created.data as any;
  const eventId = data?.id;
  if (!eventId) {
    throw new Error(`Google Calendar did not return an event ID: ${JSON.stringify(data).slice(0, 300)}`);
  }
  const verified = await calendarApi.get(eventId);
  const verifiedData = verified.data as any;
  if (!verifiedData?.id || verifiedData.status === "cancelled") {
    throw new Error(`Google Calendar could not verify the created event (${eventId}).`);
  }
  return verifiedData;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: USER_TZ });
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: USER_TZ });

// ────────────── executor ──────────────

export async function executeAgentAction(
  action: AgentAction,
  navigate?: (path: string) => void,
): Promise<AgentResult> {
  switch (action.kind) {
    case "send_email": {
      try {
        await ensureGoogleService("gmail");
        let subject = action.subject || "";
        let body = action.body || "";
        if (!subject || !body) {
          const drafted = await draftEmailWithAI(
            action.instruction || body || "Write a friendly message.",
            action.to,
          );
          subject = drafted.subject;
          body = drafted.body;
        }
        const raw = rfc2822Email(action.to, subject, body);
        await gmailApi.send(raw);
        return { ok: true, message: `✅ Email sent to **${action.to}**\n\n**Subject:** ${subject}\n\n${body}` };
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.includes("not_connected") || msg.includes("missing a required permission")) {
          return { ok: false, message: `Gmail isn't connected with send permission. Open **Connectors → Gmail** and approve "Send email".` };
        }
        return { ok: false, message: `Gmail returned an error: ${msg}` };
      }
    }
    case "create_event": {
      try {
        const event = await createVerifiedCalendarEvent({
          summary: action.title,
          description: action.description,
          start: calendarTime(action.start),
          end: calendarTime(action.end),
          reminders: { useDefault: true },
        });
        const link = event?.htmlLink;
        return {
          ok: true,
          message: `📅 Verified in Google Calendar: **${event.summary ?? action.title}** — ${fmtDate(action.start)} · ${fmtTime(action.start)} → ${fmtTime(action.end)} (${USER_TZ})${link ? `\n\n[Open in Google Calendar →](${link})` : ""}`,
        };
      } catch (e: any) {
        return { ok: false, message: `Calendar add failed: ${e?.message || e}` };
      }
    }
    case "create_timetable": {
      const lines: string[] = [];
      let okCount = 0;
      let lastLink: string | undefined;
      for (const b of action.blocks) {
        try {
          const event = await createVerifiedCalendarEvent({
            summary: b.title,
            start: calendarTime(b.start),
            end: calendarTime(b.end),
            reminders: { useDefault: true },
          });
          okCount++;
          lastLink = event?.htmlLink || lastLink;
          lines.push(`• **${fmtTime(b.start)} – ${fmtTime(b.end)}** — ${b.title}`);
        } catch (e: any) {
          lines.push(`• ❌ ${b.title} — ${e?.message || e}`);
        }
      }
      return {
        ok: okCount === action.blocks.length,
        message: `📅 **Timetable for ${fmtDate(action.blocks[0].start)}** (${USER_TZ}) — added ${okCount}/${action.blocks.length} blocks:\n\n${lines.join("\n")}${lastLink ? `\n\n[Open Google Calendar →](${lastLink})` : ""}`,
      };
    }
    case "drive_create_doc": {
      try {
        const r = await driveApi.createDoc(action.title, action.content);
        const url = (r.data as any)?.url;
        return { ok: true, message: `📄 Created Google Doc **${action.title}**${url ? `\n\n[Open document →](${url})` : ""}` };
      } catch (e: any) {
        return { ok: false, message: `Google Docs failed: ${e?.message || e}` };
      }
    }
    case "notion_create_page": {
      try {
        const r = await notionApi.createPage(action.title, action.content, action.parent_id);
        const url = (r.data as any)?.url;
        return { ok: true, message: `📝 Created Notion page **${action.title}**${url ? `\n\n[Open in Notion →](${url})` : ""}` };
      } catch (e: any) {
        return { ok: false, message: `Notion create failed: ${e?.message || e}` };
      }
    }
    case "drive_search": {
      try {
        const r = await driveApi.list(action.query);
        const files = r.data?.files ?? [];
        if (files.length === 0) return { ok: true, message: `No Drive files matched **${action.query}**.` };
        return {
          ok: true,
          message: `📂 **Drive results for "${action.query}":**\n\n` +
            files.map((f: any) => `• [${f.name}](${f.webViewLink}) — ${f.mimeType.split(".").pop()}`).join("\n"),
        };
      } catch (e: any) {
        return { ok: false, message: `Drive search failed: ${e?.message || e}` };
      }
    }
    case "drive_read": {
      try {
        let fileId = action.file_id;
        let name = "file";
        if (!fileId && action.query) {
          const r = await driveApi.list(action.query);
          const first = r.data?.files?.[0];
          if (!first) return { ok: true, message: `No Drive file matched **${action.query}**.` };
          fileId = first.id; name = first.name;
        }
        if (!fileId) return { ok: false, message: "Need a file_id or query." };
        let text = "";
        try {
          const r = await driveApi.export(fileId, "text/plain");
          text = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
        } catch {
          const r = await driveApi.download(fileId);
          text = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
        }
        return { ok: true, message: `📄 **${name}**\n\n${text.slice(0, 4000)}${text.length > 4000 ? "\n\n…(truncated)" : ""}` };
      } catch (e: any) {
        return { ok: false, message: `Drive read failed: ${e?.message || e}` };
      }
    }
    case "notion_search": {
      try {
        const r = await notionApi.search(action.query);
        const pages = (r.data?.results ?? []).filter((p: any) => p.object === "page");
        if (pages.length === 0) return { ok: true, message: `No Notion pages matched **${action.query}**.` };
        return {
          ok: true,
          message: `📝 **Notion results for "${action.query}":**\n\n` +
            pages.slice(0, 8).map((p: any) => {
              const title = p.properties?.title?.title?.[0]?.plain_text
                || p.properties?.Name?.title?.[0]?.plain_text
                || "Untitled";
              return `• [${title}](${p.url})`;
            }).join("\n"),
        };
      } catch (e: any) {
        return { ok: false, message: `Notion search failed: ${e?.message || e}` };
      }
    }
    case "notion_read": {
      try {
        let pageId = action.page_id;
        let title = "page";
        if (!pageId && action.query) {
          const r = await notionApi.search(action.query);
          const first = (r.data?.results ?? []).find((p: any) => p.object === "page");
          if (!first) return { ok: true, message: `No Notion page matched **${action.query}**.` };
          pageId = first.id;
          title = first.properties?.title?.title?.[0]?.plain_text || "Untitled";
        }
        if (!pageId) return { ok: false, message: "Need a page_id or query." };
        const r = await notionApi.blocks(pageId);
        const text = (r.data?.results ?? []).map((b: any) => {
          const rich = b[b.type]?.rich_text ?? [];
          return rich.map((t: any) => t.plain_text).join("");
        }).filter(Boolean).join("\n");
        return { ok: true, message: `📝 **${title}**\n\n${text.slice(0, 4000)}${text.length > 4000 ? "\n\n…(truncated)" : ""}` };
      } catch (e: any) {
        return { ok: false, message: `Notion read failed: ${e?.message || e}` };
      }
    }
    case "gmail_search": {
      try {
        const r = await gmailApi.search(action.query, 8);
        const ids = (r.data?.messages ?? []).slice(0, 5);
        if (ids.length === 0) return { ok: true, message: `No Gmail messages matched **${action.query}**.` };
        const previews: string[] = [];
        for (const m of ids) {
          try {
            const msg = await gmailApi.get(m.id);
            const headers = (msg.data as any)?.payload?.headers ?? [];
            const subj = headers.find((h: any) => h.name === "Subject")?.value || "(no subject)";
            const from = headers.find((h: any) => h.name === "From")?.value || "";
            const snippet = (msg.data as any)?.snippet || "";
            previews.push(`• **${subj}** — _${from}_\n  ${snippet.slice(0, 180)}`);
          } catch {}
        }
        return { ok: true, message: `📧 **Gmail results for "${action.query}":**\n\n${previews.join("\n\n")}` };
      } catch (e: any) {
        return { ok: false, message: `Gmail search failed: ${e?.message || e}` };
      }
    }
    case "navigate": {
      if (navigate) navigate(action.path);
      return { ok: true, message: `🧭 Opening **${action.label}**…` };
    }
    case "artifact": {
      // Artifact execution is handled by ChatPage.runArtifact — the planner just identifies intent.
      return { ok: true, message: `Generating ${action.type} on **${action.topic}**…` };
    }
  }
}

/**
 * User-friendly confirmation card details for a pending action.
 */
export function describeAction(action: AgentAction): { title: string; details: string[] } {
  switch (action.kind) {
    case "send_email":
      return {
        title: "Send email",
        details: [
          `To: ${action.to}`,
          action.subject ? `Subject: ${action.subject}` : "Subject: (Lumina will draft)",
          action.body ? `Body: ${action.body.slice(0, 200)}${action.body.length > 200 ? "…" : ""}` :
            action.instruction ? `Instruction: ${action.instruction.slice(0, 200)}` : "Body: (Lumina will draft)",
        ],
      };
    case "create_event":
      return {
        title: "Add calendar event",
        details: [
          `Title: ${action.title}`,
          `When: ${fmtDate(action.start)} · ${fmtTime(action.start)} – ${fmtTime(action.end)}`,
        ],
      };
    case "create_timetable":
      return {
        title: `Add ${action.blocks.length} calendar events`,
        details: [
          `Day: ${fmtDate(action.blocks[0].start)}`,
          ...action.blocks.slice(0, 6).map((b) => `${fmtTime(b.start)}–${fmtTime(b.end)} · ${b.title}`),
          ...(action.blocks.length > 6 ? [`…and ${action.blocks.length - 6} more`] : []),
        ],
      };
    case "drive_create_doc":
      return {
        title: "Create Google Doc",
        details: [`Title: ${action.title}`, `Length: ${action.content.length} chars`],
      };
    case "notion_create_page":
      return {
        title: "Create Notion page",
        details: [`Title: ${action.title}`, `Length: ${action.content.length} chars`],
      };
    default:
      return { title: "Run action", details: [action.kind] };
  }
}

/** Whether this action mutates external state (and should prompt confirmation). */
export function actionRequiresConfirmation(action: AgentAction): boolean {
  return [
    "send_email", "create_event", "create_timetable",
    "drive_create_doc", "notion_create_page",
  ].includes(action.kind);
}
