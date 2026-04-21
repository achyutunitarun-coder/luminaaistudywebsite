// Reusable callAI() with 12-model OpenRouter waterfall (8s timeout each)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openrouter/elephant-alpha",
  "openai/gpt-oss-120b:free",
  "arcee-ai/trinity-large-preview:free",
  "z-ai/glm-4.5-air:free",
  "minimax/minimax-m2.5:free",
  "google/gemma-4-31b-it:free",
  "qwen/qwen3-coder:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-20b:free",
  "openrouter/free",
];

const KEYS = [
  Deno.env.get("OPENROUTER_API_KEY"),
  Deno.env.get("OPENROUTER_KEY_2"),
  Deno.env.get("OPENROUTER_KEY_3"),
].filter(Boolean) as string[];

async function tryModel(model: string, key: string, system: string, user: string, maxTokens: number, signal: AbortSignal) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://luminaai.co.in",
      "X-Title": "Lumina AI",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`${model} → ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error(`${model} empty`);
  return content;
}

async function callAI(systemPrompt: string, userPrompt: string, maxTokens = 8000) {
  const fallbacks: string[] = [];
  for (const model of MODELS) {
    for (const key of KEYS) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      try {
        const out = await tryModel(model, key, systemPrompt, userPrompt, maxTokens, ctrl.signal);
        clearTimeout(t);
        console.log(`✅ Winning model: ${model}`);
        return { content: out, model, fallbacks };
      } catch (e) {
        clearTimeout(t);
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`❌ ${msg}`);
        fallbacks.push(model);
      }
    }
  }
  throw new Error("All models exhausted");
}

const NOTES_SYSTEM = `You are Lumina AI Notes Architect. Return ONE complete self-contained HTML file (CSS+JS inline, only Google Fonts allowed). The HTML must include EVERY one of these blocks IN ORDER, never skip any:

1. HERO — shimmer gradient title, 1-line description, 3 animated stat counters
2. INTRO — flowing prose paragraphs with inline highlight chips on key terms
3. QUOTE BLOCK — oversized decorative quote mark, italic insight, source "Lumina AI Notes"
4. FORMULA BOX — large centered equation with radial glow + variable chips (use definition box if topic has no formula)
5. COMPARISON TABLE — 2-column, colored headers, 5–6 rows, hover row highlight
6. TIMELINE — vertical, gradient border line, glowing numbered dots, step label + title + description
7. CONCEPT BUBBLE GRID — 2x3 cards: ghost number bg, emoji, title, description, top color bar, hover lift
8. CALLOUT CARDS — all 4: ⚠️ Common Mistake, 🔥 Watch Out, 💡 Exam Tip, 🧠 Deep Insight
9. CASE STUDY — newspaper-card styled real-world scenario with "CASE STUDY" badge, pull-quote, "What This Teaches Us" checklist
10. FLIP FLASHCARDS — 4–6 CSS 3D flip cards (question front / gradient answer back)
11. KEY POINTS — 5 numbered items with circle badges, hover slide-right
12. SUMMARY CARD — full-width gradient, 6 checklist items, decorative bg circles

Use the THEME variables passed by the user (bg, primary, accent, fonts). Make it gorgeous, dense, and pedagogically rich. Output ONLY the HTML — no markdown fences, no commentary.`;

const PACK_SYSTEM = `You are Lumina AI Exam Pack Author. Return ONE complete self-contained HTML file (CSS+JS inline, only Google Fonts allowed) for an exam preparation pack. Include EVERY section:

1. COVER PAGE — title, subject, level, decorative gradient hero
2. 25 MCQs — each with 4 options, correct answer marked, brief explanation
3. 10 SHORT ANSWERS — concept questions with full model answers
4. 5 LONG ANSWERS — essay/derivation prompts with structured model answers
5. 5 EXAMINER'S SECRETS — insider tips on what graders reward
6. 6 COMMON MISTAKES — pitfalls with corrections
7. 10-POINT LAST-MINUTE CHECKLIST — pre-exam revision points
8. 8 HALL OF FAME TOPICS — highest-yield areas
9. TIME MANAGEMENT STRATEGY — section-by-section pacing

Match the THEME variables (bg, primary, accent, fonts) passed in. Beautiful typography, crisp answer boxes, color-coded sections. Output ONLY the HTML.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { mode, topic, subject, theme, packTitle, packLevel } = body;

    let system = "";
    let user = "";
    let maxTokens = 8000;

    if (mode === "notes") {
      system = NOTES_SYSTEM;
      user = `Topic: ${topic}\nSubject: ${subject || "General"}\nTheme: ${JSON.stringify(theme)}\n\nGenerate the complete Lumina notes HTML now.`;
      maxTokens = 8000;
    } else if (mode === "exam-pack") {
      system = PACK_SYSTEM;
      user = `Pack: ${packTitle}\nSubject: ${subject}\nLevel: ${packLevel}\nTheme: ${JSON.stringify(theme)}\n\nGenerate the complete exam pack HTML now.`;
      maxTokens = 12000;
    } else {
      return new Response(JSON.stringify({ error: "Invalid mode" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await callAI(system, user, maxTokens);
    // Strip markdown fences if model wrapped output
    let html = result.content;
    html = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    return new Response(JSON.stringify({ html, model: result.model, fallbacks: result.fallbacks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("generate-content error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
