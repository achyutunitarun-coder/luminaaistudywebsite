import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = ["openrouter/auto", "qwen/qwen3-235b-a22b:free", "meta-llama/llama-4-maverick:free", "google/gemma-3-27b-it:free", "nvidia/llama-3.1-nemotron-70b-instruct:free", "deepseek/deepseek-chat-v3-0324:free", "mistralai/mistral-small-3.1-24b-instruct:free", "meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-12b-it:free"];

function cleanJSON(raw: string): any {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim().replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const start = text.search(/[\[{]/);
  if (start < 0) return null;
  const startChar = text[start];
  const end = text.lastIndexOf(startChar === "[" ? "]" : "}");
  if (end <= start) return null;
  let jsonStr = text.slice(start, end + 1).replace(/,\s*([\]}])/g, "$1");
  try { return JSON.parse(jsonStr); } catch {
    let b = 0, k = 0;
    for (const c of jsonStr) { if (c === "{") b++; if (c === "}") b--; if (c === "[") k++; if (c === "]") k--; }
    while (k > 0) { jsonStr += "]"; k--; }
    while (b > 0) { jsonStr += "}"; b--; }
    try { return JSON.parse(jsonStr); } catch { return null; }
  }
}

async function callAI(apiKey: string, messages: any[], maxTokens = 2500): Promise<string> {
  for (const model of MODELS) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 15000);
      const res = await fetch(OPENROUTER_URL, { method: "POST", signal: c.signal, headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.5 }) });
      clearTimeout(t);
      if (!res.ok) { const e = await res.text(); console.error(`[flashcards] ${model} ${res.status}: ${e.slice(0,200)}`); continue; }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) { console.log(`[flashcards] ✓ ${model}`); return content; }
    } catch (e) { console.error(`[flashcards] ${model}:`, e); }
  }
  throw new Error("All models are busy — please try again in a moment");
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
    if (body.length > 100_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { content, title, cardCount = 20 } = JSON.parse(body);
    const count = Math.min(Math.max(Number(cardCount) || 20, 5), 80);
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const text = await callAI(OPENROUTER_API_KEY, [
      { role: "system", content: `Create ${count} flashcards. Mix types: why, compare, apply, recall. Return ONLY JSON: {"cards": [{"front": "question", "back": "answer"}]}` },
      { role: "user", content: `Create ${count} flashcards for "${String(title||'').slice(0,200)}" from:\n\n${String(content||'').slice(0,30000)}` },
    ], 2500);

    const parsed = cleanJSON(text);
    if (parsed?.cards) return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ error: "AI returned invalid response. Try again." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-flashcards error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
