import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIText } from "../_shared/models.ts";
import { buildArtifactSystemPrompt, type ArtifactFeature } from "../_shared/artifact-prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Preferred models for HTML artifact generation (July 2026 free roster).
const HTML_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "cohere/north-mini-code:free",
  "nvidia/nemotron-3-super:free",
  "qwen/qwen3-coder:free",
  "poolside/laguna-m.1:free",
  "openai/gpt-oss-120b:free",
  "openai/gpt-oss-20b:free",
];

// Each theme spec ends with STRUCTURE: which forces a distinct LAYOUT (not just colors).
const NOTES_THEMES: Record<string, string> = {
  "academic-dark": "Academic Dark — cream #f8f7f2, navy #1a1a2e, gold #c8a84b. Fonts: Lora + Outfit + JetBrains Mono. STRUCTURE: classic single-column scholarly notes with drop-cap first letter on each section, gold left-border formula boxes, italic margin notes.",
  "midnight-study": "Midnight Study — bg #0f0f1a, cards #1a1a2e, text #e8e6f0, purple #7c3aed. Fonts: Space Grotesk + Inter. STRUCTURE: dark glassmorphic cards with neon glow, formulas in pill-shaped boxes with backdrop-blur, sticky topic chip on left.",
  "clean-minimal": "Clean Minimal — white, #fafafa, blue #2563eb. Fonts: DM Sans. STRUCTURE: ultra-minimal single column, all-caps tiny section labels, hairline 1px dividers, no boxes — only typography hierarchy and whitespace.",
  "nature-journal": "Nature Journal — sage #f0f4e8, forest #2d6a4f. Fonts: Merriweather + Lato. STRUCTURE: handwritten-journal feel, leaf bullet points, formulas in rounded green leaf cards, watercolor-style example boxes.",
  "vibrant-neon": "Vibrant Neon — #fafafa, amber #f59e0b + pink #ec4899. Fonts: Poppins + Nunito. STRUCTURE: bold colored sticker callouts, gradient backgrounds, oversized numerals for section headers, neon highlight markers behind key terms.",
  "ib-official": "IB Official — #f5f5f0, IB blue #003087. Fonts: Times New Roman + Arial. STRUCTURE: official IB document, blue header bar, two-column body with margin annotations, criteria tags A/B/C/D on each concept.",
  "boxed-grid": "Boxed Grid — bg #fff, slate borders #cbd5e1, indigo #4f46e5. Fonts: Inter + Fira Code. STRUCTURE: every concept lives in its OWN bordered box arranged in a CSS grid (2 columns desktop, 1 mobile). Each box: header strip with concept #, body, formula footer. Looks like a content-heavy dashboard.",
  "tabular-notes": "Tabular Notes — bg #fafafa, navy header rows. Fonts: IBM Plex Sans + IBM Plex Mono. STRUCTURE: Almost everything is a TABLE. Concept tables with columns: Concept | Definition | Formula | Example. Comparison tables. Stripe rows. Sticky table headers. Feels like a spec sheet.",
  "comic-book": "Comic Book — bg #fffbeb, halftone dot pattern, red #dc2626 + yellow #facc15 + black borders 3px. Fonts: Bangers + Comic Neue. STRUCTURE: comic panels with thick black borders, speech-bubble explanations, BIG SPLASH HEADERS, KAPOW-style starbursts highlighting key formulas.",
  "terminal-code": "Terminal Code — bg #0d0d0d, green #22c55e text, amber #fbbf24 accents. Fonts: JetBrains Mono everywhere. STRUCTURE: looks like a terminal/IDE. Sections start with `$ topic --explain`. Formulas in code-block style with line numbers. Comments in gray // style. Cursor blink on title.",
  "magazine-editorial": "Magazine Editorial — cream #fdf6e3, deep red #b91c1c pull-quotes. Fonts: Playfair Display + Source Serif. STRUCTURE: editorial magazine with HUGE display headlines, multi-column body text, oversized pull-quotes, full-width banner image placeholders, image captions.",
  "kawaii-pastel": "Kawaii Pastel — bg #fff5f7 pink, mint cards #ecfdf5, rounded everything. Fonts: Quicksand + Nunito. STRUCTURE: rounded-3xl pastel cards with small SVG floral/star icons (NO emoji), dotted borders, soft pink/mint/lavender alternating section backgrounds, friendly tone.",
};

