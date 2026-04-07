import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = ["meta-llama/llama-3.3-70b-instruct:free", "minimax/minimax-m2.5:free", "google/gemma-3-27b-it:free", "z-ai/glm-4.5-air:free", "qwen/qwen3-next-80b-a3b-instruct:free", "google/gemma-3-12b-it:free"];
const TIMEOUT_MS = 12000;

async function fetchWithTimeout(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { ...opts, signal: c.signal }); clearTimeout(t); return r; }
  catch (e) { clearTimeout(t); throw e; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error } = await sb.auth.getUser();
    if (error || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.text();
    if (body.length > 50_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { messages } = JSON.parse(body);
    if (!Array.isArray(messages) || messages.length > 50) return new Response(JSON.stringify({ error: 'Invalid messages' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const systemPrompt = `You are Lumina — a brilliant problem-solving tutor who makes "impossible" questions feel conquerable.

YOUR APPROACH:
- Read the question carefully, identify what's ACTUALLY being asked
- Break solutions into clear, numbered steps — but explain the WHY behind each step
- Use analogies: "Think of it like..." to make abstract concepts tangible
- For math/science: show every step, use LaTeX ($x^2$, $$\\int f(x)dx$$), and explain the intuition
- Highlight common traps: "⚠️ Students often mess up here because..."
- End with a "Level Up" challenge — a slightly harder variation to test understanding

PERSONALITY: Sharp, encouraging, never condescending. You celebrate clever questions.

FORMATTING: Use **bold** for key terms, numbered steps, LaTeX for formulas, blank lines between sections.`;
    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    for (const model of MODELS) {
      try {
        const res = await fetchWithTimeout(OPENROUTER_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages: aiMessages, max_tokens: 1500, temperature: 0.6, stream: true }),
        }, TIMEOUT_MS);
        if (!res.ok) { const t = await res.text(); console.error(`[doubt] ${model} ${res.status}: ${t.slice(0, 200)}`); continue; }
        console.log(`[doubt] ✓ ${model}`);
        return new Response(res.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
      } catch (e) { console.error(`[doubt] ${model} err:`, e); }
    }
    throw new Error("All models failed");
  } catch (e) {
    console.error("doubt-solver error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
