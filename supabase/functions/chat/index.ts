import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { streamAI, classifyIntent, getSystemPromptForIntent, getModelsForIntent, getModelsForMode, MODELS_LONG_CTX, MODELS_QUALITY, MODELS_VISION, messageText, messagesHaveImages } from "../_shared/models.ts";
import { LUMINA_PERSONA } from "../_shared/lumina-persona.ts";

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

<lumina:action type="open" target="index.html" reason="show the result" />
<lumina:action type="run" target="index.html" reason="execute the live preview" />

<lumina:final>
Markdown summary for the user: what was built, how to use it, what to try next.
</lumina:final>

## HARD RULES

1. ALWAYS open with <lumina:plan> and close with </lumina:plan>.
2. EVERY <lumina:file> MUST have a closing </lumina:file>. Never leave a file half-written.
3. HTML files must be a COMPLETE standalone <!doctype html> document with inline <style> and <script> — they must render directly in an iframe with no external assets.
4. Prefer ONE polished index.html for visual/interactive artifacts. Split files only when it helps.
5. AESTHETIC: Apple-inspired. Clean white surfaces or deep #0b0b0f, generous whitespace, SF Pro / -apple-system / Inter font stack, subtle 1px hairline borders (rgba(255,255,255,0.08) or rgba(0,0,0,0.06)), soft shadows, 16-22px radius, no neon, no terminal/scientific tropes. Spring-y micro-interactions.
6. <lumina:navigate> ONLY when the user explicitly asks to go to a page. Valid routes: /, /chat, /tests, /flashcards, /doubt-solver, /quest, /weakness-radar, /study-planner, /note-to-quiz, /quick-study, /guided-lesson, /study-session, /notes-generator, /lecture-ai, /smart-notebook, /resources, /leaderboard, /game-modes, /performance, /squad, /ai-tools, /hub, /pulse.
7. <lumina:action> emits an agentic action shown as a confirm-able log entry. type="run" runs the active file in preview; type="open" focuses a file in the editor; type="navigate" requires target as a route. Use these to narrate what you are doing.
8. <lumina:final> is REQUIRED. Keep it crisp (3-8 lines).
9. NEVER write any prose outside these tags. NEVER truncate. NEVER write "..." in place of content.
10. For deep-research reports without code, emit a single <lumina:file path="report.md" lang="md">...</lumina:file> with the full report.

## STYLE FOR HTML ARTIFACTS (Apple-inspired)

- Background: #0b0b0f or #fafafa. Surface cards: rgba(255,255,255,0.04) on dark, white on light.
- Hairline borders, soft 12-24px radius, generous padding.
- Font: -apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, system-ui, sans-serif.
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
    const queryText = messageText(lastMsg);
    const hasFiles = queryText.includes("--- ATTACHED FILES ---");
    const hasImages = messagesHaveImages(messages);
    const intent = hasFiles ? "study" as const : classifyIntent(queryText);
    const requestedMode = typeof mode === "string" ? mode : "auto";

    // Artifact requests (slides / notes / exam) are handled by the dedicated
    // generate-html-artifact pipeline on the client (GenerateSetupCard → ArtifactCard).
    // We deliberately do NOT inline raw HTML in chat — it produced broken UX.
    const artifactFeature: null = null;

    // Prepend Lumina older-brother persona to EVERY non-Computer chat surface.
    let systemPrompt: string = `${LUMINA_PERSONA}\n\n---\n\n${getSystemPromptForIntent(intent)}`;
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
      ? Array.from(new Set(hasImages ? [...MODELS_VISION, ...MODELS_LONG_CTX] : ["openrouter/owl-alpha", ...MODELS_LONG_CTX, ...MODELS_QUALITY]))
      : artifactFeature
        ? MODELS_LONG_CTX
        : hasImages
          ? MODELS_VISION
          : (getModelsForMode(requestedMode) ?? getModelsForIntent(intent));

    // Free OpenRouter models cap output around 32k. Stay well under to avoid 400s.
    const maxTokens = isComputerMode
      ? 24000
      : intent === "greeting" || intent === "conversational"
        ? 1200
        : intent === "coding" || intent === "deep"
          ? 12000
          : 6000;
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