const EXAM_THEMES: Record<string, string> = {
  "classic-paper": "Classic Paper — bg #f0ede6, dark #1c1c1c, gold #c8a84b. Fonts: Libre Baskerville + Source Sans 3. STRUCTURE: traditional exam booklet, single column, dashed answer lines, dark question-number badges with gold text.",
  "dark-exam": "Dark Exam — bg #111827, cards #1f2937, purple #7c3aed. Fonts: Space Grotesk + JetBrains Mono. STRUCTURE: dark mode exam with neon accents, glowing question number pills, dark textareas with subtle purple focus glow.",
  "blueprint": "Blueprint — bg #1e3a5f w/ subtle grid pattern, cyan #06b6d4. Fonts: Rajdhani + Roboto. STRUCTURE: engineering blueprint look, white drafting lines, technical drawing borders, monospace marks.",
  "newspaper": "Newspaper — newsprint #fffef7, black serifs. Fonts: Playfair Display + Georgia. STRUCTURE: 2-column newspaper layout for questions, masthead title bar, hairline column rules, classified-ad style instructions box.",
  "modern-minimal": "Modern Minimal — white, sky #0ea5e9. Fonts: DM Sans. STRUCTURE: airy single column, circle outline question numbers, generous whitespace, blue focus ring on textareas.",
  "ib-official": "IB Official — official IB paper layout, IB blue #003087 banner, Arial. STRUCTURE: criteria badges A/B/C/D, candidate session number field, command terms in bold caps.",
  "table-grid-exam": "Table Grid Exam — bg #fff, navy headers, zebra rows. Fonts: IBM Plex Sans. STRUCTURE: ENTIRE EXAM IS A TABLE. Columns: Q# | Question | Marks | Working/Answer (textarea cell). Each section is its own table with sticky thead. Looks like an answer-sheet grid.",
  "card-deck-exam": "Card Deck Exam — bg #f1f5f9, white cards w/ heavy shadow, emerald #059669 accent. Fonts: Manrope + Fira Code. STRUCTURE: each question is a separate elevated CARD with rounded corners (rounded-2xl), shadow-xl, marks badge top-right, sub-parts inside as nested mini-cards.",
  "two-column-booklet": "Two-Column Booklet — cream paper, brown #78350f. Fonts: Crimson Pro + Inter. STRUCTURE: two-column print layout like a real exam booklet, drop-cap section openers, marginalia for marks, footer page-X-of-Y per section.",
  "vintage-typewriter": "Vintage Typewriter — bg #f5efe0 aged paper, faint coffee stains via radial gradients, black ink. Fonts: Special Elite + Courier Prime. STRUCTURE: looks typed on a 1950s typewriter, slightly uneven character spacing via letter-spacing tweaks, stamp-style red EXAM badge.",
  "neo-brutalist": "Neo-Brutalist — bg #fef3c7 yellow, BLACK 4px borders everywhere, hard shadows offset 6px 6px 0 black, hot pink #ec4899 + lime #84cc16 accents. Fonts: Space Grotesk Bold + JetBrains Mono. STRUCTURE: chunky brutalist blocks, no rounded corners, big block question numbers, in-your-face design.",
  "scientific-lab": "Scientific Lab — white, lab-blue #1e40af, graph-paper background (faint blue grid). Fonts: Roboto Mono + Inter. STRUCTURE: each question on graph paper background, working space looks like graph paper textarea, hypothesis/observation/conclusion subdivisions for science feel.",
};

