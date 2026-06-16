import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { streamAI, classifyIntent, getSystemPromptForIntent, getModelsForIntent, getModelsForMode, MODELS_LONG_CTX, MODELS_QUALITY, MODELS_VISION, messageText, messagesHaveImages } from "../_shared/models.ts";
import { LUMINA_PERSONA } from "../_shared/lumina-persona.ts";
import { preFlight } from "../_shared/preflight.ts";
import { condenseHistory } from "../_shared/contextManager.ts";
import { detectSkills, buildSkillsBlock } from "../_shared/skills.ts";

// ── Lumina Computer agentic prompt ──────────────────────────────────
const COMPUTER_AGENTIC_PROMPT = `

# LUMINA COMPUTER — AGENTIC WORKSPACE MODE

You are operating inside the Lumina Computer workspace. The user sees a live code editor (left), source tabs (center), and a big iframe preview (right). Your job is to think, plan, then SHIP complete, working files that render beautifully.

## OUTPUT PROTOCOL — STRICT

Emit ONLY these tags. Anything outside them is ignored.

<lumina:plan>
ULTRA-SHORT plan: ONE sentence on intent + a 2-5 bullet file list. **Hard cap: 6 lines, 80 tokens total.** Never explain reasoning, design philosophy, or rationale here — that belongs in <lumina:final>. The planner section must NEVER consume more than ~2% of your output budget; the rest is files.
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
3. HTML files must be a COMPLETE standalone <!doctype html> document with inline <style> and <script> — they must render directly in an iframe with no external assets, UNLESS you also emit a sibling styles.css / app.js file (then link them by relative path).
4. MULTI-FILE OUTPUT IS REQUIRED for any non-trivial app. Use this architecture unless the user asks for a single file:
   /lumina-core/agents, /lumina-core/runtime, /lumina-core/ui, /lumina-core/renderer, /lumina-core/memory, /lumina-core/tools, /lumina-core/debugger, /lumina-core/styles, /lumina-core/utils, /lumina-core/main.js or main.ts, plus index.html. Split by responsibility: index.html, styles.css, app.js, components/*.js, data.json, README.md, etc. There is no per-file or total line cap; substantial builds (4k–50k lines across multiple files) are welcome and expected for real apps, games, dashboards, simulators.
5. FULL SOFTWARE FACTORY PIPELINE — simulate this internally before emitting files and make the result reflect it:
   • PLANNER: identify exact subject, acceptance criteria, modules, scale (small/medium/large/extreme).
   • ROUTER: primary moonshotai/kimi-k2.6, secondary openrouter/owl-alpha, tertiary verified free coding/long-context models. If a path seems weak, simplify module scope and still complete runnable files.
   • RESEARCH: ground the specific topic. If user says photosynthesis, the first viewport, H1, cards, data, interactions, quiz, and labels must say photosynthesis/chloroplast/light reactions/Calvin cycle; never output a generic "Core map" with missing subject context.
   • ARCHITECT: define file graph and dependency order before coding.
   • BUILDER: output full files only; no fragments.
   • VALIDATOR: check tags closed, HTML complete, imports resolved, subject visible, no placeholders, mobile safe.
   • DEBUGGER: if a module is likely broken, repair that module before final output.
   • RUNNER: include a run/open action for index.html when visual output exists.
   • ASSEMBLER: final files must cohere as one production app.
6. AESTHETIC — STUNNING, PRODUCTION-GRADE, UNIQUE EVERY TIME. Treat every build like a Linear / Vercel / Apple shipping product. No "hello world" energy, no skeletal one-pager, no generic AI gradient. Specifics:
   • Palette: deep #0a0a0f base, surface rgba(255,255,255,0.04), 1px hairline rgba(255,255,255,0.08), accents teal #14b8a6 + violet #7c3aed + gold #d4a843. Light variant: #fafafa base, white cards, rgba(0,0,0,0.06) hairlines.
   • Type: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter Tight", Inter, system-ui. Tight tracking on headlines (letter-spacing:-0.02em), 1.5 line-height on body. Use real type scale (12/14/16/20/28/40/56).
   • Layout: 1200-1440px container, 24-32px gutters, 96-160px section vertical rhythm. Real grid systems. NEVER a single stacked column unless mobile.
   • Polish: backdrop-filter:blur(20px) on glass, soft 0 30px 60px -30px rgba(0,0,0,0.5) shadows, 14-22px radius. Subtle inner highlights (inset 0 1px 0 rgba(255,255,255,0.06)). Conic / radial gradient ambient glows behind hero.
   • Motion: staggered fade-up entrance (intersection observer), 60ms stagger, cubic-bezier(0.16,1,0.3,1), hover lift -2px + shadow expand, focus rings 2px accent at 40% opacity. No flashy bounce.
   • Content: realistic copy and data — names, prices, timestamps, statuses, counts. No "Lorem ipsum", no "Item 1/2/3". Use believable seed data.
   • Density: every screen should feel inhabited — nav, hero, 3-5 sections, footer minimum for landing; for apps include sidebar, header, main area with real list/table/cards, empty + loading + populated states.
   • Mobile: every layout responsive at 375px with no horizontal scroll; collapse to drawer/stack with proper touch targets (≥44px).
   • UNIQUENESS: never reuse the same beige grid/card layout, same hero composition, same nav, or same visual hierarchy. Rotate between command-center, orbital canvas, split workbench, magazine dashboard, map/timeline, lab simulator, data cockpit, gallery wall, and tactile notebook systems based on the subject.
   • REJECT: purple-to-pink AI gradients on white, default Tailwind blue, emoji bullets, centered-stack-only layouts, placeholder boxes, generic "Core map" pages that hide the user’s topic.
7. <lumina:navigate> ONLY when the user explicitly asks to go to a page. Valid routes: /, /chat, /tests, /flashcards, /doubt-solver, /quest, /weakness-radar, /study-planner, /note-to-quiz, /quick-study, /guided-lesson, /study-session, /notes-generator, /lecture-ai, /smart-notebook, /resources, /leaderboard, /game-modes, /performance, /squad, /ai-tools, /hub, /pulse.
8. <lumina:action> emits an agentic action shown as a confirm-able log entry. type="run" runs the active file in preview; type="open" focuses a file in the editor; type="navigate" requires target as a route. Use these to narrate what you are doing.
9. <lumina:final> is REQUIRED. Keep it crisp (3-8 lines).
10. NEVER write any prose outside these tags. NEVER write "..." in place of content. NEVER write "// rest unchanged" or any placeholder.
11. **CODE FILE BODIES ARE PURE SOURCE CODE ONLY.** Inside a <lumina:file> body you may write ONLY valid syntax for the declared language. ABSOLUTELY FORBIDDEN inside file bodies: "let me continue", "continuing from where I left off", "as I was saying", "picking up where we stopped", "let me complete this", "I'll continue", or ANY conversational/meta phrase — even as a comment. Put status updates ONLY in <lumina:plan> or <lumina:final>. If continuing mid-file, just emit the next valid tokens of code with NO preamble.
12. If you sense you are approaching an output limit, FINISH the current <lumina:file> block cleanly (close all braces/tags + write </lumina:file>). Do NOT stop mid-token.
13. For deep-research reports without code, emit a single <lumina:file path="report.md" lang="md">...</lumina:file> with the full report.
14. **ZERO EMOJI POLICY — STRICTLY ENFORCED.** Production code, HTML, CSS, JS, UI copy, comments, plan text, file paths, and final summary must contain ZERO emoji and ZERO emoticon characters. No rockets, sparkles, party poppers, lightbulbs, check marks, fire, lightning bolts, targets, hearts — nothing in the Unicode emoji range, no kaomoji, no decorative pictographs. Substitute with text labels (Tip:, Note:, Warning:, Done:, ->). Visual emphasis comes from typography, spacing, color tokens, and SVG icons — never emoji.
15. **PLAN BUDGET DISCIPLINE.** Spend ≤2% of your output budget on <lumina:plan>. If the plan runs long, STOP and emit </lumina:plan>, then start coding. A long plan that truncates before any file ships is the worst possible outcome.

## CONTINUATION PROTOCOL

If a previous turn was cut off, the user may send a message starting with the token CONTINUE_LUMINA. When you see that token:
- Do NOT restart, do NOT repeat any previously emitted content, do NOT re-open any tag already opened.
- Do NOT acknowledge the continuation in chat OR inside any file. NO "continuing from where I left off". Just emit the next valid characters.
- Resume EXACTLY where you stopped (the tail of your previous output is shown).
- If you were inside <lumina:plan>, immediately emit </lumina:plan> (do NOT keep planning), then ship files and end with <lumina:final>.
- If you were inside <lumina:file>, keep emitting the file body as raw code and close it with </lumina:file>. Then continue with any remaining files and end with <lumina:final>.
- If between tags, just emit the next file or final tag.

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

    // ── Pre-flight: crisis detection + stress addon ───────────────────
    const flight = await preFlight({
      userId: user.id, userMessage: queryText, feature: `chat/${requestedMode}`, authHeader,
    });
    if (!flight.proceed && flight.interceptResponse) {
      // Stream the hardcoded crisis response back as SSE.
      const encoder = new TextEncoder();
      const safeText = flight.interceptResponse;
      const stream = new ReadableStream({
        start(ctrl) {
          const payload = JSON.stringify({ choices: [{ delta: { content: safeText } }] });
          ctrl.enqueue(encoder.encode(`data: ${payload}\n\n`));
          ctrl.enqueue(encoder.encode(`data: [DONE]\n\n`));
          ctrl.close();
        },
      });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
    }

    // Artifact requests (slides / notes / exam) are handled by the dedicated
    // generate-html-artifact pipeline on the client (GenerateSetupCard → ArtifactCard).
    // We deliberately do NOT inline raw HTML in chat — it produced broken UX.
    const artifactFeature: null = null;

    // Prepend Lumina older-brother persona to EVERY non-Computer chat surface.
    let systemPrompt: string = `${LUMINA_PERSONA}\n\n---\n\n${getSystemPromptForIntent(intent)}`;
    if (flight.systemAddon) systemPrompt += flight.systemAddon;
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

    // ── Skills System: auto-activate expert modules + TIER directive ──
    const activeSkills = detectSkills(queryText);
    systemPrompt += `\n\n${buildSkillsBlock(activeSkills)}`;
    if (activeSkills.length > 0) {
      console.log(`[chat/skills] activated: ${activeSkills.map(s => s.id).join(", ")}`);
    }

    // Lumina Computer: openrouter/owl-alpha is the PRIMARY (per user direction)
    // — 1M+ context, fast streaming, won't truncate mid-plan. Other long-context
    // models stay behind it so a single provider hiccup never kills a build.
    const computerChain = Array.from(new Set([
      "openrouter/owl-alpha",
      ...(hasImages ? MODELS_VISION : []),
      ...MODELS_LONG_CTX,
      "moonshotai/kimi-k2.6",
      ...MODELS_QUALITY,
    ]));
    const models = isComputerMode
      ? computerChain
      : artifactFeature
        ? MODELS_LONG_CTX
        : hasImages
          ? MODELS_VISION
          : (getModelsForMode(requestedMode) ?? getModelsForIntent(intent));

    // Computer mode: use Kimi's higher per-request output budget when the
    // direct Moonshot key is configured; fall back to the OpenRouter cap.
    const hasKimi = !!Deno.env.get("KIMI_API_KEY");
    const maxTokens = isComputerMode
      ? (hasKimi ? 128000 : 32000)
      : intent === "greeting" || intent === "conversational"
        ? 1200
        : intent === "coding" || intent === "deep"
          ? 16000
          : 6000;
    const temperature = isComputerMode ? 0.55 : artifactFeature ? 0.55 : requestedMode === "creative" ? 0.85 : intent === "coding" ? 0.35 : 0.65;
    const timeoutMs = isComputerMode ? (hasKimi ? 480_000 : 240_000) : (artifactFeature || intent === "coding" || requestedMode === "coding" ? 180_000 : 120_000);

    // ── Centralised conversation summarisation ───────────────────────
    // Every chat surface (chat/hub/squad/computer) goes through here, so
    // we condense long histories once on the server instead of per-component.
    const condensed = await condenseHistory(messages as any);
    const aiMessages = [{ role: "system", content: systemPrompt }, ...condensed.messages];

    const res = await streamAI(aiMessages, models, maxTokens, temperature, timeoutMs, `chat/${requestedMode}/${artifactFeature ?? intent}`);

    // Prepend SSE meta event (memory + active skills) so the client can
    // surface badges.
    if ((condensed.summarized || activeSkills.length > 0) && res.body) {
      const meta = `data: ${JSON.stringify({
        lumina_meta: {
          summarized: condensed.summarized,
          original_count: condensed.originalCount,
          summary: condensed.summary,
          skills: activeSkills.map((s) => ({ id: s.id, label: s.label, icon: s.icon })),
          tier_target: "TIER_1",
        },
      })}\n\n`;
      const reader = res.body.getReader();
      const enc = new TextEncoder();
      const merged = new ReadableStream({
        async start(ctrl) {
          ctrl.enqueue(enc.encode(meta));
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            ctrl.enqueue(value);
          }
          ctrl.close();
        },
      });
      return new Response(merged, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
    }

    return new Response(res.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});