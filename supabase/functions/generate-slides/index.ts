// Lumina Slides Generator — produces a single self-contained HTML slideshow on any topic
// 13 slide types, full keyboard/click/swipe nav, fits the Cosmos theme

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-120b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "google/gemma-4-31b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "minimax/minimax-m2.5:free",
  "z-ai/glm-4.5-air:free",
  "openai/gpt-oss-20b:free",
];

const KEYS = [
  Deno.env.get("OPENROUTER_API_KEY"),
  Deno.env.get("OPENROUTER_KEY_2"),
  Deno.env.get("OPENROUTER_KEY_3"),
].filter(Boolean) as string[];

const SLIDES_SYSTEM = `You are Lumina AI's Slides Generator. Generate ONE complete self-contained HTML slideshow file. All CSS + JS inline. Only Google Fonts allowed externally. No markdown fences. Start with <!DOCTYPE html>.

DESIGN — Cosmos theme:
- bg #04040E, primary #7B61FF, accent #00F5C4, accent2 #FF6B9D
- Heading: 'Exo 2' 700/800, Body: 'Nunito' 400/600/700
- Each slide is a full <section class="slide"> sized 100vw × 100vh, position absolute, hidden except .active
- Active slide: opacity 1, visible, transition 0.6s cubic-bezier(0.4,0,0.2,1)
- Slide entrance cycles per slide index: fadeUp · slideInRight · scaleIn · flipInX · blurIn (define each as @keyframes)
- All titles use animated shimmer gradient (linear-gradient #7B61FF→#00F5C4→#FF6B9D→#7B61FF, background-size 200%, -webkit-background-clip text, -webkit-text-fill-color transparent, animation shimmer 4s linear infinite)
- Cards: rgba(255,255,255,0.04), border 1px solid rgba(255,255,255,0.08), border-radius 20px

NAVIGATION (build into the HTML):
- Arrow keys (left/right) navigate
- Touch swipe left/right on mobile (touchstart/touchend)
- Bottom-center clickable dot indicators (one per slide, active = scaled 1.4 + accent color)
- Prev/Next buttons bottom-left and bottom-right corners with hover glow
- Top-right slide counter "3 / 13"
- Top progress bar (3px, gradient primary→accent, width = (currentIndex+1)/total * 100%)
- ESC exits fullscreen
- F key OR top-right ⛶ button toggles document.documentElement.requestFullscreen()
- Active dot transitions with spring scale animation

GENERATE EXACTLY 13 SLIDES IN THIS ORDER (never skip):

1. COVER — large shimmer gradient topic title, subtitle line, "Lumina AI" branding bottom-right, animated floating gradient orbs in background (3-4 orbs with blur and slow drift)
2. OVERVIEW "What You'll Learn" — 4–5 numbered agenda items animating in one-by-one on slide enter (staggered 0.15s)
3. DEFINITION — key concept explained: bold large term on left half, explanation on right half, vertical gradient divider line between
4. VISUAL FORMULA / DIAGRAM — central equation or core diagram in HTML/CSS, variable chips arranged around it, glow effect (radial-gradient backdrop)
5. KEY FACTS — 3 large stat cards side by side: big number/fact, icon emoji, label. Cards stagger-in (0.15s each)
6. COMPARISON — two-column VS layout: colored header rows (purple vs cyan), 5 row comparison, rows animate in sequentially
7. TIMELINE — horizontal scrolling timeline of 4–5 events: glowing dots, year labels, descriptions below each
8. CASE STUDY — real-world story: "CASE STUDY" badge top-left, bold headline, 3-line scenario, key takeaway highlighted in accent at bottom
9. COMMON MISTAKES — 3 mistake cards with ❌ icon, red/amber styling, brief explanation each
10. EXAM TIPS — 4 tip cards with 💡 icon, green/cyan styling, one tip per card, staggered entrance
11. MIND MAP — central topic bubble in middle, 6 branch bubbles connected by SVG lines radiating outward, all in pure CSS/SVG
12. SUMMARY — recap of 5 key points, each appearing with ✓ checkmark animation, gradient background
13. THANK YOU / END — "You're Ready." in huge display font, Lumina AI branding, animated star/particle burst (use 30 spans positioned randomly with scale + opacity keyframes)

CONTENT QUALITY: every slide must be filled with REAL substantive content about the topic. No "Lorem ipsum", no "Example text". Generate genuine, accurate, exam-ready content for the requested topic.

JS state: let current = 0; const total = 13; function go(i){ ... update .active class, dots, counter, progress bar }; window.addEventListener('keydown', ...); 

Output ONLY the HTML — no commentary, no markdown.`;

async function tryModel(model: string, key: string, system: string, user: string, signal: AbortSignal) {
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
      max_tokens: 8000,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`${model} → ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error(`${model} empty`);
  return content;
}

function cleanHtml(raw: string) {
  let h = raw.trim().replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (h.startsWith("```html")) h = h.slice(7);
  else if (h.startsWith("```")) h = h.slice(3);
  if (h.endsWith("```")) h = h.slice(0, -3);
  const i = h.toLowerCase().indexOf("<!doctype");
  if (i > 0) h = h.slice(i);
  return h.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { topic, chatId } = await req.json();
    if (!topic || typeof topic !== "string") {
      return new Response(JSON.stringify({ error: "Missing topic" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userPrompt = `Topic: ${topic}\n\nGenerate the complete 13-slide Lumina slideshow HTML for this topic now. Real substantive content. Cosmos theme. All 13 slides included. Output only the HTML file.`;

    let html = "";
    let modelUsed = "";
    let lastErr = "";
    const fallbacks: string[] = [];
    const t0 = Date.now();

    outer: for (const model of MODELS) {
      for (const key of KEYS) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 60000);
        try {
          const out = await tryModel(model, key, SLIDES_SYSTEM, userPrompt, ctrl.signal);
          clearTimeout(t);
          const cleaned = cleanHtml(out);
          if (cleaned.toLowerCase().includes("<!doctype") || cleaned.toLowerCase().includes("<html")) {
            html = cleaned;
            modelUsed = model;
            console.log(`✅ Slides via ${model}`);
            break outer;
          }
          fallbacks.push(model);
        } catch (e) {
          clearTimeout(t);
          lastErr = e instanceof Error ? e.message : String(e);
          fallbacks.push(model);
        }
      }
    }

    if (!html) {
      return new Response(JSON.stringify({ error: `All models failed: ${lastErr}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Persist to chat_artifacts so it appears in history
    const lineCount = html.split("\n").length;
    const genMs = Date.now() - t0;
    const title = `Slides: ${topic.slice(0, 80)}`;
    const { data: saved } = await sb.from("chat_artifacts").insert({
      user_id: user.id,
      chat_id: chatId,
      artifact_type: "slides",
      theme: "cosmos",
      title,
      html,
      model_used: modelUsed,
      line_count: lineCount,
      generation_time_ms: genMs,
    }).select().single();

    return new Response(JSON.stringify({
      html,
      title,
      model: modelUsed,
      fallbacks,
      artifact: saved,
      generation_time_ms: genMs,
      line_count: lineCount,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error("generate-slides error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
