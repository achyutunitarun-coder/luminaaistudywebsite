// Lumina Agent Planner — LLM-based 360° intent detection.
// Uses Lovable AI Gateway (gemini-3-flash) with structured JSON output to extract
// concrete tool calls from natural language + recent conversation context.
//
// POST { message, history?: [{role,content}], connected: {google,notion,gmail,calendar,drive}, route? }
//   → { plan: { kind, params, summary, confirmation_required, fallback_chat? } }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const j = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `You are Lumina's Agent Router — a high-IQ intent classifier and parameter extractor.

You decide, for every user message, EXACTLY ONE of these action kinds:

CONNECTOR ACTIONS (require user confirmation):
- send_email       params: { to: string, instruction: string, subject?: string, body?: string }
- create_event     params: { title: string, start: ISO8601, end: ISO8601, description?: string }
- create_timetable params: { blocks: [{ title, start: ISO8601, end: ISO8601 }] }
- drive_create_doc params: { title: string, content: string }       (creates a Google Doc)
- notion_create_page params: { title: string, content: string, parent_id?: string }
- drive_search     params: { query: string }
- drive_read       params: { file_id?: string, query?: string }
- notion_search    params: { query: string }
- notion_read      params: { page_id?: string, query?: string }
- gmail_search     params: { query: string }   (e.g. "from:mom subject:trip")

NAVIGATION:
- navigate         params: { path: string, label: string }
   Valid paths: /dashboard /chat /tests /flashcards /doubt-solver /quest /weakness-radar
   /study-planner /notes-generator /quick-study /guided-lesson /lecture-ai /smart-notebook
   /resources /leaderboard /performance /squad /hub /computer /documents /connectors
   /settings /upgrade /artifact-gallery

ARTIFACT GENERATION (no confirmation needed):
- artifact         params: { type: "notes"|"exam"|"slides"|"code", topic: string }

ARTIFACT INTENT COVERAGE:
- Pick artifact when the user asks to create/build/make/generate/design/produce/render/export/open any self-contained output:
  notes, study guides, revision sheets, cheat sheets, worksheets, quizzes, question banks, exam packs,
  slides/decks/presentations, websites, apps, games, dashboards, calculators, simulators, visualizers,
  playgrounds, interactive demos, HTML files, UI mockups, frontend designs, one-pagers, mind maps, concept maps.
- type=code for interactive/runnable/frontend/UI/game/tool/dashboard/simulator/calculator/website/app/playground requests.
- type=slides for presentation/deck/PPT/keynote/class lecture requests.
- type=exam for exam/test/worksheet/quiz/question-bank/mark-scheme requests.
- type=notes for study guide/notes/cheat sheet/infographic/mind map/concept map/one-pager requests.
- The topic is the deliverable subject, preserving adjectives like "premium", "Apple-level", "frontend design" when relevant.

CONNECTOR INTENT COVERAGE:
- Gmail: send/draft/email/message/reply/search inbox/find email/read email.
- Calendar: schedule/book/add/create event/create timetable/remind/plan blocks/put in calendar.
- Drive/Docs: create Google Doc/save to Drive/search Drive/find file/read file/summarize document.
- Notion: create page/save to Notion/search Notion/read Notion page.
- Mutating connector actions ALWAYS require confirmation. Search/read actions do not.
- If the user gives enough information, extract the action even if phrased casually ("put my physics plan tomorrow 9-5 in calendar", "make a doc for this", "save this in Notion").

FALLBACK:
- chat             params: {}   (regular conversation, Q&A, explanations)