const SLIDES_THEMES: Record<string, string> = {
  "lumina-dark":     "Lumina Dark — bg #0f1117, indigo #6366f1, accent purple #a78bfa. Default Lumina deep-space deck.",
  "physics-blue":    "Physics Blue — primary #3b82f6 on dark surface. Crisp scientific feel.",
  "math-purple":     "Math Purple — primary #8b5cf6, formula-forward layout with KaTeX-style serif accents.",
  "cs-cyan":         "CS Cyan — primary #06b6d4, terminal/IDE vibe, monospace hero titles.",
  "history-amber":   "History Amber — primary #f59e0b on warm dark surface, parchment-style textures.",
  "biology-green":   "Biology Green — primary #10b981, organic curves, leaf accent dividers.",
  "chemistry-rose":  "Chemistry Rose — primary #f43f5e, periodic-table tile motifs.",
  "literature-pink": "Literature Pink — primary #ec4899, magazine editorial slides.",
  "economics-teal":  "Economics Teal — primary #14b8a6, chart/graph oriented layouts.",
  "minimal-light":   "Minimal Light — bg #ffffff, indigo accents, ultra-clean Apple keynote vibe.",
};

function buildNotesPrompt(theme: string, themeKey: string, topic = "") {
  return `${buildArtifactSystemPrompt("notes", topic)}

────────── PER-REQUEST OVERRIDES ──────────
Active theme key: ${themeKey}
Theme spec (override the default :root variables to match): ${theme}

CONTENT MUST INCLUDE (in addition to master spec):
- Cover with title, subject, grade, date
- Numbered TOC with anchor links (sticky on desktop)
- Per-section minimum 300 words
- Min 3 worked examples (easy → medium → hard) with numbered steps
- Min 5 definition boxes
- Min 3 callouts (mix tip / warn / mistake / exam tip)
- 1 comparison table
- 1 formula / cheatsheet section (even non-math)
- 5 practice questions, click-to-reveal answers
- Footer: "Generated by Lumina AI"

WRITING STYLE: friendly expert tutor, assume nothing, number every step. Use proper math: x², √, π, ≤, ≥, ±.`;
}

function buildExamPrompt(theme: string, themeKey: string, totalMarks: number, durationMin: number, topic = "") {
  return `${buildArtifactSystemPrompt("exam", topic)}

────────── PER-REQUEST OVERRIDES ──────────
Active theme key: ${themeKey}
Theme spec (override default :root to match): ${theme}

EXAM SPECIFICATIONS:
- Duration: ${durationMin} minutes
- Total marks: ${totalMarks} (the sum across ALL sub-parts MUST equal this exactly)
- Use the 4-section IB-style layout: A Knowledge & Understanding · B Investigating Patterns · C Communication & Reasoning · D Applying in Context
- Min 4 questions per section, each with sub-parts (a)(b)(c) increasing in difficulty
- Marks per sub-part shown like [2 marks]
- Show running totals per section + grand total
- Mark scheme included at the bottom, hidden behind a toggle button by default

ANSWER AREAS: every written sub-part is its own <textarea> with placeholder "Write your working and answer here..." and the height/style rules from the master spec.`;
}

function buildSlidesPrompt(theme: string, themeKey: string, slideCount: number, topic = "") {
  return `${buildArtifactSystemPrompt("slides", topic)}

────────── PER-REQUEST OVERRIDES ──────────
Active theme key: ${themeKey}
Theme spec (override default :root to match): ${theme}

DECK SPECIFICATIONS:
- Slide count: ${slideCount} (first = hero/title, last = summary/key takeaways)
- One core idea per slide
- Mix slide types: title, content, code (when relevant), diagram, comparison, callout, summary
- Include working keyboard nav (← →, Space), click nav, swipe, F fullscreen, G grid overview, slide counter, progress bar
- Auto-pick the subject color from the master spec based on the topic`;
}

function cleanHtml(raw: string): string {
  let h = (raw || "").trim();
  h = h.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (h.startsWith("```html")) h = h.slice(7);
  else if (h.startsWith("```")) h = h.slice(3);
  if (h.endsWith("```")) h = h.slice(0, -3);
  h = h.trim();
  // If there's prose before <!DOCTYPE, strip it
  const doctypeIdx = h.toLowerCase().indexOf("<!doctype");
  if (doctypeIdx > 0) h = h.slice(doctypeIdx);
  const htmlIdx = h.toLowerCase().indexOf("<html");
  if (doctypeIdx === -1 && htmlIdx > 0) h = h.slice(htmlIdx);
  return h.trim();
}

