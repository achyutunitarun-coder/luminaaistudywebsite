import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = ["qwen/qwen3.6-plus:free", "nvidia/nemotron-3-super-120b-a12b:free", "meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free"];

function cleanJSON(raw: string): any {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim().replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch {
    const fixed = match[0].replace(/,\s*([\]}])/g, "$1");
    try { return JSON.parse(fixed); } catch { return null; }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.text();
    if (body.length > 10_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { topic } = JSON.parse(body);
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    for (const model of MODELS) {
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 12000);
        const res = await fetch(OPENROUTER_URL, { method: "POST", signal: c.signal, headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages: [
          { role: "system", content: `Create an epic boss battle with creative, challenging questions. Give the boss personality! Return ONLY JSON: {"name": "Creative Boss Name", "icon": "emoji", "questions": [{"q": "question", "options": ["A","B","C","D"], "correct": 0}]}` },
          { role: "user", content: `Boss battle for "${topic}" with 5 challenging questions.` },
        ], max_tokens: 1500, temperature: 0.7 }) });
        clearTimeout(t);
        if (!res.ok) { const e = await res.text(); console.error(`[boss] ${model} ${res.status}: ${e.slice(0,200)}`); continue; }
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) continue;
        const parsed = cleanJSON(content);
        if (parsed?.questions) { console.log(`[boss] ✓ ${model}`); return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
      } catch (e) { console.error(`[boss] ${model}:`, e); }
    }
    throw new Error("All models failed");
  } catch (e) {
    console.error("generate-boss error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
