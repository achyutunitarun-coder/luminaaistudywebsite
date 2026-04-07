import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = ["meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free", "qwen/qwen3-next-80b-a3b-instruct:free", "minimax/minimax-m2.5:free", "z-ai/glm-4.5-air:free", "stepfun/step-3.5-flash:free"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.text();
    if (body.length > 50_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { userData } = JSON.parse(body);
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    for (const model of MODELS) {
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 12000);
        const res = await fetch(OPENROUTER_URL, { method: "POST", signal: c.signal, headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages: [
          { role: "system", content: `Generate a monthly learning report. Be honest but encouraging — celebrate wins and be direct about areas needing work.

Return ONLY JSON: {"headline":"...","total_study_minutes":0,"total_study_hours":0,"average_test_score":0,"tests_taken":0,"xp_earned":0,"strengths":[{"topic":"...","detail":"..."}],"weaknesses":[{"topic":"...","detail":"..."}],"recommendations":["actionable tip"],"overall_grade":"A/B/C/D"}` },
          { role: "user", content: `Monthly report from:\n\n${JSON.stringify(userData)}` },
        ], max_tokens: 1500, temperature: 0.5 }) });
        clearTimeout(t);
        if (!res.ok) { const e = await res.text(); console.error(`[report] ${model} ${res.status}: ${e.slice(0,200)}`); continue; }
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) continue;
        const match = content.match(/\{[\s\S]*\}/);
        if (match) { console.log(`[report] ✓ ${model}`); return new Response(JSON.stringify(JSON.parse(match[0])), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
      } catch (e) { console.error(`[report] ${model}:`, e); }
    }
    throw new Error("All models failed");
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
