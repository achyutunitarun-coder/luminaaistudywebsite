import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { streamAI, classifyIntent, getSystemPromptForIntent, getModelsForIntent, getModelsForMode, MODELS_LONG_CTX, MODELS_QUALITY } from "../_shared/models.ts";

// ── Lumina Computer agentic prompt ──────────────────────────────────
const COMPUTER_AGENTIC_PROMPT = `

# LUMINA COMPUTER — AGENTIC WORKSPACE MODE

You are operating inside the Lumina Computer workspace. The user sees a live code editor (left), source tabs (center), and a big iframe preview (right). Your job is to think, plan, then SHIP complete, working files that render beautifully.

## OUTPUT PROTOCOL — STRICT

Emit ONLY these tags. Anything outside them is ignored.

<lumina:plan>
Short markdown plan: what you are building and the file list. 2-6 lines max.
</lumina:plan>

<lumina:file path="index.html" lang="html">
...FULL file contents. No truncation. No "// rest unchanged". Complete <!doctype html> document for HTML files...
</lumina:file>

<lumina:file path="styles.css" lang="css">...</lumina:file>
<lumina:file path="app.js" lang="js">...</lumina:file>

<lumina:navigate to="/flashcards" reason="open flashcards for derivatives" />

<lumina:final>
Markdown summary for the user: what was built, how to use it, what to try next.
</lumina:final>

## HARD RULES

1. ALWAYS open with <lumina:plan> and close with </lumina:plan>.
2. EVERY <lumina:file> MUST have a closing </lumina:file>. Never leave a file half-written. If you run out of room, finish the current file before starting a new one.
3. HTML files must be a COMPLETE standalone <!doctype html> document with inline <style> and <script> — they must render directly in an iframe with no external assets.
4. Prefer ONE polished index.html for visual/interactive artifacts (calculators, study guides, simulators, dashboards, games). Split into multiple files only when it genuinely helps.
5. Use beautiful dark UI by default: gradients, glassmorphism, smooth transitions, system font stack, mobile-friendly. Make it look world-class.
6. <lumina:navigate> is optional — emit it ONLY if the user explicitly asks to go to a page. Valid Lumina routes include: /, /chat, /tests, /flashcards, /doubt-solver, /quest, /weakness-radar, /study-planner, /note-to-quiz, /quick-study, /guided-lesson, /study-session, /notes-generator, /lecture-ai, /smart-notebook, /resources, /leaderboard, /game-modes, /performance, /squad, /ai-tools, /hub, /pulse.
7. <lumina:final> is REQUIRED. Keep it crisp (3-8 lines).
8. NEVER write any prose, headings, or commentary outside these tags. The editor renders <lumina:file> verbatim — extra text leaks into the preview.
9. For deep-research / report requests where the user did not ask for code, emit a single <lumina:file path="report.md" lang="md">...</lumina:file> with the full markdown report, then <lumina:final>.
10. NEVER truncate. NEVER write "..." in place of content. NEVER summarise instead of finishing. The max token budget is large — use it.

## STYLE FOR HTML ARTIFACTS

- Dark theme: background gradients on #07070d → #12121f, text #e8e6ff, accents violet #a78bfa + cyan #22d3ee.
- Cards: rgba(255,255,255,0.04) with 1px rgba(255,255,255,0.08) border, border-radius 14px, subtle shadow.
- Headings: -apple-system / Inter; body 15px/1.65.
- Animations: 200-400ms ease transitions; no jank.
- All interactivity (sliders, tabs, MCQs, math) must actually work via inline JS.

Now read the user's request and ship.`;
// artifact-prompts intentionally not imported here — artifact generation is handled by generate-html-artifact

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.text();
    if (body.length > 5_000_000) return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { messages, mode } = JSON.parse(body);
    if (!Array.isArray(messages) || messages.length > 60) return new Response(JSON.stringify({ error: "Invalid or too many messages" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Adaptive intent classification
    const lastMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const queryText = lastMsg?.content || "";
    const hasFiles = queryText.includes("--- ATTACHED FILES ---");
    const intent = hasFiles ? "study" as const : classifyIntent(queryText);
    const requestedMode = typeof mode === "string" ? mode : "auto";

    // Artifact requests (slides / notes / exam) are handled by the dedicated
    // generate-html-artifact pipeline on the client (GenerateSetupCard → ArtifactCard).
    // We deliberately do NOT inline raw HTML in chat — it produced broken UX.
    const artifactFeature: null = null;

    let systemPrompt: string = getSystemPromptForIntent(intent);
    if (hasFiles) systemPrompt += `\n\nThe user has attached files (after "--- ATTACHED FILES ---"). Read ALL file content thoroughly and respond based on it.`;

    // ── LIVE WEB RESEARCH for Computer / MUN / Deep modes ─────────────
    // Free APIs only (DuckDuckGo + Wikipedia + arXiv). No keys, no cost.
    const needsResearch = intent === "computer" || intent === "mun" || intent === "deep" || requestedMode === "computer" || requestedMode === "mun";
    if (needsResearch && queryText && !hasFiles) {
      try {
        const q = queryText.slice(0, 300);
        const enc = encodeURIComponent(q);
        const fetchT = (url: string, ms = 6000) => {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), ms);
          return fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "LuminaAI/1.0 (https://luminaai.co.in)" } }).finally(() => clearTimeout(t));
        };
        const [duck, wiki, arxiv] = await Promise.allSettled([
          fetchT(`https://api.duckduckgo.com/?q=${enc}&format=json&no_html=1&skip_disambig=1`).then(r => r.json()).catch(() => null),
          fetchT(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc}&format=json&srlimit=5&origin=*`).then(r => r.json()).catch(() => null),
          fetchT(`https://export.arxiv.org/api/query?search_query=all:${enc}&max_results=4`).then(r => r.text()).catch(() => null),
        ]);

        const sources: string[] = [];

        if (duck.status === "fulfilled" && duck.value) {
          const d: any = duck.value;
          if (d.AbstractText) sources.push(`[DuckDuckGo · ${d.Heading || q}] ${d.AbstractText}${d.AbstractURL ? ` (${d.AbstractURL})` : ""}`);
          if (d.Answer) sources.push(`[DuckDuckGo · Instant Answer] ${d.Answer}`);
          if (d.Definition) sources.push(`[DuckDuckGo · Definition] ${d.Definition}${d.DefinitionURL ? ` (${d.DefinitionURL})` : ""}`);
          (d.RelatedTopics || []).slice(0, 5).forEach((t: any) => {
            if (t?.Text) sources.push(`[DuckDuckGo · Related] ${t.Text}${t.FirstURL ? ` (${t.FirstURL})` : ""}`);
          });
        }

        if (wiki.status === "fulfilled" && wiki.value?.query?.search) {
          for (const it of wiki.value.query.search.slice(0, 5)) {
            const snippet = String(it.snippet || "").replace(/<[^>]+>/g, "");
            sources.push(`[Wikipedia · ${it.title}] ${snippet} (https://en.wikipedia.org/?curid=${it.pageid})`);
          }
        }

        if (arxiv.status === "fulfilled" && arxiv.value) {
          const xml = arxiv.value as string;
          const entries = xml.split("<entry>").slice(1, 5);
          for (const e of entries) {
            const title = (e.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").trim().replace(/\s+/g, " ");
            const summary = (e.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || "").trim().replace(/\s+/g, " ").slice(0, 600);
            const link = (e.match(/<id>([\s\S]*?)<\/id>/)?.[1] || "").trim();
            if (title) sources.push(`[arXiv · ${title}] ${summary} (${link})`);
          }
        }

        if (sources.length > 0) {
          const block = sources.slice(0, 18).join("\n\n");
          systemPrompt += `\n\n## LIVE WEB RESEARCH (fetched just now from DuckDuckGo + Wikipedia + arXiv)\nUse these as your PRIMARY sources. Cite them inline using the bracket label, e.g. [Wikipedia · Title] or [arXiv · Title]. Combine with your own knowledge but prefer these for any current/factual claim. If a claim is not supported here and you are not certain, mark it (unverified).\n\n${block}\n\n## END WEB RESEARCH`;
          console.log(`[chat/research] injected ${sources.length} sources for "${q.slice(0, 60)}"`);
        } else {
          console.warn(`[chat/research] no sources retrieved for "${q.slice(0, 60)}"`);
        }
      } catch (researchErr) {
        console.warn("research fetch failed:", researchErr);
      }
    }

    // Inject persistent user memory so the AI recalls past context
    try {
      const { data: mems } = await sb
        .from("user_memory")
        .select("memory_type,key,value")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (mems && mems.length > 0) {
        const memBlock = mems.map((m: any) => `- [${m.memory_type}] ${m.key}: ${m.value}`).join("\n");
        systemPrompt += `\n\n## What you remember about this student\n${memBlock}\n\nUse this naturally — don't list it back. Just personalize.`;
      }
    } catch (memErr) {
      console.warn("memory fetch failed:", memErr);
    }

    const isComputerMode = requestedMode === "computer" || requestedMode === "mun" || intent === "computer" || intent === "mun";

    if (isComputerMode) {
      systemPrompt += COMPUTER_AGENTIC_PROMPT;
    }

    const models = isComputerMode
      ? Array.from(new Set([
          "openrouter/owl-alpha",
          ...MODELS_LONG_CTX,
          ...MODELS_QUALITY,
        ]))
      : artifactFeature
        ? MODELS_LONG_CTX
        : (getModelsForMode(requestedMode) ?? getModelsForIntent(intent));

    const maxTokens = isComputerMode
      ? 65000
      : (intent === "greeting" || intent === "conversational" ? 1200 : 131072);
    const temperature = isComputerMode ? 0.55 : artifactFeature ? 0.55 : requestedMode === "creative" ? 0.85 : intent === "coding" ? 0.35 : 0.65;
    const timeoutMs = isComputerMode ? 240_000 : (artifactFeature || intent === "coding" || requestedMode === "coding" ? 180_000 : 120_000);

    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    const res = await streamAI(aiMessages, models, maxTokens, temperature, timeoutMs, `chat/${requestedMode}/${artifactFeature ?? intent}`);
    return new Response(res.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});