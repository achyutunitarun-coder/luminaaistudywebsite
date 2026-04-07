import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PAYLOAD_BYTES = 50_000;
const MAX_MESSAGES = 50;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Category-optimized free model chains — FASTEST non-thinking models first
const FAST_MODELS: Record<string, string[]> = {
  reasoning: ["meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free", "qwen/qwen3-next-80b-a3b-instruct:free", "minimax/minimax-m2.5:free", "z-ai/glm-4.5-air:free"],
  coding: ["qwen/qwen3-coder:free", "meta-llama/llama-3.3-70b-instruct:free", "minimax/minimax-m2.5:free", "google/gemma-3-27b-it:free"],
  general: ["meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free", "qwen/qwen3-next-80b-a3b-instruct:free", "minimax/minimax-m2.5:free", "z-ai/glm-4.5-air:free"],
  fast: ["qwen/qwen3-next-80b-a3b-instruct:free", "google/gemma-3-27b-it:free", "meta-llama/llama-3.3-70b-instruct:free", "stepfun/step-3.5-flash:free"],
  study: ["meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free", "qwen/qwen3-next-80b-a3b-instruct:free", "minimax/minimax-m2.5:free", "z-ai/glm-4.5-air:free"],
  long_context: ["meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free", "minimax/minimax-m2.5:free"],
  creative: ["meta-llama/llama-3.3-70b-instruct:free", "z-ai/glm-4.5-air:free", "google/gemma-3-27b-it:free", "minimax/minimax-m2.5:free"],
};

const TIMEOUT_MS = 12000;

const CODING_KW = ["code","coding","program","function","bug","debug","javascript","python","typescript","react","html","css","api","algorithm","syntax","compile","class","array","loop","import","async","await","promise","fetch","database","sql"];
const REASONING_KW = ["why","explain why","reason","logic","prove","proof","analyze","math","calculus","integral","derivative","equation","algebra","geometry","physics","chemistry","formula","solve","calculate","step by step"];
const STUDY_KW = ["study","learn","explain","concept","exam","test prep","revision","flashcard","quiz","lecture","syllabus","notes","summary","key concepts"];
const CREATIVE_KW = ["write","essay","story","poem","creative","narrative","blog","article","letter","speech","script","dialogue"];
const FAST_KW = ["quick","fast","short answer","yes or no","brief","simple","what is","define","translate","convert"];

type Category = "reasoning" | "coding" | "general" | "fast" | "study" | "long_context" | "creative";

function detectCategory(text: string): Category {
  const lower = text.toLowerCase();
  const scores: Record<Category, number> = { reasoning: 0, coding: 0, general: 0, fast: 0, study: 0, long_context: 0, creative: 0 };
  for (const kw of CODING_KW) if (lower.includes(kw)) scores.coding++;
  for (const kw of REASONING_KW) if (lower.includes(kw)) scores.reasoning++;
  for (const kw of STUDY_KW) if (lower.includes(kw)) scores.study++;
  for (const kw of CREATIVE_KW) if (lower.includes(kw)) scores.creative++;
  for (const kw of FAST_KW) if (lower.includes(kw)) scores.fast++;
  if (text.includes("```") || text.includes("function ") || text.includes("const ")) scores.coding += 3;
  if (text.length > 3000) scores.long_context += 3;
  if (text.length < 60 && !text.includes("```")) scores.fast += 2;
  const max = Math.max(...Object.values(scores));
  if (max === 0) return "general";
  const priority: Category[] = ["coding", "reasoning", "long_context", "study", "creative", "fast", "general"];
  for (const cat of priority) { if (scores[cat] === max) return cat; }
  return "general";
}

async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) { clearTimeout(timer); throw e; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.text();
    if (body.length > MAX_PAYLOAD_BYTES) {
      return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { messages, mode } = JSON.parse(body);
    if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: "Invalid or too many messages (max 50)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const lastMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const queryText = lastMsg?.content || "";
    const validModes: Category[] = ["reasoning", "coding", "general", "fast", "study", "long_context", "creative"];
    const category: Category = (mode && validModes.includes(mode)) ? mode : detectCategory(queryText);
    const models = FAST_MODELS[category] || FAST_MODELS.general;

    const hasFiles = queryText.includes("--- ATTACHED FILES ---");
    let systemPrompt = `You are Lumina — a brilliant, adaptable AI study companion. You're NOT a textbook. You're like the smartest friend who happens to know everything and explains things in ways that actually click.

YOUR PERSONALITY:
- Warm, sharp, and genuinely helpful — never robotic or preachy
- Match the user's energy: casual question → casual answer, deep question → deep dive
- Use analogies, real-world connections, and "aha moment" explanations
- Be direct — get to the point fast, then elaborate if needed
- Throw in unexpected insights that make people go "wait, that's cool"
- If something is complex, break it down like you're explaining to a smart friend over coffee

FORMATTING:
- Use rich Markdown: **bold** key terms, headings for long answers, bullets for lists
- Use LaTeX for math: $x^2$, $\\frac{a}{b}$, $$\\int_0^1 f(x)dx$$
- Add blank lines between paragraphs for readability
- Keep it scannable — no walls of text
- For short questions, give short answers. Don't over-explain simple things.

RULES:
- NEVER introduce yourself or say your name unless asked
- If user says "hi" or "hello": respond with "Hey! What are we diving into today?" — nothing more
- End academic answers with a thought-provoking follow-up question (not generic "any questions?")
- If you're unsure, say so honestly — don't fake knowledge`;

    if (hasFiles) {
      systemPrompt += `\n\nThe user has attached files (after "--- ATTACHED FILES ---"). Read ALL file content thoroughly and respond based on it. Prioritize the file content over the conversational context.`;
    }

    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    for (const model of models) {
      try {
        const res = await fetchWithTimeout(OPENROUTER_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages: aiMessages, max_tokens: 2048, temperature: 0.7, stream: true }),
        }, TIMEOUT_MS);

        if (!res.ok) { const t = await res.text(); console.error(`[chat] ${model} ${res.status}: ${t.slice(0, 200)}`); continue; }
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) { const j = await res.json(); if (j.error) { console.error(`[chat] ${model} body error:`, j.error); continue; } }

        console.log(`[chat] ✓ ${model} (${category})`);
        const metaEvent = `data: ${JSON.stringify({ lumina_meta: { model, mode: category } })}\n\n`;
        const metaBytes = new TextEncoder().encode(metaEvent);
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        (async () => {
          await writer.write(metaBytes);
          const reader = res.body!.getReader();
          while (true) { const { done, value } = await reader.read(); if (done) break; await writer.write(value); }
          await writer.close();
        })();
        return new Response(readable, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
      } catch (e) {
        const isTimeout = e instanceof DOMException && e.name === "AbortError";
        console.error(`[chat] ${model} ${isTimeout ? "TIMEOUT" : "err"}:`, isTimeout ? `>${TIMEOUT_MS}ms` : e);
      }
    }
    throw new Error("All models failed");
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