RULES:
1. Use conversation HISTORY to resolve references. If the user says "add them to my calendar"
   and the assistant just listed a timetable, EXTRACT those time-blocks and emit create_timetable
   with concrete datetimes (use TODAY's date if none specified, TOMORROW if user says tomorrow).
2. CRITICAL — datetimes for create_event / create_timetable must be NAIVE LOCAL ISO in the
   user's timezone, WITHOUT any "Z" or "+HH:MM" offset. Example: "2026-06-09T09:00:00".
   The client attaches the IANA timeZone itself. NEVER emit UTC ("Z") — it will land on the
   wrong day for the user. If the user says "9 AM tomorrow", emit "<tomorrow's date>T09:00:00".
3. For emails, if the user didn't write the body verbatim, leave subject/body empty and pass the
   raw instruction — the executor will draft it.
4. confirmation_required = true for ALL connector actions (email, calendar, drive create,
   notion create). false for read/search and chat/artifact/navigate.
5. summary: ONE friendly sentence describing what you'll do, e.g. "Add 6 study blocks to your Google Calendar tomorrow 9 AM – 5 PM."
6. If the user clearly wants a complex artifact (notes/exam/slides/code/app/game/UI/tool/dashboard), pick artifact + type.
7. If the action requires a connector/service the user hasn't connected, set kind = "chat" and explain
   in summary that they need to connect that exact service.
8. NEVER invent emails the user didn't mention.
9. Be aggressive: 360° coverage. If there's any plausible structured action, extract it. Only
   fall back to "chat" for pure Q&A, explanations, definitions, opinions, and ambiguous requests.

Return STRICT JSON only, no markdown fences.`;

const TODAY_ISO = () => new Date().toISOString();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return j(401, { error: "unauthorized" });

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return j(401, { error: "unauthorized" });

    const { message, history = [], connected = { google: false, notion: false }, timezone } =
      await req.json();
    if (!message || typeof message !== "string") return j(400, { error: "message required" });

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return j(500, { error: "missing_lovable_key" });

    const ctxHistory = (Array.isArray(history) ? history : [])
      .slice(-8)
      .map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? "").slice(0, 2000),
      }));

    // Compute today/tomorrow as wall-clock dates IN THE USER'S TIMEZONE
    // (so "tomorrow 9 AM" resolves to their tomorrow, not UTC tomorrow).
    let localToday = new Date().toISOString().slice(0, 10);
    let localTomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
    let localNow = new Date().toISOString().slice(0, 19);
    if (timezone && typeof timezone === "string") {
      try {
        const fmt = new Intl.DateTimeFormat("en-CA", {
          timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
        });
        const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
        localToday = `${parts.year}-${parts.month}-${parts.day}`;
        const [y, mo, d] = localToday.split("-").map(Number);
        const t = new Date(Date.UTC(y, mo - 1, d + 1, 12, 0, 0));
        const partsT = Object.fromEntries(fmt.formatToParts(t).map((p) => [p.type, p.value]));
        localTomorrow = `${partsT.year}-${partsT.month}-${partsT.day}`;
        localNow = `${localToday}T${parts.hour}:${parts.minute}:${parts.second}`;
      } catch {}
    }

    const userBlock =
      `LOCAL NOW (naive, user's tz): ${localNow}\n` +
      `TODAY (user's tz): ${localToday}\n` +
      `TOMORROW (user's tz): ${localTomorrow}\n` +
      `USER TIMEZONE: ${timezone ?? "unknown"}\n` +
      `CONNECTED SERVICES: google=${connected.google ? "yes" : "no"}, gmail=${connected.gmail ? "yes" : "no"}, calendar=${connected.calendar ? "yes" : "no"}, drive=${connected.drive ? "yes" : "no"}, notion=${connected.notion ? "yes" : "no"}\n\n` +
      `USER MESSAGE:\n${message}\n\n` +
      `Reminder: datetimes for calendar actions MUST be naive local ISO like "${localTomorrow}T09:00:00" — no Z, no offset.\n` +
      `Return JSON: { "kind": "...", "params": {...}, "summary": "...", "confirmation_required": bool }`;

    const orKey = Deno.env.get("OPENROUTER_API_KEY") ?? Deno.env.get("OPENROUTER_KEY_2") ?? "";
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${orKey || key}`,
        "HTTP-Referer": "https://luminaai.co.in",
        "X-Title": "Lumina AI",
      },
      body: JSON.stringify({
        model: "openrouter/owl-alpha",
        messages: [
          { role: "system", content: SYSTEM },
          ...ctxHistory,
          { role: "user", content: userBlock },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text().catch(() => "");
      return j(aiRes.status, { error: "ai_planner_failed", detail: txt.slice(0, 500) });
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let plan: any = { kind: "chat", params: {}, summary: "", confirmation_required: false };
    try {
      plan = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
    } catch {
      // Try to recover JSON from fenced or partial content
      const m = String(raw).match(/\{[\s\S]*\}/);
      if (m) {
        try { plan = JSON.parse(m[0]); } catch {}
      }
    }

    // Sanitize
    const validKinds = new Set([
      "chat", "send_email", "create_event", "create_timetable",
      "drive_create_doc", "notion_create_page", "drive_search", "drive_read",
      "notion_search", "notion_read", "gmail_search", "navigate", "artifact",
    ]);
    if (!validKinds.has(plan.kind)) plan.kind = "chat";
    plan.params = plan.params && typeof plan.params === "object" ? plan.params : {};
    plan.summary = String(plan.summary ?? "").slice(0, 500);
    plan.confirmation_required = !!plan.confirmation_required;

    const needsGoogle = ["send_email", "create_event", "create_timetable", "drive_create_doc", "drive_search", "drive_read", "gmail_search"];
    const missingCalendar = ["create_event", "create_timetable"].includes(plan.kind) && !connected.calendar;
    const missingGmail = ["send_email", "gmail_search"].includes(plan.kind) && !connected.gmail;
    const missingDrive = ["drive_create_doc", "drive_search", "drive_read"].includes(plan.kind) && !connected.drive;
    const missingNotion = ["notion_create_page", "notion_search", "notion_read"].includes(plan.kind) && !connected.notion;
    if ((needsGoogle.includes(plan.kind) && !connected.google) || missingCalendar || missingGmail || missingDrive || missingNotion) {
      const service = missingCalendar ? "Google Calendar" : missingGmail ? "Gmail" : missingDrive ? "Google Drive" : missingNotion ? "Notion" : "Google";
      plan = {
        kind: "chat",
        params: {},
        summary: `${service} is not connected with the required permission. Open Connectors, reconnect ${service}, and approve the permission screen.`,
        confirmation_required: false,
      };
    }

    return j(200, { plan });
  } catch (e) {
    return j(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
