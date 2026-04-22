// Lumina Exam Pack & Notes generator — 12-model OpenRouter waterfall, ~8s timeout, fixed Cosmos design system
// Generates ONE complete self-contained HTML file per call (notes mode or exam-pack mode)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Ordered fastest-first to fit within Supabase's 150s edge timeout.
const MODELS = [
  "openai/gpt-oss-120b:free",
  "z-ai/glm-4.5-air:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-20b:free",
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
      temperature: 0.75,
    }),
  });
  if (!res.ok) throw new Error(`${model} → ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error(`${model} empty`);
  return content;
}

async function callAI(systemPrompt: string, userPrompt: string, maxTokens = 12000) {
  const fallbacks: string[] = [];
  const globalDeadline = Date.now() + 135000; // leave 15s headroom under the 150s edge cap
  const PER_ATTEMPT_MS = 45000;

  for (const model of MODELS) {
    for (const key of KEYS) {
      const remaining = globalDeadline - Date.now();
      if (remaining < 8000) {
        throw new Error(`Deadline reached after fallbacks: ${fallbacks.join(", ")}`);
      }
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), Math.min(PER_ATTEMPT_MS, remaining));
      try {
        const out = await tryModel(model, key, systemPrompt, userPrompt, maxTokens, ctrl.signal);
        clearTimeout(t);
        console.log(`✅ Winning model: ${model}`);
        return { content: out, model, fallbacks };
      } catch (e) {
        clearTimeout(t);
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`❌ ${model}: ${msg}`);
        fallbacks.push(model);
      }
    }
  }
  throw new Error("All models exhausted");
}

const COSMOS_DESIGN = `
DESIGN SYSTEM (use exactly):
- Background #04040E, Primary #7B61FF, Accent #00F5C4, Accent2 #FF6B9D
- Heading font 'Exo 2' (700/800), Body font 'Nunito' (400/600/700) — both via Google Fonts
- All cards: background rgba(255,255,255,0.04), border 1px solid rgba(255,255,255,0.08), border-radius 16px, padding 24-32px
- Section headings: 4px wide gradient left bar (linear-gradient(180deg,#7B61FF,#00F5C4))
- All title text uses animated shimmer: background linear-gradient(90deg,#7B61FF,#00F5C4,#FF6B9D,#7B61FF); background-size 200% auto; -webkit-background-clip text; -webkit-text-fill-color transparent; animation shimmer 4s linear infinite
- @keyframes shimmer { to { background-position: 200% center } }
- Floating particle canvas (80 slow drifting purple+cyan particles, fixed top:0;left:0;z-index:0;pointer-events:none)
- Top scroll progress bar (3px, gradient primary→accent, fixed top, z-index 9999)
- Right-side dot navigation (vertical, one dot per major section, active = scaled 1.4 + glow)
- Fixed top navbar: "Lumina AI" left, pack title center, anchor links right
- IntersectionObserver fade-up on every section/card (opacity 0→1, translateY 40px→0, transition 0.7s ease)
- Card hover: translateY(-8px), box-shadow 0 20px 40px rgba(123,97,255,0.25), transition 0.3s
- Counters animate up from 0 when visible
- "Back to Top" floating button after 400px scroll
`;

const PACK_SYSTEM = `You are Lumina AI's Exam Pack Generator. Generate ONE complete self-contained HTML file. All CSS+JS inline. Only Google Fonts as external resource. No markdown fences. Start with <!DOCTYPE html>.

This pack is sold for ₹99 and MUST feel worth ₹5,000. Load it with everything. Do not skip a single section. Aim for 1500+ lines of rich, dense, exam-ready content.

${COSMOS_DESIGN}

GENERATE ALL 21 SECTIONS IN ORDER — DO NOT SKIP ANY:

1. COVER — full viewport, animated floating gradient orbs background, large shimmer pack title, subject + difficulty badges, 1-paragraph "what this pack covers and who it's for", 3 animated stat counters (Total Questions, Topics Covered, Estimated Study Hours), "Scroll to Begin →" bouncing arrow.

2. HOW TO USE — horizontal 4-step flow with connecting arrows: (1) Read the Master Notes, (2) Attempt all questions blind, (3) Review mistakes with the error tracker, (4) Do the speed drill 24h before exam. Each step: icon + bold title + 2-line description.

3. SYLLABUS MAP — visual grid of every sub-topic as color-coded chips with hover tooltips. Top: "Coverage Meter" — animated horizontal fill bars per major topic area showing depth (e.g. "Differentiation — 95%").

4. MASTER NOTES — the heart of the pack. Comprehensive exam-focused prose covering the entire subject. For EACH major concept: bold heading, 2–3 paragraphs in flowing prose (NOT bullets), inline highlight chips on key terms, formula box (large centered formula with radial glow + variable chips below) where applicable, real-world analogy. After every 2–3 concepts insert a Quote Block (oversized decorative ❝, italic insight, attribution "— Lumina AI") and a Concept Bubble Grid (2×3 cards: ghost number bg, emoji, title, 2-line desc, hover lift).

5. FORMULA SHEET — every formula/equation/law/theorem in its own box: large centered formula in heading font, radial glow behind, variable chips below, "When to use this" tip chip. Color-code by topic. Include a live search input at top that filters formula boxes by keyword in real time using vanilla JS.

6. COMPARISON TABLES — minimum 4 full tables of commonly confused concepts. 2-col, colored headers, 6–8 rows, hover row highlight. Below each table: a "Key Difference" callout card stating the single most important distinction.

7. TIMELINES & PROCESSES — minimum 2 vertical timelines for processes/cycles/sequences. Gradient left border line, glowing numbered dots, STEP 0X label + bold title + 2-line description per step. Dots scale 1→1.5 + glow on hover.

8. CASE STUDIES — minimum 3, each as a newspaper-card: "CASE STUDY" badge top-left, bold headline, 4 paragraphs telling a real story, oversized italic pull-quote midway, "What This Teaches Us" with 3 ✓ takeaways, "Exam Relevance" note explaining how this could appear in an exam.

9. MCQ SECTION — 25 questions, tabbed interface "Attempt Mode" / "Review Mode". Attempt: one question card at a time, progress bar Q3/25, 4 clickable option cards (correct = green glow ✓, wrong = red shake ✗ then reveal correct in green), "Next Question →" after answer, running score top-right, optional toggle timer counts up per question. Review: all 25 listed with correct/wrong highlighted + detailed explanation paragraph beneath each, filter buttons All / Correct / Incorrect / Unattempted. Questions must be genuinely difficult, syllabus-accurate, exam-pattern aligned. NO filler. Use vanilla JS for state.

10. SHORT ANSWER QUESTIONS — 10 in accordion layout. Each header clickable, expands smoothly to: 3–5 sentence model answer in exam-ready language, key-term chips to include, marks allocation guide, amber callout "Common Mistake".

11. LONG ANSWER / ESSAY — 5 questions, each its own card: question in large bold heading, word-limit + marks badge, internal tabs "Structure Guide" (numbered outline Intro→Point 1→Point 2→Conclusion) and "Model Answer" (full paragraphed exam-ready answer with key sentences highlighted), purple "Examiner's Expectation" insight callout below.

12. FLIP FLASHCARDS — minimum 20, responsive grid, CSS 3D rotateY(180deg) flip on click, transform-style:preserve-3d, 0.6s cubic-bezier. Front: bold question. Back: gradient bg, white answer, "✓ Mark as Known" + "★ Mark for Review" buttons. Cards marked for review get an accent dot on front. Top bar: Shuffle button + filter "Show All / For Review only". Small flip-hint above grid.

13. EXAMINER'S SECRETS — exactly 5 cards with "🔐 SECRET #N" badges. Dark bg, gold accent border. Each is a 3–4 sentence INSIDER tip — what examiners reward, what they penalize, what differentiates a 90% paper from 60%. Specific, actionable, not generic.

14. COMMON MISTAKES — 6 cards in 2×3 grid. ❌ large icon, bold mistake title, 2-line description, "Fix:" one-sentence solution. Red/amber left border, hover lift.

15. CALLOUT BANK — 8 callouts: 2× ⚠️ Common Mistake, 2× 🔥 Watch Out, 2× 💡 Exam Tip, 2× 🧠 Deep Insight. Each 2–3 sentences, subject-specific, useful — NO filler.

16. HALL OF FAME — 8 most exam-frequent topics in 2×4 grid. Topic name large heading, "Appeared in X% of past papers" frequency badge in accent, 3 bullet sub-topics most likely tested, 1–5 star difficulty rating (glowing stars). "Quick Revision" chip expands an accordion with a 5-line rapid-fire summary.

17. SPEED DRILL — 10 rapid-fire questions, dark bg, large text, full-width. 60-second countdown timer starts on "Start Drill" click. Questions appear one at a time, user types/selects answer. End screen: score card with time taken, accuracy %, performance badge (Bronze < 50%, Silver 50–70%, Gold 70–90%, Lumina Elite 90%+).

18. LAST-MINUTE CHECKLIST — 10 interactive checkbox cards. Checking triggers green ✓ animation + slight dim. Top progress bar fills as items checked. When all 10 ✓: confetti burst + "You're Exam Ready! 🎓" glow message. State persists in localStorage under key "lumina_pack_<pack_id>_checklist".

19. TIME MANAGEMENT — visual card: recommended time per question type, section-wise pie chart in pure CSS/SVG, 2-sentence "If you're stuck" strategy, 3-bullet "Last 10 minutes" strategy, horizontal timeline Wake → Revision → Travel → Exam Start → Section 1 → Section 2 → Review → Submit.

20. PERSONAL PERFORMANCE TRACKER — interactive vanilla JS dashboard: input fields for up to 5 mock test scores, pure CSS/SVG line chart of progression, "Best Score / Average / Improvement %" stat cards, "Weak Areas" textarea saved to localStorage, motivational message changes by trend (improving = "You're on a streak 🔥", declining = "Let's refocus — review your weak areas"). All saved & loaded from localStorage.

21. FOOTER — pack name, subject, difficulty, "Generated by Lumina AI", "Report an Error" link, copy-link share button, final powerful italic motivational line specific to this subject.

QUALITY: every section must be FUNCTIONAL, visually stunning, genuinely useful. Real exam-pattern questions for the specific subject. Treat this as a premium product. Output ONLY the HTML.`;

const NOTES_SYSTEM = `You are Lumina AI Notes Architect. Generate ONE complete self-contained HTML file (CSS+JS inline, only Google Fonts allowed). No markdown fences. Start with <!DOCTYPE html>.

${COSMOS_DESIGN}

INCLUDE EVERY ONE of these 12 blocks IN ORDER, never skip any:

1. HERO — shimmer gradient title, 1-line description, 3 animated stat counters
2. INTRO — 2–3 flowing prose paragraphs with inline highlight chips on key terms
3. QUOTE BLOCK — oversized decorative ❝, italic insight, source "— Lumina AI Notes"
4. FORMULA BOX — large centered equation with radial glow + variable chips (use a definition box if topic has no formula)
5. COMPARISON TABLE — 2-column, colored headers, 5–6 rows, hover row highlight
6. TIMELINE — vertical, gradient border line, glowing numbered dots, step label + title + description (4–5 steps)
7. CONCEPT BUBBLE GRID — 2×3 cards: ghost number bg, emoji, title, description, top color bar, hover lift
8. CALLOUT CARDS — all 4 types: ⚠️ Common Mistake, 🔥 Watch Out, 💡 Exam Tip, 🧠 Deep Insight
9. CASE STUDY — newspaper-card real-world scenario with "CASE STUDY" badge, oversized italic pull-quote, "What This Teaches Us" 3-item ✓ checklist
10. FLIP FLASHCARDS — 4–6 CSS 3D flip cards (question front / gradient answer back)
11. KEY POINTS — 5 numbered items with circle badges, hover slide-right (translateX(6px))
12. SUMMARY CARD — full-width gradient (primary→accent), 6 ✓ checklist items, decorative bg circles

Make it gorgeous, dense, pedagogically rich. Output ONLY the HTML.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { mode, topic, subject, packTitle, packLevel } = body;

    let system = "";
    let user = "";
    let maxTokens = 12000;

    if (mode === "notes") {
      system = NOTES_SYSTEM;
      user = `Topic: ${topic}\nSubject: ${subject || "General"}\n\nGenerate the complete Lumina notes HTML now. Remember: include ALL 12 blocks in order, use the exact Cosmos design system, output only HTML.`;
      maxTokens = 10000;
    } else if (mode === "exam-pack") {
      system = PACK_SYSTEM;
      user = `Pack Title: ${packTitle}\nSubject: ${subject}\nDifficulty: ${packLevel}\n\nGenerate the COMPLETE exam pack HTML now. Include ALL 21 sections in order. Real exam-quality questions. Cosmos design system exactly. Output only HTML.`;
      maxTokens = 16000;
    } else {
      return new Response(JSON.stringify({ error: "Invalid mode" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await callAI(system, user, maxTokens);
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