function sse(event: string, data: any) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Enforce plan-tier usage limit (production-grade — bypasses client tampering)
    const { enforceUsage } = await import("../_shared/usage-gate.ts");
    const gate = await enforceUsage(user.id, "artifact_generation", corsHeaders);
    if (!gate.ok) return gate.response;

    const body = await req.json();
    const {
      topic = "Study Material",
      subject = "General",
      grade = "MYP 5",
      types = ["notes"], // any subset of ["notes","exam","slides"]
      notesTheme = "academic-dark",
      examTheme = "classic-paper",
      slidesTheme = "lumina-dark",
      slideCount = 10,
      totalMarks = 100,
      durationMin = 120,
      chatId,
    } = body || {};

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (event: string, data: any) => controller.enqueue(enc.encode(sse(event, data)));
        const startTs = Date.now();

        try {
          send("log", { type: "command", text: `lumina generate --types=${types.join(",")} --topic="${topic}"` });
          send("log", { type: "info", text: "Parsing topic & preparing prompts..." });
          await new Promise(r => setTimeout(r, 200));
          send("log", { type: "success", text: `Subject: ${subject} · Grade: ${grade}` });

          const artifacts: any[] = [];

          for (const type of types as ArtifactFeature[]) {
            let themeKey = "";
            let themeDesc = "";
            let sysPrompt = "";
            let userPrompt = "";
            let label = "";

            // HARD REINFORCEMENT — prevents placeholder/skeleton output
            const contentReinforcement = `

═══════════════════════════════════════════════════
ABSOLUTE OUTPUT CONTRACT — VIOLATION = FAILURE
═══════════════════════════════════════════════════

You are NOT a template generator. You are a CONTENT creator.

FORBIDDEN (instant failure if present):
- "Click here to view", "Open the file to see", "Your content will appear here"
- "Instructions on how to use this", "How to navigate", "Welcome to your"
- Lorem ipsum, placeholder text, "TODO", "coming soon", "rest of content here"
- Any meta-commentary about what the artifact IS — just BE the artifact
- Emoji of any kind (🚀⚡🎯🔥💡✅❌🎉🌟📝📚 etc.) — use SVG icons or text labels

REQUIRED (instant failure if missing):
- The HTML MUST contain REAL, SUBSTANTIVE educational content for "${topic}"
- Real definitions with explanations, not just term names
- Real worked examples with actual numbers and step-by-step solutions
- Real formulas with variable explanations
- Real practice questions with complete answers and explanations
- Minimum 800 lines of actual HTML content
- Every section must have substantial text — not just headers

IDENTITY: You are writing a real textbook chapter / exam paper / presentation that a student will actually study from. A teacher would be proud to distribute this. A student would learn from this.

OUTPUT: ONLY raw HTML starting with <!DOCTYPE html> and ending with </html>. No markdown fences. No preamble. No commentary. The HTML file IS the deliverable — it must be complete, self-contained, and immediately useful.

UNIQUENESS: This artifact must feel like a custom-designed product, not a template. Choose a distinctive visual approach that fits the topic. Make one design decision that makes this artifact memorable and different from any other.`;

            if (type === "notes") {
              themeKey = notesTheme;
              themeDesc = NOTES_THEMES[themeKey] || NOTES_THEMES["academic-dark"];
              sysPrompt = buildNotesPrompt(themeDesc, themeKey, topic) + contentReinforcement;
              userPrompt = `Generate complete HTML study notes for topic: "${topic}". Subject: ${subject}. Grade: ${grade}.\n\nProduce the full document with ALL actual educational content embedded — definitions, worked examples, formulas, practice questions with answers. Do NOT write meta-instructions.`;
              label = "study notes";
            } else if (type === "exam") {
              themeKey = examTheme;
              themeDesc = EXAM_THEMES[themeKey] || EXAM_THEMES["classic-paper"];
              sysPrompt = buildExamPrompt(themeDesc, themeKey, totalMarks, durationMin, topic) + contentReinforcement;
              userPrompt = `Generate complete HTML exam paper for topic: "${topic}". Subject: ${subject}. Grade: ${grade}. Total marks: ${totalMarks}. Duration: ${durationMin} min.\n\nProduce a real exam paper: real questions on the topic with the right marks each, sub-parts (a)(b)(c), answer textareas, and a hidden mark scheme with actual model answers.`;
              label = "exam paper";
            } else if (type === "slides") {
              themeKey = slidesTheme;
              themeDesc = SLIDES_THEMES[themeKey] || SLIDES_THEMES["lumina-dark"];
              sysPrompt = buildSlidesPrompt(themeDesc, themeKey, slideCount, topic) + contentReinforcement;
              userPrompt = `Generate a complete HTML presentation deck for topic: "${topic}". Subject: ${subject}. Grade: ${grade}. Target slide count: ${slideCount}.\n\nEvery slide must contain real subject content for "${topic}" — not "lesson plan" placeholders.`;
              label = "presentation deck";
            } else {
              send("log", { type: "warning", text: `Unknown artifact type: ${type} — skipping` });
              continue;
            }

            send("log", { type: "command", text: `generate.${type}() — building ${label}` });
            send("log", { type: "info", text: `Applying theme: ${themeKey}` });
            send("log", { type: "progress", text: `Calling AI (${HTML_MODELS.length} model fallbacks ready)...` });

            const t0 = Date.now();
            let html = "";
            let modelUsed = "";
            let lastErr = "";

            for (const model of HTML_MODELS) {
              const shortName = model.split("/").pop()?.replace(":free", "") || model;
              send("log", { type: "progress", text: `Trying ${shortName}...` });
              try {
                const text = await callAIText(
                  [
                    { role: "system", content: sysPrompt },
                    { role: "user", content: userPrompt },
                  ],
                  [model], 65536, 0.5, 180_000, `html-artifact-${type}`
                );
                const cleaned = cleanHtml(text);
                if (cleaned.toLowerCase().includes("<!doctype html") || cleaned.toLowerCase().includes("<html")) {
                  html = cleaned;
                  modelUsed = shortName;
                  send("log", { type: "success", text: `${shortName} returned valid HTML` });
                  break;
                }
                send("log", { type: "warning", text: `${shortName} returned invalid HTML — trying next` });
              } catch (e: any) {
                lastErr = e?.message || String(e);
                send("log", { type: "warning", text: `${shortName} failed: ${lastErr.slice(0, 60)}` });
              }
            }

            if (!html) {
              send("log", { type: "error", text: `All models failed for ${type}. Last error: ${lastErr.slice(0, 80)}` });
              continue;
            }

            const lineCount = html.split("\n").length;
            const genMs = Date.now() - t0;
            send("log", { type: "success", text: `${type === "notes" ? "Notes" : "Exam"} HTML compiled — ${lineCount} lines in ${(genMs / 1000).toFixed(1)}s` });

            // Persist to chat_artifacts
            const title = `${subject}: ${topic}`.slice(0, 100);
            const { data: saved, error: saveErr } = await sb.from("chat_artifacts").insert({
              user_id: user.id,
              chat_id: chatId,
              artifact_type: type,
              theme: themeKey,
              title,
              html,
              model_used: modelUsed,
              line_count: lineCount,
              generation_time_ms: genMs,
            }).select().single();

            if (saveErr) {
              send("log", { type: "error", text: `Save failed: ${saveErr.message}` });
            } else {
              artifacts.push(saved);
              send("log", { type: "success", text: `Saved artifact ${saved.id.slice(0, 8)}` });
            }

            // Fire learning-pipeline capture (best-effort)
            try {
              await sb.functions.invoke("learning-pipeline", {
                body: {
                  action: "capture",
                  question: `[${type.toUpperCase()} GENERATION] ${topic} (${subject}, ${grade})`,
                  answer: html.slice(0, 8000),
                  sessionId: crypto.randomUUID(),
                  source: `artifact-${type}`,
                  modelUsed,
                  latencyMs: genMs,
                },
              });
            } catch {}
          }

          send("log", { type: "command", text: "embed.render() — injecting into chat" });
          send("log", { type: "success", text: `Done in ${((Date.now() - startTs) / 1000).toFixed(1)}s` });
          send("done", { artifacts, totalTimeMs: Date.now() - startTs });
        } catch (e: any) {
          send("log", { type: "error", text: `Fatal: ${e?.message || String(e)}` });
          send("done", { artifacts: [], error: e?.message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
