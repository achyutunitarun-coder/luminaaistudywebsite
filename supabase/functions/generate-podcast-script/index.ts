import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = ["openrouter/auto", "qwen/qwen3-235b-a22b:free", "meta-llama/llama-4-maverick:free", "google/gemma-3-27b-it:free", "nvidia/llama-3.1-nemotron-70b-instruct:free", "deepseek/deepseek-chat-v3-0324:free", "mistralai/mistral-small-3.1-24b-instruct:free", "meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-12b-it:free"];
const TIMEOUT_MS = 18000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.text();
    if (body.length > 100_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { notes } = JSON.parse(body);
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    for (const model of MODELS) {
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), TIMEOUT_MS);
        const res = await fetch(OPENROUTER_URL, {
          method: "POST", signal: c.signal,
          headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model, stream: true, max_tokens: 4000, temperature: 0.75,
            messages: [
              { role: "system", content: `Create an engaging educational podcast conversation between ALEX (expert explainer) and SAM (curious challenger). Format every line as "ALEX: ..." or "SAM: ...". Jump straight into the topic. Make it AT LEAST 2500 words. Include natural interruptions, debates, aha moments. NO markdown, NO stage directions, NO emojis.` },
              { role: "user", content: `Turn these notes into a podcast episode:\n\n${notes}` },
            ],
          }),
        }, TIMEOUT_MS);
        clearTimeout(t);
        if (!res.ok) { const e = await res.text(); console.error(`[podcast] ${model} ${res.status}: ${e.slice(0, 200)}`); continue; }
        console.log(`[podcast] ✓ ${model}`);
        return new Response(res.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
      } catch (e) { console.error(`[podcast] ${model}:`, e); }
    }
    throw new Error("All models are busy — please try again in a moment");
  } catch (e) {
    console.error("generate-podcast-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
