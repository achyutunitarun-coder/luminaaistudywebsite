import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = ["meta-llama/llama-3.3-70b-instruct:free", "minimax/minimax-m2.5:free", "google/gemma-3-27b-it:free", "z-ai/glm-4.5-air:free", "qwen/qwen3-next-80b-a3b-instruct:free", "google/gemma-3-12b-it:free"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.text();
    if (body.length > 10_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { subjects, examDate, dailyHours } = JSON.parse(body);
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    for (const model of MODELS) {
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 15000);
        const res = await fetch(OPENROUTER_URL, { method: "POST", signal: c.signal, headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages: [
          { role: "system", content: `Create a realistic, actionable study plan. Be strategic — prioritize weak areas, use spaced repetition logic, and include breaks.

Return ONLY JSON: {"plan": [{"day": "Day 1", "date": "...", "tasks": [{"subject": "...", "topic": "...", "duration": "1h", "method": "Active Recall / Notes / Practice"}]}], "tips": ["practical study tip"]}` },
          { role: "user", content: `Subjects: ${JSON.stringify(subjects)}\nExam: ${examDate}\nDaily hours: ${dailyHours}` },
        ], max_tokens: 3000, temperature: 0.5 }) });
        clearTimeout(t);
        if (!res.ok) { const e = await res.text(); console.error(`[plan] ${model} ${res.status}: ${e.slice(0,200)}`); continue; }
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) continue;
        const match = content.match(/\{[\s\S]*\}/);
        if (match) { console.log(`[plan] ✓ ${model}`); return new Response(match[0], { headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
      } catch (e) { console.error(`[plan] ${model}:`, e); }
    }
    throw new Error("All models failed");
  } catch (e) {
    console.error("generate-study-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
