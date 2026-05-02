// chat-artifact-v2: simple synchronous JSON endpoint for /src/features/chat/.
// Returns { html } on success, { error } on failure. Never throws "Empty AI response".
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIText } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Verified live OpenRouter free models, ranked by HTML-generation quality.
// gpt-oss-120b is the strongest free generalist; nemotron-super-120b and
// ling-1T cover the long tail; smaller models are last-ditch fallbacks.
const HTML_MODELS = [
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "inclusionai/ling-2.6-1t:free",
  "google/gemma-4-31b-it:free",
  "minimax/minimax-m2.5:free",
  "z-ai/glm-4.5-air:free",
  "openai/gpt-oss-20b:free",
  "google/gemma-3-27b-it:free",
];

function cleanHtml(raw: string): string {
  let h = (raw || "").trim();
  h = h.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (h.startsWith("```html")) h = h.slice(7);
  else if (h.startsWith("```")) h = h.slice(3);
  if (h.endsWith("```")) h = h.slice(0, -3);
  h = h.trim();
  const dt = h.toLowerCase().indexOf("<!doctype");
  if (dt > 0) h = h.slice(dt);
  const ht = h.toLowerCase().indexOf("<html");
  if (dt === -1 && ht > 0) h = h.slice(ht);
  return h.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const { type, topic, userPrompt, systemPrompt } = body;
    if (!type || !topic || !systemPrompt) {
      return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let html = "";
    let lastErr = "";
    const startedAt = Date.now();
    const HARD_BUDGET_MS = 170_000; // leave headroom under client's 200s

    for (const model of HTML_MODELS) {
      const remaining = HARD_BUDGET_MS - (Date.now() - startedAt);
      if (remaining < 15_000) {
        lastErr = lastErr || "budget_exhausted";
        break;
      }
      try {
        const txt = await callAIText(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt || `Generate the ${type} for: ${topic}` },
          ],
          [model],
          16000,
          0.5,
          Math.min(remaining, 90_000),
          `chat-artifact-v2/${type}`,
        );
        const cleaned = cleanHtml(txt);
        if (cleaned && cleaned.length > 600 && (cleaned.toLowerCase().includes("<!doctype") || cleaned.toLowerCase().includes("<html"))) {
          html = cleaned;
          break;
        }
        lastErr = cleaned ? "invalid_html_from_model" : "empty_from_model";
      } catch (e: any) {
        lastErr = e?.message || String(e);
      }
    }

    if (!html) {
      return new Response(JSON.stringify({ error: lastErr || "all_models_failed" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ html }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
